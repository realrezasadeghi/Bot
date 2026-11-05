# Academic Scheduling Bot

A Node.js + TypeScript + Express academic scheduling bot with PostgreSQL, Drizzle ORM, and a background worker. It synchronizes academic data from a university portal, manages student subscriptions and course selections, and delivers notifications via Telegram and Bale.

## Features

- **Academic data synchronization** — imports terms, levels, fields, programs, courses, instructors, offerings, meeting patterns, exceptions, and examinations from a university portal
- **Class occurrence generation** — expands meeting patterns into dated class occurrences over a configurable horizon
- **Student subscriptions & course selection** — subscribe to programs, customize course selections, manage notification preferences
- **Notifications** — daily summaries, class reminders, exam reminders delivered via Telegram and Bale
- **University webhooks** — receives platform webhooks for bot interactions
- **Admin API** — manual sync, occurrence generation, notification scheduling/dispatch, sync-run history
- **Background worker** — periodic sync, reminder scheduling, daily summaries, dispatch polling
- **Safe synchronization** — rejects invalid/reduced snapshots and preserves the last known good academic dataset

## Tech Stack

| Layer              | Technology                              |
| ------------------ | --------------------------------------- |
| Runtime            | Node.js 22                              |
| Language           | TypeScript (strict)                     |
| Framework          | Express 5                               |
| Database           | PostgreSQL 17                           |
| ORM / Migrations   | Drizzle ORM / Drizzle Kit               |
| Package manager    | pnpm 12                                 |
| Lint / format      | Biome                                   |
| Tests              | Vitest                                  |
| Container          | Docker (multi-stage)                    |
| Registry           | GitHub Container Registry (GHCR)        |
| Release automation | Semantic Release (Conventional Commits) |

## Project Structure

```
.
├── .github/workflows/ci.yml      # GitHub Actions CI / release pipeline
├── docs/
│   ├── api.md                    # API contract & OpenAPI workflow
│   ├── architecture.md           # Hexagonal architecture & dependency rules
│   ├── logging.md                # HTTP logging reference
│   ├── openapi.json              # Generated OpenAPI 3.1 specification
│   └── releasing.md              # Release policy & procedures
├── .specify/                     # Spec Kit templates, scripts, constitution
├── .opencode/commands/           # Spec Kit commands for OpenCode
├── drizzle/                      # Drizzle migration SQL files
├── scripts/
│   ├── generate-openapi.ts        # Writes docs/openapi.json
│   ├── check-openapi-breaking.mjs # oasdiff breaking-change gate
│   ├── postprocess-postman.mjs    # Binds Postman collection variables
│   ├── sync-lockfile.js          # Syncs pnpm-lock.yaml after version bump
│   ├── recover-release.js        # Recovers failed Docker publish for a tag
│   └── validate-release.js       # Validates tag vs package.json version
├── src/
│   ├── domain/                   # Domain entities & value objects
│   ├── application/              # Use-cases, DTOs, services, ports
│   ├── adapters/                 # Hexagonal adapters
│   │   ├── inbound/              # Driving: HTTP API, platform webhooks
│   │   └── outbound/             # Driven: persistence, messaging, university, system
│   ├── bootstrap/                # Composition root: container, HTTP & worker entrypoints
│   ├── cli/                      # CLI entry points (migrate, sync, seed, etc.)
│   └── config/                   # Environment configuration (Zod)
├── tests/                        # Vitest unit & integration tests
├── docker-compose.yml            # Local development stack
├── Dockerfile                    # Multi-stage production image
├── release.config.mjs            # Semantic Release configuration
└── package.json
```

The codebase follows **Hexagonal Architecture (Ports & Adapters)**: `domain` and
`application` are the inside of the hexagon, `adapters` are the outside, and
`bootstrap` is the composition root that wires them together. See
[docs/architecture.md](docs/architecture.md) for the layer map, the dependency
rules, and how to add an endpoint.

## Getting Started

### Prerequisites

- Node.js >= 22.14
- pnpm 12.4.2
- PostgreSQL 17 (local or Docker)

### 1. Clone and install

```bash
git clone https://github.com/realrezasadeghi/Bot.git
cd Bot
pnpm install --frozen-lockfile
```

### 2. Configure environment

Copy the example environment file and adjust values:

```bash
cp .env.example .env
```

Key settings:

