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
and published. `package.json` keeps a `version` field that must match the tag
(without the leading `v`) at release time. Continuous Integration validates this
match before any image is published and fails the release explicitly on a
mismatch.

## Versioning policy (Semantic Versioning)

The project follows [Semantic Versioning](https://semver.org/):

| Segment | Meaning                                                        | Example trigger                                                                         |
| ------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `MAJOR` | Breaking changes to the public contract or documented behavior | Removing/renaming an API route, changing the DB schema in a non-backward-compatible way |
| `MINOR` | Backward-compatible new functionality                          | New command, new notification platform, new scheduler option                            |
| `PATCH` | Backward-compatible bug fixes                                  | Bug fix, dependency patch, internal refactor with no behavior change                    |

Pre-release identifiers such as `-rc.1` may be used for release candidates, for
example `v1.3.0-rc.1`. A pre-release tag is **not** a stable release and must
never be published as the `latest` Docker image.

## Release flow

1. A maintainer bumps `version` in `package.json` to the next SemVer value.
2. The maintainer creates a Git tag `v<MAJOR>.<MINOR>.<PATCH>` (optionally
   `-rc.N`) pointing at the release commit and pushes it.
3. GitHub Actions runs the verification jobs (lint, typecheck, tests, build).
4. A release job validates that the tag version matches `package.json`.
5. On success, the Docker image is built and published to GHCR with:
   - `ghcr.io/realrezasadeghi/bot:<version>` (for example `1.2.3`)
   - `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>`
   - `ghcr.io/realrezasadeghi/bot:latest` **only for stable releases** (never for pre-releases)

## Docker image tagging

For a stable release `v1.2.3` the following images are published:

- `ghcr.io/realrezasadeghi/bot:1.2.3` — the immutable release image
- `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>` — traceable to the exact commit
- `ghcr.io/realrezasadeghi/bot:latest` — stable releases only; a floating pointer to the most recent stable release

For a pre-release `v1.3.0-rc.1`:

- `ghcr.io/realrezasadeghi/bot:1.3.0-rc.1`
- `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>`

`latest` is **not** published for pre-releases.

Ordinary pushes to `master`, pull requests, and failed workflow runs never
publish a release image and never overwrite a stable release tag or `latest`.

## Deployment and rollback

Production deployments on the VPS should reference an **immutable** release
image, for example:

```
ghcr.io/realrezasadeghi/bot:1.2.3
```

Do not rely exclusively on `latest` in production: `latest` is a mutable,
floating tag that can be retagged to a newer release at any time, which makes
reproducing a running deployment impossible and complicates rollback.

Rollback means redeploying an older immutable image tag (for example
`1.2.2`). Application rollback does **not** automatically reverse database
migrations. Database migration compatibility (backward-compatible schema
changes) must be considered separately before rolling back the application.

## Repository conventions

- Default branch: `master` (protected, requires passing CI before merge)
- No long-lived registry credentials are stored; publishing uses the GitHub-
  provided `GITHUB_TOKEN` with `packages: write` only on the release job.
- The GHCR package `ghcr.io/realrezasadeghi/bot` is kept private.
- `.dockerignore` excludes `.env`, `.env.*`, `.git`, `node_modules`, and `dist`
  so secrets and build artifacts never enter the image.
