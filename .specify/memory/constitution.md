# Academic Scheduling Bot Constitution
<!-- Spec Constitution, Academic Scheduling Bot Constitution -->

## Core Principles

### I. Hexagonal Architecture (Ports and Adapters)
Mandatory: `src/domain` imports nothing outward; `src/application` imports no adapters, no composition root, no config, and no frameworks; `src/adapters` never imports `src/bootstrap`; driven adapters never depend on Express. These rules are enforced by `tests/architecture/dependencies.test.ts`.
<!-- Every layer respects the dependency direction: adapters depend on the application core, never vice versa. -->

### II. Composition Root Boundary
`src/bootstrap` is the composition root and the only place where concrete implementations meet the application core through ports. It wires `container.ts` (concrete adapters + use cases), `http.ts` (HTTP entrypoint), and `worker.ts` (background worker). No application or adapter module may import `src/bootstrap`.
<!-- Keeps the core framework-agnostic and every driver testable without the container. -->

### III. Zod-First API Contract
`src/adapters/inbound/http/api/route-manifest.ts` is the single source of truth for the HTTP surface: the router mounts it and the OpenAPI 3.1 builder documents it. `HttpHandlers` is typed as `Record<ApiOperationId, HttpHandler>`, so a missing or extra handler is a compile error. The committed `docs/openapi.json` must never drift from the generated document. Any contract change must pass Redocly lint (`pnpm api:lint`) and the oasdiff breaking-change gate (`pnpm api:diff`).
<!-- Mounted routes and documented routes cannot drift apart; the served spec always matches the running code. -->

### IV. Public HTTP Behavior Compatibility
Existing status codes, error envelopes, and request and response shapes are a compatibility surface: they must be preserved unless a specification explicitly changes them. Admin authentication still runs before the 404 handler; admin routes still return 401/503; webhook routes of an unconfigured platform still return 404.
<!-- Prevents silent breaking changes to clients and external webhook senders. -->

### V. Reversible Database Migrations
Every database migration must be reversible and must include a rollback plan. Schema changes ship only with a migration that can be undone without data loss in the declared rollback path.
<!-- Protects production data and deployment reliability. -->

### VI. Quality Gates Before Merge
Every change must pass `pnpm check`, `pnpm typecheck`, `pnpm test` (including the integration suite against PostgreSQL), and `pnpm api:check` before it is merged.
<!-- Establishes a single, verifiable bar for all contributions. -->

### VII. Zod-Validated Runtime Configuration
Runtime configuration is validated with Zod at the boundary (`src/config/env.ts`). Secrets are never committed to the repository; they arrive through environment variables only.
<!-- Fails fast on invalid configuration and keeps credentials out of version control. -->

### VIII. Conventional Commits
Commits follow Conventional Commits because semantic-release derives the version and the release notes from them. The commit message determines the release type (`fix` = patch, `feat` = minor, `breaking`/`feat(scope: breaking)` = major).
<!-- Automates versioning and changelog generation from commit history. -->

## Testing & Integration
Unit and integration tests run with Vitest. Integration tests require `TEST_DATABASE_URL` pointing to a PostgreSQL instance and are exercised in CI with a Postgres service container.

## API Documentation & Contract Workflow
The OpenAPI 3.1 document is generated from the shared Zod schemas (`pnpm api:generate`), served at `/api/openapi.json` next to the Scalar reference at `/api/docs`, and committed as `docs/openapi.json`. Documentation endpoints are controlled by `API_DOCS_ENABLED` (`API_DOCS_PATH`, `API_OPENAPI_PATH`) and are disabled by default in production. The Postman collection is regenerated with `pnpm api:postman`.

## Governance
This constitution supersedes all other project practices. Amendments require a new specification, an update to `.specify/memory/constitution.md`, and compliance review against the dependency rules in `tests/architecture/dependencies.test.ts`. Versioning follows semantic versioning: MAJOR for backward-incompatible governance or principle removals/redefinitions, MINOR for new or materially expanded principles, PATCH for clarifications and wording fixes. Compliance is reviewed on every change through the established quality gates.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05