| Variable             | Description                                    | Default                                                           |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`           | `development`, `test`, or `production`         | `development`                                                     |
| `PORT`               | HTTP server port                               | `3000`                                                            |
| `DATABASE_URL`       | PostgreSQL connection string                   | `postgres://academic:academic@localhost:5432/academic_scheduling` |
| `ADMIN_API_TOKEN`    | Bearer token for `/api/admin` routes           | (required in production)                                          |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (enables Telegram platform) | —                                                                 |
| `BALE_BOT_TOKEN`     | Bale bot token (enables Bale platform)         | —                                                                 |
| `UNIVERSITY_*`       | University portal scraping configuration       | see `.env.example`                                                |

### 3. Set up the database

Using Docker Compose (recommended for local development):

```bash
docker compose up -d postgres
```

Then run Drizzle migrations:

```bash
pnpm db:migrate
```

Or push the schema directly:

```bash
pnpm db:push
```

### 4. Run in development

Start the HTTP server with hot reload:

```bash
pnpm dev:http
```

Start the background worker with hot reload:

```bash
pnpm dev:worker
```

### 5. Run with Docker Compose

```bash
docker compose up -d --build
```

This starts PostgreSQL, runs the migration service, then starts the HTTP and worker services.

## API Reference

The full OpenAPI 3.1 specification is generated from the shared Zod
contracts. With the server running, open:

- **Scalar docs** — http://localhost:3000/api/docs
- **OpenAPI JSON** — http://localhost:3000/api/openapi.json

Docs are enabled outside production and disabled in production by default.
Set `API_DOCS_ENABLED=true` to enable them in production.

### Health

```
GET /api/health
```

Returns `{ status: "ok" }` when the database is reachable.

### Webhooks

```
POST /api/webhooks/telegram
POST /api/webhooks/bale
```

Platform webhook endpoints for incoming bot messages. Mounted only when the
corresponding platform token is configured; when a webhook secret is
configured, the matching secret header is required.

### Admin (requires `ADMIN_API_TOKEN` Bearer auth)

```
POST   /api/admin/sync                 # Trigger academic data synchronization
POST   /api/admin/occurrences          # Generate class occurrences
POST   /api/admin/notifications/schedule  # Schedule reminders & summaries
POST   /api/admin/notifications/dispatch  # Dispatch due notification jobs
GET    /api/admin/sync-runs/latest     # Get the latest sync run record
```

See [docs/api.md](docs/api.md) for the contract workflow, error format, and
CI checks.

## Worker

The background worker (`src/bootstrap/worker.ts`) runs on a schedule:

- **Sync** — periodic academic data synchronization (`syncIntervalMinutes`)
- **Scheduler** — class reminders, exam reminders, daily summaries
- **Dispatch** — polls and sends due notification jobs

Start the worker:

```bash
pnpm start:worker
```

## Database & Migrations

Generate a new migration from schema changes:

```bash
pnpm db:generate
```

Apply migrations to the database:

```bash
pnpm db:migrate
```

Push schema directly (development only):

```bash
pnpm db:push
```

Open Drizzle Studio:

```bash
pnpm db:studio
```

## Testing

Run the full test suite (requires `TEST_DATABASE_URL` pointing to a PostgreSQL instance):

```bash
pnpm test
```

Run only integration tests:

```bash
pnpm test:integration
```

Run the API contract tests (route behaviour, response schemas, and OpenAPI
parity against the committed `docs/openapi.json`):

```bash
pnpm test:api
```

## Spec-Driven Development (Spec Kit)

