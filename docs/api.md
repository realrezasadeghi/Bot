# API Documentation

The HTTP API is described by an OpenAPI 3.1 document generated from the same
Zod schemas that validate requests at runtime. The generated document is
served by the application, committed to the repository, and checked in CI.

## Documentation endpoints

| Endpoint                | Purpose                          |
| ----------------------- | -------------------------------- |
| `GET /api/docs`         | Interactive Scalar API reference |
| `GET /api/openapi.json` | Generated OpenAPI 3.1 document   |

Both endpoints are controlled by environment variables:

| Variable           | Default                                          | Description                        |
| ------------------ | ------------------------------------------------ | ---------------------------------- |
| `API_DOCS_ENABLED` | `true` outside production, `false` in production | Serve the docs and spec.           |
| `API_DOCS_PATH`    | `/api/docs`                                      | Path for the Scalar UI.            |
| `API_OPENAPI_PATH` | `/api/openapi.json`                              | Path for the raw OpenAPI document. |

The default keeps the docs available during development while ensuring the
admin surface is not published in production unless explicitly enabled.

## Source of truth

Endpoint definitions live in three places:

| File                                              | Responsibility                                             |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `src/adapters/inbound/http/api/contracts/*.ts`    | Zod request, response, and error schemas                   |
| `src/adapters/inbound/http/api/route-manifest.ts` | Mounted routes, HTTP methods, auth mode, operation ids     |
| `src/adapters/inbound/http/api/openapi.ts`        | Maps contracts and the manifest to an OpenAPI 3.1 document |

`mountHttpRoutes` and `buildOpenApiDocument` both consume the route manifest, so a
route cannot be mounted without being documented. The document is built in
memory at runtime, which means the served spec always matches the running
code.

### Why Zod-first

- One definition validates requests **and** documents the API.
- `docs/openapi.json` is generated, never hand-edited.
- Contract drift is a test failure, not a review oversight.

## Endpoints

| Method | Path                                | Auth                  |
| ------ | ----------------------------------- | --------------------- |
| `GET`  | `/api/health`                       | none                  |
| `POST` | `/api/webhooks/telegram`            | webhook secret header |
| `POST` | `/api/webhooks/bale`                | webhook secret header |
| `POST` | `/api/admin/sync`                   | bearer token          |
| `POST` | `/api/admin/occurrences`            | bearer token          |
| `POST` | `/api/admin/notifications/schedule` | bearer token          |
| `POST` | `/api/admin/notifications/dispatch` | bearer token          |
| `GET`  | `/api/admin/sync-runs/latest`       | bearer token          |

Webhook routes are always mounted, but a webhook of an unconfigured platform
(`TELEGRAM_BOT_TOKEN` / `BALE_BOT_TOKEN` unset) returns `404 NOT_FOUND`.
Admin routes always require `Authorization: Bearer $ADMIN_API_TOKEN`; when the
token is unset they return `503 ADMIN_DISABLED`.

## Error format

Admin and health routes return a shared envelope:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Invalid request: termId: Required",
		"details": {
			"issues": ["termId: Required"]
		}
	}
}
```

Documented codes: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
`INVARIANT_VIOLATION`, `UNRESOLVED_INTEGRATION_REQUIREMENT`,
`EXTERNAL_SOURCE_ERROR`, `INTERNAL_ERROR`, `REQUEST_ERROR`, `UNAUTHORIZED`,
`ADMIN_DISABLED`.

Webhook routes use a platform-friendly shape instead:

```json
{ "ok": false, "error": "INVALID_WEBHOOK_SECRET" }
```

## Regenerating the specification

```bash
pnpm api:generate   # writes docs/openapi.json from the in-memory document
pnpm api:lint       # validates the document with Redocly
pnpm api:postman    # regenerates postman/api-routes.postman_collection.json
```

Commit `docs/openapi.json` whenever a contract changes. The API contract test
compares the committed file with the freshly built document, so a stale spec
fails CI.

### Postman collection

`pnpm api:postman` converts the specification and then runs
`scripts/postprocess-postman.mjs`, which

- replaces request bodies with the examples declared in the contracts;
- binds the webhook secret headers to the environment variables;
- keeps only the secret header of the request's own platform.

The collection expects the variables defined in
`postman/api-environment.postman_environment.json`:

| Variable                | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `baseUrl`               | Base URL of the running API (default `http://localhost:3000`) |
| `bearerToken`           | `ADMIN_API_TOKEN` used for `/api/admin/*` routes              |
| `sourceKey`             | `UNIVERSITY_SOURCE_KEY` used by `/api/admin/sync-runs/latest` |
| `telegramWebhookSecret` | `TELEGRAM_WEBHOOK_SECRET`                                     |
| `baleWebhookSecret`     | `BALE_WEBHOOK_SECRET`                                         |

## Contract tests

```bash
pnpm test:api
```

The suite uses Supertest against the real Express app, with test doubles for
the ports the HTTP adapter consumes (`tests/fixtures/http-api-dependencies.ts`),
and asserts:

- every mounted route appears exactly once in the OpenAPI document;
- operation ids and methods match the route manifest;
- admin operations declare bearer auth and webhook operations declare their
  secret headers;
- response bodies match the shared Zod contracts (including errors);
- the committed `docs/openapi.json` matches the generated document.

## CI checks

The `api_contract` CI job runs:

1. `pnpm api:check` — regenerates the spec, fails if `docs/openapi.json` is
   dirty, lints it with Redocly, and runs the contract tests.
2. `pnpm api:diff` — an `oasdiff` breaking-change gate against the base
   branch when `oasdiff` is installed.

Install [oasdiff] locally to run the breaking-change check outside CI.

[oasdiff]: https://github.com/oasdiff/oasdiff
