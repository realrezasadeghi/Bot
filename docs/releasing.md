# Releasing

This document describes the release-versioning policy for `academic-scheduling-bot`
and how Git tags, `package.json`, and published Docker images stay consistent.

## Authoritative version source

**Git release tags are the authoritative identifier for published releases.**

A release is identified by an annotated Git tag of the form:

```
v<MAJOR>.<MINOR>.<PATCH>
```

for example `v1.2.3`. The tag points at the exact source commit that was built
and published. `package.json` keeps a `version` field that matches the tag
(without the leading `v`). Continuous Integration validates this match before
any image is published and fails the release explicitly on a mismatch.

## Versioning policy (Semantic Versioning)

The project follows [Semantic Versioning](https://semver.org/) using
[Conventional Commits](https://www.conventionalcommits.org/). Versions are
calculated automatically by [Semantic Release](https://semantic-release.gitbook.io/semantic-release/)
from commit messages since the previous release. Developers must not manually
decide the next version number for ordinary releases.

| Commit type         | SemVer bump | Example                                                     |
| ------------------- | ----------- | ----------------------------------------------------------- |
| `fix:`              | PATCH       | `fix: prevent duplicate notification jobs`                  |
| `feat:`             | MINOR       | `feat: export student schedules`                            |
| `feat!:` / breaking | MAJOR       | `feat!: change the notification API contract`               |
| `docs:`             | none        | `docs: improve deployment documentation`                    |
| `test:`             | none        | `test: add integration coverage for notification jobs`      |
| `chore:`            | none        | `chore: update pnpm lockfile`                               |
| `refactor:`         | none        | `refactor: split bot-messages.ts into per-domain renderers` |
| `perf:`             | PATCH       | `perf: cache study field lookups`                           |

Pre-release identifiers such as `-rc.1` may be used for release candidates, for
example `v1.3.0-rc.1`. A pre-release tag is **not** a stable release and must
never be published as the `latest` Docker image.

## How automated releases work

1. A contributor pushes a conventional-commit to `master` (or a PR is merged).
2. GitHub Actions runs verification jobs: lint & typecheck, tests (with
   PostgreSQL), and production build.
3. If all verification jobs succeed, the **Semantic Release** job runs:
   - Analyzes commits since the last release to calculate the next version.
   - Updates `package.json` with the new version.
   - Runs `pnpm install` to synchronize `pnpm-lock.yaml`.
   - Commits `package.json` and `pnpm-lock.yaml` with a `[skip ci]` message.
   - Creates a Git tag `vX.Y.Z` pointing at the release commit.
   - Creates a GitHub Release with auto-generated release notes.
4. The tag push triggers the **Docker Release** job:
   - Validates that the tag version matches `package.json`.
   - Builds the Docker image using Docker Buildx.
   - Publishes to GHCR:
     - `ghcr.io/realrezasadeghi/bot:vX.Y.Z`
     - `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>`
     - `ghcr.io/realrezasadeghi/bot:latest` (stable releases only)
5. The release commit contains `[skip ci]` so it does not retrigger CI.

## Docker image tagging

For a stable release `v1.2.3` the following images are published:

- `ghcr.io/realrezasadeghi/bot:v1.2.3` — the immutable release image
- `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>` — traceable to the exact
  source commit (the release commit, which is the same as the source commit
  for the tagged version)
- `ghcr.io/realrezasadeghi/bot:latest` — stable releases only; a floating
  pointer to the most recent stable release

For a pre-release `v1.3.0-rc.1`:

- `ghcr.io/realrezasadeghi/bot:v1.3.0-rc.1`
- `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>`

`latest` is **not** published for pre-releases.

Ordinary pushes to `master`, pull requests, and failed workflow runs never
publish a release image and never overwrite a stable release tag or `latest`.

## One-time baseline procedure

Semantic Release requires at least one existing release tag to calculate the
next version. This repository starts at `0.1.0` in `package.json` with no
existing tags.

**Before enabling automated releases, perform the one-time bootstrap:**

1. Verify the working tree is clean and on `master`.
2. Create and push the baseline tag:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. Confirm the tag exists on GitHub.

After the baseline tag exists, Semantic Release will automatically calculate
versions from subsequent conventional commits. Do not push a baseline tag
that does not match `package.json`; the release job validates this and will
fail explicitly.

## Dockerfile and image contents

The Docker image is built from `Dockerfile` using multi-stage builds:

- `deps` — installs production dependencies with `pnpm install --frozen-lockfile --prod`
- `build` — compiles TypeScript to `dist/`
- `runtime` — copies only production dependencies, compiled output, and migrations

The image contains:
- Versioned application code matching the release tag
- Matching `package.json` metadata
- Drizzle migration files under `/app/drizzle`

The `.dockerignore` excludes `.env`, `.env.*`, `.git`, `node_modules`, and
`dist` so secrets and build artifacts never enter the image.

OCI labels are set on every published image:
- `org.opencontainers.image.source` — source repository URL
- `org.opencontainers.image.revision` — full Git commit SHA
- `org.opencontainers.image.version` — release version

## Deployment and rollback

Production deployments on the VPS should reference an **immutable** release
image, for example:

```
ghcr.io/realrezasadeghi/bot:v1.2.3
```

Do not rely exclusively on `latest` in production: `latest` is a mutable,
floating tag that can be retagged to a newer release at any time, which makes
reproducing a running deployment impossible and complicates rollback.

Rollback means redeploying an older immutable image tag (for example
`v1.2.2`). Application rollback does **not** automatically reverse database
migrations. Database migration compatibility (backward-compatible schema
changes) must be considered separately before rolling back the application.

The Docker Compose architecture (separate PostgreSQL, migrate, HTTP, and
worker services) is preserved. Deployments should reference the explicit
version tag rather than `latest`.

## Recovery from failed image publication

If a Git tag is created by Semantic Release but Docker publishing fails
(network interruption, registry error, etc.), the image can be republished
without creating a new version:

1. Fetch the existing tag:

   ```bash
   git fetch --tags
   ```
2. Run the recovery script (requires Docker Buildx and GHCR login):

   ```bash
   node scripts/recover-release.js v1.2.3
   ```

   Or use the `docker-release` job by re-pushing the tag:

   ```bash
   git push origin v1.2.3 --force
   ```

The recovery operation uses the existing release tag and its exact source
commit. It never calculates a different version.

## Repository conventions

- Default branch: `master` (protected, requires passing CI before merge)
- No long-lived registry credentials are stored; publishing uses the GitHub-
  provided `GITHUB_TOKEN` with `contents: write` and `packages: write`
  scoped to the release and docker-release jobs respectively.
- The GHCR package `ghcr.io/realrezasadeghi/bot` is kept private.
- `.dockerignore` excludes `.env`, `.env.*`, `.git`, `node_modules`, and `dist`
  so secrets and build artifacts never enter the image.
