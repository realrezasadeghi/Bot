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

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22 |
| Language | TypeScript (strict) |
| Framework | Express 5 |
| Database | PostgreSQL 17 |
| ORM / Migrations | Drizzle ORM / Drizzle Kit |
| Package manager | pnpm 12 |
| Lint / format | Biome |
| Tests | Vitest |
| Container | Docker (multi-stage) |
| Registry | GitHub Container Registry (GHCR) |
| Release automation | Semantic Release (Conventional Commits) |

## Project Structure

```
.
├── .github/workflows/ci.yml      # GitHub Actions CI / release pipeline
├── docs/releasing.md             # Release policy & procedures
├── drizzle/                      # Drizzle migration SQL files
├── scripts/
│   ├── sync-lockfile.js          # Syncs pnpm-lock.yaml after version bump
│   ├── recover-release.js        # Recovers failed Docker publish for a tag
│   └── validate-release.js       # Validates tag vs package.json version
├── src/
│   ├── bootstrap/                # App, HTTP server, worker, container, routes
│   ├── application/              # Use-cases, DTOs, services, ports
│   ├── domain/                   # Domain entities & value objects
│   ├── adapters/                 # Persistence, messaging, university sources
│   ├── cli/                      # CLI entry points (migrate, sync, seed, etc.)
│   └── config/                   # Environment configuration (Zod)
├── tests/                        # Vitest unit & integration tests
├── docker-compose.yml            # Local development stack
├── Dockerfile                    # Multi-stage production image
├── release.config.mjs            # Semantic Release configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 22
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

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `development`, `test`, or `production` | `development` |
| `PORT` | HTTP server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://academic:academic@localhost:5432/academic_scheduling` |
| `ADMIN_API_TOKEN` | Bearer token for `/api/admin` routes | (required in production) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (enables Telegram platform) | — |
| `BALE_BOT_TOKEN` | Bale bot token (enables Bale platform) | — |
| `UNIVERSITY_*` | University portal scraping configuration | see `.env.example` |

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

Platform webhook endpoints for incoming bot messages.

### Admin (requires `ADMIN_API_TOKEN` Bearer auth)

```
POST   /api/admin/sync                 # Trigger academic data synchronization
POST   /api/admin/occurrences          # Generate class occurrences
POST   /api/admin/notifications/schedule  # Schedule reminders & summaries
POST   /api/admin/notifications/dispatch  # Dispatch due notification jobs
GET    /api/admin/sync-runs/latest     # Get the latest sync run record
```

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

## Releasing

This project uses **Semantic Release** with **Conventional Commits**. Versions are calculated automatically from commit messages — do not manually bump `package.json`.

### Commit conventions

| Commit type | SemVer bump | Example |
|-------------|-------------|---------|
| `fix:` | PATCH | `fix: prevent duplicate notification jobs` |
| `feat:` | MINOR | `feat: export student schedules` |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | `feat!: change the notification API contract` |
| `docs:`, `test:`, `chore:`, `refactor:`, `perf:` | none* | `docs: improve deployment documentation` |

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

## Environment Variables Reference

See `.env.example` for the complete list. Key groups:

- **Runtime** — `NODE_ENV`, `PORT`, `LOG_LEVEL`, `ADMIN_API_TOKEN`
- **Database** — `DATABASE_URL`, `DATABASE_POOL_MAX`
- **University portal** — `UNIVERSITY_SOURCE_KEY`, `UNIVERSITY_OFFER_URL`, term codes, view state, cookies
- **Messaging** — `TELEGRAM_BOT_TOKEN`, `BALE_BOT_TOKEN` and related base URLs/scopes
- **Worker** — poll/scheduler intervals, lock timeouts, batch sizes
- **Scheduling** — occurrence/reminder/summary horizons, default reminder offsets

## License

Private repository — all rights reserved.