This project uses [GitHub Spec Kit](https://github.github.io/spec-kit/) for
spec-driven development, wired to OpenCode. The templates, the process
commands, and the project constitution live in `.specify/`, and the OpenCode
commands live in `.opencode/commands/`.

Install the CLI once:

```bash
uv tool install specify-cli
```

Then drive the workflow **from the OpenCode chat**, one step at a time:

| Command                 | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `/speckit.constitution` | Create or amend the project constitution             |
| `/speckit.specify`      | Write the feature specification                      |
| `/speckit.clarify`      | Resolve ambiguous requirements (optional)            |
| `/speckit.plan`         | Produce the implementation plan                      |
| `/speckit.tasks`        | Break the plan into actionable tasks                 |
| `/speckit.analyze`      | Cross-artifact consistency report (optional)         |
| `/speckit.checklist`    | Generate a requirements-quality checklist (optional) |
| `/speckit.implement`    | Execute the tasks                                    |
| `/speckit.converge`     | Find the remaining gaps and re-plan                  |

Example:

```text
/speckit.specify Add CSV export to the admin sync-runs endpoint. Preserve
the existing JSON response and the bearer authentication.
```

The project constitution in `.specify/memory/constitution.md` records the
principles the repository already enforces (hexagonal dependency rules, the
Zod-first API contract, the quality gates), so every plan is checked against
them.

Inspect or repair the installation:

```bash
specify integration status   # verify the installed integration
specify check                # verify the agent CLI is available
specify integration upgrade opencode   # refresh after a CLI upgrade
```

The optional bug-fixing and idea-assessment processes are separate
extensions:

```bash
specify extension add bug
specify extension add assess
```

## Code Quality

```bash
# Lint
pnpm lint

# Format
pnpm format

# Full biome check (lint + format check)
pnpm check

# Type check
pnpm typecheck

# Production build
pnpm build
```

### API specification

```bash
# Regenerate docs/openapi.json from the Zod contracts
pnpm api:generate

# Lint the generated OpenAPI document
pnpm api:lint

# Check for breaking changes against the base branch (requires oasdiff)
pnpm api:diff

# Regenerate the Postman collection
pnpm api:postman
```

## Releasing

This project uses **Semantic Release** with **Conventional Commits**. Versions are calculated automatically from commit messages — do not manually bump `package.json`.

### Commit conventions

| Commit type                                      | SemVer bump | Example                                       |
| ------------------------------------------------ | ----------- | --------------------------------------------- |
| `fix:`                                           | PATCH       | `fix: prevent duplicate notification jobs`    |
| `feat:`                                          | MINOR       | `feat: export student schedules`              |
| `feat!:` or `BREAKING CHANGE:`                   | MAJOR       | `feat!: change the notification API contract` |
| `docs:`, `test:`, `chore:`, `refactor:`, `perf:` | none*       | `docs: improve deployment documentation`      |

\* `perf:` produces a PATCH release.

### Release flow

1. Push conventional-commit(s) to `master` (or merge a PR).
2. GitHub Actions runs verification (lint, typecheck, tests, build).
3. Semantic Release calculates the next version, updates `package.json` + `pnpm-lock.yaml`, creates tag `vX.Y.Z`, and creates a GitHub Release.
4. The tag push triggers the Docker Release job, publishing to GHCR:
   - `ghcr.io/realrezasadeghi/bot:vX.Y.Z`
   - `ghcr.io/realrezasadeghi/bot:sha-<full-commit-sha>`
   - `ghcr.io/realrezasadeghi/bot:latest` (stable releases only)

### One-time bootstrap

Semantic Release requires a baseline tag. Before enabling automated releases:

```bash
git tag v0.1.0
git push origin v0.1.0
```

See `docs/releasing.md` for the full release policy, tag-to-image mapping, recovery procedure, and deployment guidance.

## Docker

Build the image:

```bash
docker build -t academic-scheduling-bot:local .
```

Run locally:

```bash
docker run --rm -p 3000:3000 --env-file .env academic-scheduling-bot:local
```

The image is multi-stage: dependencies are installed with `--prod`, TypeScript is compiled to `dist/`, and only the runtime artifacts are copied to the final image. `.env` files are excluded via `.dockerignore`.

## Logging

HTTP requests are logged with [pino] + [pino-http]: one correlated JSON line
per request (request id, route, redacted headers/query/body, status,
duration, and the serialized error on failures), levels by status
(2xx/3xx → `info`, 4xx → `warn`, 5xx → `error`). `pino-pretty` is used in
development and never in production.

```bash
LOG_LEVEL=info            # fatal | error | warn | info | debug | trace | silent
LOG_REQUEST_BODY=true     # log parsed request bodies (default outside production)
LOG_BODY_MAX_LENGTH=2048  # truncate larger bodies
```

See [docs/logging.md](docs/logging.md) for the full field reference,
redaction rules, and production security notes.

[pino]: https://github.com/pinojs/pino
[pino-http]: https://github.com/pinojs/pino-http
[pino-pretty]: https://github.com/pinojs/pino-pretty

## Environment Variables Reference

See `.env.example` for the complete list. Key groups:

- **Runtime** — `NODE_ENV`, `PORT`, `LOG_LEVEL`, `LOG_PRETTY`, `LOG_REQUEST_BODY`, `LOG_BODY_MAX_LENGTH`, `ADMIN_API_TOKEN`
- **API docs** — `API_DOCS_ENABLED`, `API_DOCS_PATH`, `API_OPENAPI_PATH`
- **Database** — `DATABASE_URL`, `DATABASE_POOL_MAX`
- **University portal** — `UNIVERSITY_SOURCE_KEY`, `UNIVERSITY_OFFER_URL`, term codes, view state, cookies
- **Messaging** — `TELEGRAM_BOT_TOKEN`, `BALE_BOT_TOKEN` and related base URLs/scopes
- **Worker** — poll/scheduler intervals, lock timeouts, batch sizes
- **Scheduling** — occurrence/reminder/summary horizons, default reminder offsets

## License

Private repository — all rights reserved.
