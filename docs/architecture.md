# Architecture

The application follows **Hexagonal Architecture (Ports & Adapters)** with a
DDD-flavoured core. The rules are enforced by
`tests/architecture/dependencies.test.ts`, so a violation fails CI instead of
surviving a review.

```text
        ┌───────────────────────────────────────────────────────────┐
        │                    bootstrap (composition root)           │
        │  container.ts · http.ts · worker.ts · createAppContainer │
        └───────────────┬───────────────────────────┬───────────────┘
                        │ wires                     │ wires
        ┌───────────────▼──────────────┐  ┌─────────▼──────────────────┐
        │  adapters/inbound (driving)   │  │  adapters/outbound (driven)│
        │  http/ · telegram webhook     │  │  persistence/ · messaging/ │
        │                              │  │  university/ · system/     │
        └───────────────┬──────────────┘  └─────────┬──────────────────┘
                        │                            │
                        └──────────► application ◄──┘
                                      use-cases
                                      ports
                                        │
                                        ▼
                                     domain
```

## The hexagon

`domain/` and `application/` are the inside of the hexagon and know nothing
about HTTP, SQL, or messaging.

| Layer                   | Responsibility                                                                              | May import                        |
| ----------------------- | ------------------------------------------------------------------------------------------- | --------------------------------- |
| `src/domain`            | Entities, value objects, domain errors, invariants                                          | nothing outside `domain`          |
| `src/application`       | Use cases, application services, DTOs, driven ports (`ports/outbound`)                      | `domain` only                     |
| `src/adapters/inbound`  | Driving adapters: HTTP API, platform webhook parser                                         | `application`, `domain`, `config` |
| `src/adapters/outbound` | Driven adapters: PostgreSQL, messaging, university source, clock, ids                       | `application`, `domain`, `config` |
| `src/bootstrap`         | Composition root: builds concrete adapters, injects them into ports, owns process lifecycle | everything                        |
| `src/cli`               | Another driving adapter (command line)                                                      | `bootstrap`, `application`        |
| `src/config`            | Environment parsing and configuration-to-port mapping                                       | `application` (port types only)   |

## Dependency rules

| Rule                                                                                | Enforced by                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| The domain imports nothing outward (no application, adapters, config, frameworks).  | `keeps the domain independent…`                        |
| The application imports no adapters, no composition root, no config, no frameworks. | `keeps application code independent…`                  |
| Adapters never import the composition root — they are usable on their own.          | `keeps adapters independent of the composition root`   |
| Driven adapters do not depend on the HTTP framework.                                | `keeps the driven adapters free of the HTTP framework` |
| Configuration does not import adapters or the composition root.                     | `keeps configuration independent…`                     |

The composition root is the only place where the outside world is allowed to
meet the inside: `src/bootstrap/container.ts` creates every concrete adapter
and hands it to the application through its ports.

## Driving side: the HTTP API

`src/adapters/inbound/http` is the Express adapter. It is a _driver_: it
converts an HTTP request into a use-case call and writes the response.

```text
src/adapters/inbound/http/
├── http-api.ts            # assembles the Express app (middleware order)
├── http-router.ts         # mounts every route of the manifest
├── http-dependencies.ts   # the ports and use cases the adapter consumes
├── http-handler.ts        # the handler shape
├── parsing.ts             # request → typed input (Zod)
├── controllers/           # one controller per route group
├── middleware/            # logging, authentication, errors, 404
├── logging/               # redaction and error serialization
└── api/                   # the API contract
    ├── contracts/         # Zod request, response and error schemas
    ├── route-manifest.ts  # method, path, operation id, auth mode
    ├── openapi.ts         # OpenAPI 3.1 document builder
    └── docs.ts            # Scalar UI and raw document endpoints
```

### The route manifest is the single source of truth

`api/route-manifest.ts` declares every route once. It is consumed by

- `http-router.ts`, which mounts the routes, and
- `api/openapi.ts`, which documents them.

The operation id is the contract between the manifest, the handlers, and the
OpenAPI operations. `HttpHandlers` is typed as
`Record<ApiOperationId, HttpHandler>`, so a documented route without an
implementation — or an implementation without a documented route — is a
compile error.

### Controllers depend on narrow ports

Controllers never receive the composition root's container. They receive the
smallest set of use cases and ports they need, declared as interfaces in
`http-dependencies.ts`:

```ts
export interface HttpApiDependencies {
  config: { http: …; log: …; university: … };
  logger: Logger;
  pinoLogger: PinoLogger;
  uow: UnitOfWork;
  webhookPlatforms: readonly WebhookPlatform[];
  useCases: HttpUseCases;
  messaging: MessagingPort;
}
```

That is what makes the HTTP layer testable without a database: the test
fixture (`tests/fixtures/http-api-dependencies.ts`) provides doubles for
exactly these ports.

### Request flow

```text
HTTP request
   │
   ▼
http-logger ──▶ body parsers ──▶ admin auth ──▶ controller
                                                 │  parseBody / parseQuery
                                                 ▼
                                            use case
                                                 │
                                                 ▼
                                    port (UnitOfWork, MessagingPort…)
                                                 │
                                                 ▼
                                       outbound adapter (Postgres, Telegram)
```

## Composition root

`src/bootstrap/container.ts` is the only module that knows every concrete
implementation. It builds them and exposes two things:

- `AppContainer` — the wired application, used by the worker and the CLI;
- `createHttpApiDependencies(container)` — the narrow dependency set of the
  HTTP adapter.

The HTTP entrypoint (`src/bootstrap/http.ts`) is three lines of wiring:

```ts
const config = loadConfig();
const container = createAppContainer(config);
const app = createHttpApi(createHttpApiDependencies(container));
```

## Shared workflows belong to the application

Workflows used by more than one driver — such as "synchronize the university
snapshot and generate occurrences" — are application use cases, not helpers
of the composition root. `SyncAcademicTerm` is used by the HTTP admin API, the
background worker, and the CLI, and depends only on other use cases and on
the `UnitOfWork` port.

## Adding an endpoint

1. Add or reuse a Zod schema in `api/contracts/`.
2. Add the route to `api/route-manifest.ts` with its operation id and auth
   mode.
3. Implement the handler in the matching controller and return it under the
   operation id.
4. Document the operation in `api/openapi.ts`.
5. Regenerate the specification: `pnpm api:generate`.
6. Add a contract test under `tests/adapters/inbound/http/`.

The manifest, the OpenAPI document, and the committed `docs/openapi.json`
are checked against each other by `api-contract.test.ts`, so a missing step
fails the build.
