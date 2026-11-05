import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAdminAuthMiddleware } from '../../../../src/adapters/inbound/http/middleware/admin-auth.js';
import { createErrorHandler } from '../../../../src/adapters/inbound/http/middleware/error-handler.js';
import { createHttpLogger } from '../../../../src/adapters/inbound/http/middleware/http-logger.js';
import { notFoundHandler } from '../../../../src/adapters/inbound/http/middleware/not-found.js';
import type { AppConfig } from '../../../../src/config/env.js';

type ExpressApp = ReturnType<typeof express>;
type LogConfig = AppConfig['log'];

interface LogLine {
	level: number;
	msg: string;
	reqId?: string;
	req?: Record<string, unknown>;
	res?: { statusCode?: number; contentType?: unknown; contentLength?: unknown };
	responseTime?: number;
	err?: { name?: string; message?: string; stack?: string };
	route?: string;
	body?: unknown;
	bodyOmittedReason?: string;
	userId?: string;
	upstreamRequestId?: string;
	completed?: boolean;
	[key: string]: unknown;
}

interface TestAppOptions {
	log?: Partial<LogConfig>;
	/** Level of the underlying pino instance (LOG_LEVEL equivalent). */
	loggerLevel?: 'debug' | 'info' | 'warn';
	/** Extra middleware mounted after the body parsers, before the routes. */
	configure?: (app: ExpressApp) => void;
}

// The admin middleware only reads the configured token.
const adminToken = 'test-admin-token';

function createTestApp(options: TestAppOptions = {}) {
	const lines: LogLine[] = [];
	const sink = new Writable({
		write(
			chunk: unknown,
			_encoding: string,
			callback: (error?: Error | null) => void,
		): void {
			lines.push(JSON.parse(String(chunk)) as LogLine);
			callback();
		},
	});
	const logger = pino({ level: options.loggerLevel ?? 'debug' }, sink);
	const logConfig: LogConfig = {
		level: 'debug',
		pretty: false,
		requestBody: true,
		bodyMaxLength: 2048,
		...options.log,
	};

	const app = express();
	app.use(createHttpLogger({ pino: logger, log: logConfig }));
	app.use(express.json({ limit: '1mb' }));
	app.use(express.urlencoded({ extended: true }));

	options.configure?.(app);

	app.post('/api/things', (_request, response) => {
		response.status(201).json({ created: true });
	});
	app.get('/api/echo', (_request, response) => {
		response.json({ ok: true });
	});
	app.get('/api/boom', (_request, _response, next) => {
		next(new Error('kaboom'));
	});
	app.get('/api/async-boom', async () => {
		throw new Error('async failure');
	});
	app.get('/api/route-log', (request, response) => {
		request.log.info({ note: 'inside' }, 'route log');
		response.json({ ok: true });
	});

	app.use('/api/admin', createAdminAuthMiddleware(adminToken));
	app.get('/api/admin/data', (_request, response) => {
		response.json({ ok: true });
	});

	app.use(notFoundHandler);
	app.use(createErrorHandler());

	return { app, lines };
}

/** Lets the response-finish log write land in the collector. */
async function settle(): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, 5);
	});
}

function completionLine(lines: LogLine[]): LogLine {
	const line = lines.find((entry) => entry.msg === 'request completed');
	expect(line, 'expected a "request completed" log line').toBeDefined();
	return line as LogLine;
}

function statusLine(lines: LogLine[], statusCode: number): LogLine {
	const line = lines.find((entry) => entry.res?.statusCode === statusCode);
	expect(line, `expected a log line with status ${statusCode}`).toBeDefined();
	return line as LogLine;
}

