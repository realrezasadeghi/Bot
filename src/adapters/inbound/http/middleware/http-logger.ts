import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger as PinoLogger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from '../../../../config/env.js';
import { captureRequestBody, redact } from '../logging/redaction.js';
import { serializeError } from '../logging/serialize-error.js';

export interface HttpLoggerOptions {
	/** Raw pino instance shared with application logs (`container.pinoLogger`). */
	pino: PinoLogger;
	/** Logging configuration (`container.config.log`). */
	log: AppConfig['log'];
}

/**
 * Creates the HTTP request logging middleware.
 *
 * Must be registered as the first middleware so every request that reaches
 * Express is logged — regardless of method, route, or outcome (2xx/3xx at
 * info, 4xx at warn, 5xx at error), including requests later rejected by
 * body parsing, authentication, or the 404 handler.
 *
 * One log line is emitted per response and contains the request (method,
 * path, route pattern, query, redacted headers/body, protocol, client
 * address), the response (status, content type/length, duration, completion
 * status), the request id, and — when the error middleware handed one over
 * via `response.err` — the serialized error. Errors are logged exactly once.
 *
 * Request bodies are read when the response finishes, so the logger works
 * even though it runs before the body parsers.
 */
export function createHttpLogger({ pino, log }: HttpLoggerOptions) {
	const httpLogger = pinoHttp<Request, Response>({
		logger: pino,

		// Every log line for a request carries its id (`reqId`), while the
		// per-request `req.log` child stays free of the full request object.
		quietReqLogger: true,

		// Serializers receive the raw request/response/error objects; the
		// default wrappers would pre-serialize them first.
		wrapSerializers: false,

		genReqId: () => randomUUID(),

		// Level by status: 5xx (and response failures) at error, 4xx at warn,
		// everything else at info.
		customLogLevel: (_request, response, error) =>
			levelFor(response.statusCode, error),

		customSuccessMessage: (_request, response) =>
			response.writableEnded ? 'request completed' : 'request aborted',
		customErrorMessage: () => 'request failed',

		// Evaluated when the response finishes: the body parsers have run by
		// then, so parsed bodies, the matched route, and the authenticated
		// user are available here.
		customSuccessObject: (request, response, value) => ({
			...value,
			...completionProps(request, response, log),
		}),
		customErrorObject: (request, response, _error, value) => ({
			...value,
			...completionProps(request, response, log),
		}),

		serializers: {
			// Runs when the request starts: only start-time data is read here.
			req: (request) => serializeRequest(request),
			res: (response) => serializeResponse(response),
			err: (error) => serializeError(error),
		},
	});

	return function httpLoggingMiddleware(
		request: Request,
		response: Response,
		next: NextFunction,
	): void {
		httpLogger(request, response, () => {
			if (!response.getHeader('X-Request-Id')) {
				response.setHeader('X-Request-Id', String(request.id));
			}
			request.log.debug(
				{
					method: request.method,
					// Same redaction rule as the completion line: the query
					// string is rebuilt from redacted values.
					url: withRedactedQuery(request, redact(request.query)),
					httpVersion: request.httpVersion,
					remoteAddress: request.socket.remoteAddress,
				},
				'request received',
			);
			next();
		});
	};
}

function levelFor(
	statusCode: number,
	error: Error | undefined,
): 'error' | 'warn' | 'info' {
	if (statusCode >= 500) return 'error';
	if (statusCode >= 400) return 'warn';
	if (error !== undefined) return 'error';
	return 'info';
}

function serializeRequest(request: Request): Record<string, unknown> {
	const query = redact(request.query);
	return {
		method: request.method,
		// Original URL with its query string rebuilt from the redacted query
		// so raw `?token=...` values never reach the log.
		url: withRedactedQuery(request, query),
		path: request.path,
		query,
		headers: redact(request.headers),
		contentType: request.headers['content-type'],
		userAgent: request.headers['user-agent'],
		referer: request.headers.referer,
		origin: request.headers.origin,
		httpVersion: request.httpVersion,
		ip: request.ip,
		// Forwarded addresses — populated only when `trust proxy` is enabled.
		ips: request.ips,
		remoteAddress: request.socket.remoteAddress,
		remotePort: request.socket.remotePort,
	};
}

function withRedactedQuery(request: Request, query: unknown): string {
	const originalUrl = request.originalUrl || request.url || '';
	const path = originalUrl.split('?')[0] ?? originalUrl;
	if (typeof query !== 'object' || query === null) return path;

	const parts: string[] = [];
	for (const [key, value] of Object.entries(query)) {
		if (Array.isArray(value)) {
			for (const item of value) parts.push(`${key}=${String(item)}`);
		} else if (typeof value === 'object' && value !== null) {
			parts.push(`${key}=${JSON.stringify(value)}`);
		} else {
			parts.push(`${key}=${String(value)}`);
		}
	}
	return parts.length > 0 ? `${path}?${parts.join('&')}` : path;
}

function serializeResponse(response: Response): Record<string, unknown> {
	return {
		statusCode: response.statusCode,
		contentType: response.getHeader('content-type'),
		contentLength: response.getHeader('content-length'),
	};
}

function completionProps(
	request: Request,
	response: Response,
	log: AppConfig['log'],
): Record<string, unknown> {
	return {
		// Matched route pattern (absent for 404s).
		route: request.route?.path,
		userId: resolveUserId(request),
		// Upstream correlation id, kept separate from the server-generated one.
		upstreamRequestId: readUpstreamRequestId(request),
		completed: response.writableEnded,
		...captureRequestBody(request.body, request.headers['content-type'], {
			enabled: log.requestBody,
			maxLength: log.bodyMaxLength,
		}),
	};
}

/** Shapes an authentication middleware may attach to the request. */
interface RequestWithAuthContext extends Request {
	user?: { id?: unknown; sub?: unknown };
	auth?: { userId?: unknown };
	userId?: unknown;
}

/**
 * Reads the authenticated user id if the authentication middleware attached
 * one. Never mutates the request or authentication behaviour; returns
 * `undefined` when no user context exists.
 */
function resolveUserId(request: Request): string | undefined {
	const context = request as RequestWithAuthContext;
	const candidates = [
		context.user?.id,
		context.user?.sub,
		context.auth?.userId,
		context.userId,
	];
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.length > 0) {
			return candidate;
		}
		if (typeof candidate === 'number' && Number.isFinite(candidate)) {
			return String(candidate);
		}
	}
	return undefined;
}

function readUpstreamRequestId(request: Request): string | undefined {
	const value = request.headers['x-request-id'];
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : undefined;
}
