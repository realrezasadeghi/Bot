# Logging

Structured HTTP request logging built on [pino], [pino-http], and [pino-pretty].
Every request that reaches Express is logged exactly once, with a correlated
request id, redacted secrets, and level-by-status semantics.

[pino]: https://github.com/pinojs/pino
[pino-http]: https://github.com/pinojs/pino-http
[pino-pretty]: https://github.com/pinojs/pino-pretty

## Pipeline position

The HTTP logger is the **first** middleware in `createApp`
(`src/adapters/inbound/http/http-api.ts`), before the body parsers, routes, the 404 handler,
and the error handler:

```text
request ──▶ httpLogger ──▶ express.json / express.urlencoded ──▶ routes
                                                                     │
response ◀── pino-http completion line ◀── notFound / errorHandler ◀──┘
```

Consequences:

- All HTTP methods and all routes are logged, including 404s.
- Requests rejected by body parsing or authentication are logged.
- Response time is measured from the start of the request to response finish.
- The error handler runs inside the logger's window, so failures are captured.

## Request correlation

- Every request gets a server-generated UUID (`req.id`), returned in the
  `X-Request-Id` response header and recorded as `reqId` on every log line
  emitted for that request.
- `req.log` is a child logger bound to `reqId`; application logs written with
  it inherit the request id automatically:

  ```ts
  request.log.info({ userId }, 'processed webhook');
  ```

- An upstream `X-Request-Id` header is preserved separately as
  `upstreamRequestId` — the server always generates its own id.

## One line per request

A single line is emitted when the response finishes
(`request completed`, `request aborted`, or `request failed`). Levels follow
the response status:

| Status           | Level   | Message             |
| ---------------- | ------- | ------------------- |
| 2xx / 3xx        | `info`  | `request completed` |
| 4xx              | `warn`  | `request completed` |
| 5xx              | `error` | `request failed`    |
| response failure | `error` | `request failed`    |

A debug line (`request received`) is also emitted when `LOG_LEVEL=debug`,
which makes requests that never complete visible.

### Logged fields

**Request** (`req`)

| Field                                           | Notes                                                   |
| ----------------------------------------------- | ------------------------------------------------------- |
| `method`, `url`, `path`                         | `url` has its query string rebuilt from redacted values |
| `route`                                         | matched route pattern (absent for 404s)                 |
| `query`                                         | redacted                                                |
| `headers`                                       | all headers, redacted                                   |
| `contentType`, `userAgent`, `referer`, `origin` | convenience copies of headers                           |
| `httpVersion`                                   | e.g. `1.1`                                              |
| `ip`, `ips`                                     | `ips` is populated only when `trust proxy` is on        |
| `remoteAddress`, `remotePort`                   | socket address                                          |

**Client / correlation** (top level): `reqId`, `upstreamRequestId`, `userId`
(when an authentication middleware attaches a user object).

**Response** (`res`): `statusCode`, `contentType`, `contentLength` — plus
`responseTime` (milliseconds) and `completed`.

**Error** (`err`): `name`, `message`, `stack`, plus `code`/`cause` when
present — serialized by `serializeError`, the same serializer the error
handler used before.

## Error logging

`createErrorHandler` maps the error to a status, attaches it to
`response.err`, and returns the JSON error body. When the response finishes,
pino-http emits **one** line containing the serialized error together with
the request id, method, path, status, and duration.

This is deliberate: logging the error in the error middleware _and_ in the
completion line would duplicate every error entry. Validation errors,
authentication failures, async handler rejections, body-parse failures, and
unexpected 500s all flow through this path.

## Request body logging

Controlled by `LOG_REQUEST_BODY` and `LOG_BODY_MAX_LENGTH`:

- Parsed bodies are read **when the response finishes**, so the logger works
  even though it runs before the body parsers.
- JSON, `+json`, URL-encoded, and `text/*` bodies are logged.
- Bodies larger than `LOG_BODY_MAX_LENGTH` characters are truncated with a
  `...[truncated N chars]` marker.
- Binary, streamed, multipart, and other non-text payloads are **never**
  logged (`bodyOmittedReason` records why).
- Response bodies are never logged.
- Bodies are deep-redacted before logging.

### Redaction

Keys are matched case- and separator-insensitively (`accessToken`,
`access_token`, and `Access-Token` are equivalent). The value is replaced
with `[REDACTED]` in **headers, query parameters, and request bodies**, at
any nesting depth, including arrays:

`password`, `currentPassword`, `newPassword`, `authorization`, `cookie`,
`token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `cardNumber`,
`cvv`, plus `set-cookie`, `proxy-authorization`, `x-api-key`, `x-auth-token`,
`x-csrf-token`, `x-webhook-secret`, and `x-telegram-bot-api-secret-token`.

The list lives in `src/adapters/inbound/http/logging/redaction.ts`.

## Configuration

| Variable              | Default                                          | Purpose                               |
| --------------------- | ------------------------------------------------ | ------------------------------------- |
| `NODE_ENV`            | `development`                                    | selects pretty vs. JSON output        |
| `LOG_LEVEL`           | `info`                                           | pino level: `fatal`…`trace`, `silent` |
| `LOG_PRETTY`          | `true` outside production                        | force pino-pretty on/off              |
| `LOG_REQUEST_BODY`    | `true` outside production, `false` in production | log parsed request bodies             |
| `LOG_BODY_MAX_LENGTH` | `2048`                                           | body truncation length (characters)   |

### Development

`pino-pretty` with colored, human-readable output and timestamps
(`LOG_PRETTY=true`, the default outside production).

### Production

Plain JSON on stdout — no pino-pretty (it is hard-disabled when
`NODE_ENV=production`, even if `LOG_PRETTY=true`). The output works directly
with Docker/Kubernetes log drivers, Loki, and ELK:

```json
{"level":30,"time":"2026-11-04T12:00:00.000Z","reqId":"…","req":{"method":"POST","path":"/api/things",…},"res":{"statusCode":201,…},"responseTime":7,"route":"/api/things","completed":true,"msg":"request completed"}
```

## Security notes for production

- **Body logging is off by default in production.** Enable it explicitly
  (`LOG_REQUEST_BODY=true`) only after reviewing what your endpoints accept;
  bodies may contain personal data even after redaction.
- Redaction is key-based: values under non-sensitive keys are logged as-is.
  Do not put secrets in innocuously named fields.
- Raw query strings never reach the log: `req.url` is rebuilt from the
  redacted query object.
- Forwarded client IPs (`req.ips`) appear only when Express `trust proxy` is
  configured; enabling it is an infrastructure decision and is not done here.
- Log lines are JSON-encoded by pino, which escapes control characters and
  prevents log injection through request data.

## Extending

- **Add a sensitive key**: append its normalized form to `SENSITIVE_KEYS` in
  `src/adapters/inbound/http/logging/redaction.ts` and add a case in
  `tests/adapters/inbound/http/redaction.test.ts`.
- **Log extra request context**: add fields in `completionProps`
  (`src/adapters/inbound/http/middleware/http-logger.ts`) — they are evaluated at
  response finish, after routing, parsing, and authentication.
- **Change levels**: adjust `levelFor` in the same file.