describe('HTTP request logging', () => {
	it('logs successful requests with request, client, and response context', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app)
			.post('/api/things?limit=10&token=secret-token')
			.set('Cookie', 'sid=abc123')
			.set('Authorization', 'Bearer super-secret')
			.set('User-Agent', 'vitest-agent/1.0')
			.set('Referer', 'https://example.com/start')
			.set('Origin', 'https://example.com')
			.send({ name: 'alice', password: 'hunter2', profile: { apiKey: 'key-1' } });
		await settle();

		expect(response.status).toBe(201);
		const headerId = response.headers['x-request-id'];
		expect(headerId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);

		const line = completionLine(lines);
		expect(line.level).toBe(30);
		expect(line.reqId).toBe(headerId);
		expect(line.completed).toBe(true);
		expect(line.route).toBe('/api/things');
		expect(typeof line.responseTime).toBe('number');
		expect(line.res?.statusCode).toBe(201);
		expect(line.res?.contentType).toBe('application/json; charset=utf-8');
		expect(line.res?.contentLength).toBeDefined();

		const req = line.req as Record<string, unknown>;
		expect(req.method).toBe('POST');
		expect(req.path).toBe('/api/things');
		// The query string is rebuilt from redacted values.
		expect(req.url).toBe('/api/things?limit=10&token=[REDACTED]');
		expect(req.httpVersion).toBe('1.1');
		expect(req.userAgent).toBe('vitest-agent/1.0');
		expect(req.referer).toBe('https://example.com/start');
		expect(req.origin).toBe('https://example.com');
		expect(typeof req.remoteAddress).toBe('string');
		expect(typeof req.remotePort).toBe('number');
		expect(typeof req.ip).toBe('string');
		expect(Array.isArray(req.ips)).toBe(true);
		expect(req.headers).toMatchObject({
			cookie: '[REDACTED]',
			authorization: '[REDACTED]',
			'content-type': 'application/json',
		});
		expect(req.query).toMatchObject({ limit: '10', token: '[REDACTED]' });

		expect(line.body).toEqual({
			name: 'alice',
			password: '[REDACTED]',
			profile: { apiKey: '[REDACTED]' },
		});

		const serialized = JSON.stringify(lines);
		expect(serialized).not.toContain('hunter2');
		expect(serialized).not.toContain('super-secret');
		expect(serialized).not.toContain('abc123');
		expect(serialized).not.toContain('key-1');
		expect(serialized).not.toContain('secret-token');
	});

	it('logs a debug line when the logger level allows it', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app).get('/api/echo');
		await settle();

		expect(response.status).toBe(200);
		const line = lines.find((entry) => entry.msg === 'request received');
		expect(line).toBeDefined();
		expect(line?.level).toBe(20);
		expect(line?.reqId).toBe(response.headers['x-request-id']);
	});

	it('suppresses debug output when the level is info', async () => {
		const { app, lines } = createTestApp({ loggerLevel: 'info' });

		await supertest(app).get('/api/echo');
		await settle();

		expect(lines.some((entry) => entry.msg === 'request received')).toBe(false);
		expect(lines.some((entry) => entry.msg === 'request completed')).toBe(true);
	});

	it('logs 404 responses at warn level', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app).get('/does-not-exist');
		await settle();

		expect(response.status).toBe(404);
		expect(response.headers['x-request-id']).toBeDefined();

		const line = completionLine(lines);
		expect(line.level).toBe(40);
		expect(line.res?.statusCode).toBe(404);
		expect(line.reqId).toBe(response.headers['x-request-id']);
		expect('route' in line).toBe(false);
	});

	it('logs authentication failures at warn level with the request id', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app)
			.get('/api/admin/data')
			.set('Authorization', 'Bearer wrong-token');
		await settle();

		expect(response.status).toBe(401);

		const line = statusLine(lines, 401);
		expect(line.level).toBe(40);
		expect(line.reqId).toBe(response.headers['x-request-id']);
		expect(JSON.stringify(lines)).not.toContain('wrong-token');
	});

	it('logs a 500 error exactly once, with the error tied to the request id', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app).get('/api/boom');
		await settle();

		expect(response.status).toBe(500);
		expect(response.body.error.code).toBe('INTERNAL_ERROR');

		const errorLines = lines.filter((entry) => entry.level >= 50);
		expect(errorLines).toHaveLength(1);

		const line = errorLines[0] as LogLine;
		expect(line.msg).toBe('request failed');
		expect(line.reqId).toBe(response.headers['x-request-id']);
		expect(line.res?.statusCode).toBe(500);
		expect(line.route).toBe('/api/boom');
		expect(line.completed).toBe(true);
		expect(line.err?.name).toBe('Error');
		expect(line.err?.message).toBe('kaboom');
		expect(line.err?.stack).toContain('kaboom');

		// No duplicate error entry anywhere else in the log stream.
		expect(
			lines.filter((entry) => JSON.stringify(entry).includes('kaboom')),
		).toHaveLength(1);
	});

	it('logs errors thrown by async route handlers', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app).get('/api/async-boom');
		await settle();

		expect(response.status).toBe(500);

		const line = statusLine(lines, 500);
		expect(line.level).toBe(50);
		expect(line.err?.message).toBe('async failure');
		expect(line.reqId).toBe(response.headers['x-request-id']);
	});

	it('logs requests that fail during body parsing', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app)
			.post('/api/things')
			.set('Content-Type', 'application/json')
			.send('{"broken":');
		await settle();

		expect(response.status).toBe(400);

		const line = statusLine(lines, 400);
		expect(line.level).toBe(40);
		expect(line.err?.name).toBe('SyntaxError');
		expect(line.reqId).toBe(response.headers['x-request-id']);
		// Routing never ran for this request, so no route pattern is logged.
		expect('route' in line).toBe(false);
	});

	it('correlates route logs with the request id', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app).get('/api/route-log');
		await settle();

		const headerId = response.headers['x-request-id'];
		const routeLine = lines.find((entry) => entry.msg === 'route log');
		expect(routeLine?.reqId).toBe(headerId);
		expect(completionLine(lines).reqId).toBe(headerId);
	});

	it('keeps an upstream request id separate from the generated one', async () => {
		const { app, lines } = createTestApp();

		const response = await supertest(app)
			.get('/api/echo')
			.set('X-Request-Id', 'upstream-42');
		await settle();

		expect(response.headers['x-request-id']).not.toBe('upstream-42');
		expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

		const line = completionLine(lines);
		expect(line.upstreamRequestId).toBe('upstream-42');
		expect(line.reqId).toBe(response.headers['x-request-id']);
	});

	it('includes the authenticated user id when one is attached', async () => {
		const { app, lines } = createTestApp({
			configure: (instance) => {
				instance.use((request, _response, next) => {
					const authenticated = request as express.Request & {
						user?: { id: string };
					};
					authenticated.user = { id: 'user-7' };
					next();
				});
			},
		});

		await supertest(app).get('/api/echo');
		await settle();

		expect(completionLine(lines).userId).toBe('user-7');
	});

	it('logs URL-encoded bodies with sensitive fields redacted', async () => {
		const { app, lines } = createTestApp();

		await supertest(app)
			.post('/api/things')
			.type('form')
			.send({ username: 'bob', password: 'p@ss' });
		await settle();

		expect(completionLine(lines).body).toEqual({
			username: 'bob',
			password: '[REDACTED]',
		});
	});

	it('truncates oversized request bodies', async () => {
		const { app, lines } = createTestApp({ log: { bodyMaxLength: 100 } });

		await supertest(app)
			.post('/api/things')
			.send({ blob: 'x'.repeat(500) });
		await settle();

		const body = completionLine(lines).body;
		expect(typeof body).toBe('string');
		expect(body as string).toContain('[truncated');
	});

	it('omits bodies entirely when LOG_REQUEST_BODY is disabled', async () => {
		const { app, lines } = createTestApp({ log: { requestBody: false } });

		await supertest(app)
			.post('/api/things')
			.send({ name: 'alice', password: 'hunter2' });
		await settle();

		const line = completionLine(lines);
		expect('body' in line).toBe(false);
		expect('bodyOmittedReason' in line).toBe(false);
		expect(JSON.stringify(lines)).not.toContain('hunter2');
	});

	it('never logs multipart file contents', async () => {
		const { app, lines } = createTestApp();
		const boundary = '----vitestboundary';
		const payload =
			`--${boundary}\r\n` +
			'Content-Disposition: form-data; name="file"; filename="notes.txt"\r\n' +
			'Content-Type: text/plain\r\n\r\n' +
			'TOP-SECRET-FILE-CONTENT\r\n' +
			`--${boundary}--\r\n`;

		await supertest(app)
			.post('/api/things')
			.set('Content-Type', `multipart/form-data; boundary=${boundary}`)
			.send(payload);
		await settle();

		expect(completionLine(lines)).toBeDefined();
		expect(JSON.stringify(lines)).not.toContain('TOP-SECRET-FILE-CONTENT');
		expect(JSON.stringify(lines)).not.toContain('notes.txt');
	});

	it('flags binary bodies instead of logging them', async () => {
		const { app, lines } = createTestApp({
			configure: (instance) => {
				instance.use((request, _response, next) => {
					if (request.headers['content-type'] === 'application/octet-stream') {
						request.body = Buffer.from('raw-binary-payload');
					}
					next();
				});
			},
		});

		await supertest(app)
			.post('/api/things')
			.set('Content-Type', 'application/octet-stream')
			.send(Buffer.from('raw-binary-payload'));
		await settle();

		const line = completionLine(lines);
		expect('body' in line).toBe(false);
		expect(line.bodyOmittedReason).toBe('binary body');
		expect(JSON.stringify(lines)).not.toContain('raw-binary-payload');
	});
});
