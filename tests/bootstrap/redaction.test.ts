import { describe, expect, it } from 'vitest';
import {
	captureRequestBody,
	isSensitiveKey,
	REDACTED,
	redact,
} from '../../src/bootstrap/logging/redaction.js';

describe('redact', () => {
	it('redacts sensitive properties at any depth', () => {
		const result = redact({
			name: 'alice',
			password: 'hunter2',
			profile: {
				currentPassword: 'old',
				newPassword: 'new',
				settings: { apiKey: 'key-1', theme: 'dark' },
			},
		});

		expect(result).toEqual({
			name: 'alice',
			password: REDACTED,
			profile: {
				currentPassword: REDACTED,
				newPassword: REDACTED,
				settings: { apiKey: REDACTED, theme: 'dark' },
			},
		});
	});

	it('redacts inside arrays', () => {
		const result = redact({
			tokens: [{ accessToken: 'a' }, { refreshToken: 'b' }],
			list: ['plain', { secret: 's' }],
		});

		expect(result).toEqual({
			tokens: [{ accessToken: REDACTED }, { refreshToken: REDACTED }],
			list: ['plain', { secret: REDACTED }],
		});
	});

	it('normalizes key spellings when matching', () => {
		expect(isSensitiveKey('password')).toBe(true);
		expect(isSensitiveKey('Password')).toBe(true);
		expect(isSensitiveKey('access_token')).toBe(true);
		expect(isSensitiveKey('X-Api-Key')).toBe(true);
		expect(isSensitiveKey('Authorization')).toBe(true);
		expect(isSensitiveKey('set-cookie')).toBe(true);
		expect(isSensitiveKey('x-telegram-bot-api-secret-token')).toBe(true);
		expect(isSensitiveKey('user-agent')).toBe(false);
		expect(isSensitiveKey('tokenizer')).toBe(false);
	});

	it('redacts card data and webhook secret headers', () => {
		const result = redact({
			cardNumber: '4111111111111111',
			cvv: '123',
			headers: {
				'x-webhook-secret': 'hook-secret',
				'x-telegram-bot-api-secret-token': 'tg-secret',
			},
		});

		expect(result).toEqual({
			cardNumber: REDACTED,
			cvv: REDACTED,
			headers: {
				'x-webhook-secret': REDACTED,
				'x-telegram-bot-api-secret-token': REDACTED,
			},
		});
	});

	it('does not mutate the original value', () => {
		const original = { password: 'hunter2', nested: { token: 't' } };
		redact(original);

		expect(original).toEqual({ password: 'hunter2', nested: { token: 't' } });
	});

	it('replaces binary payloads and dates', () => {
		expect(redact({ file: Buffer.from('bytes') })).toEqual({
			file: '[BINARY]',
		});
		expect(redact({ at: new Date('2026-01-02T03:04:05.000Z') })).toEqual({
			at: '2026-01-02T03:04:05.000Z',
		});
	});

	it('stops recursing at the maximum depth', () => {
		const deep: Record<string, unknown> = { leaf: 'value' };
		let cursor: Record<string, unknown> = deep;
		for (let level = 0; level < 15; level += 1) {
			const next: Record<string, unknown> = {};
			cursor.child = next;
			cursor = next;
		}

		expect(JSON.stringify(redact(deep))).toContain('max depth exceeded');
	});
});

describe('captureRequestBody', () => {
	it('returns nothing when body logging is disabled', () => {
		expect(
			captureRequestBody({ password: 'x' }, 'application/json', {
				enabled: false,
				maxLength: 2048,
			}),
		).toEqual({});
	});

	it('returns nothing when there is no parsed body', () => {
		expect(
			captureRequestBody(undefined, undefined, {
				enabled: true,
				maxLength: 2048,
			}),
		).toEqual({});
	});

	it('logs JSON bodies structured and redacted when they fit', () => {
		const result = captureRequestBody(
			{ username: 'bob', password: 'p@ss' },
			'application/json; charset=utf-8',
			{ enabled: true, maxLength: 2048 },
		);

		expect(result).toEqual({
			body: { username: 'bob', password: REDACTED },
		});
	});

	it('supports URL-encoded content types', () => {
		const result = captureRequestBody(
			{ username: 'bob', password: 'p@ss' },
			'application/x-www-form-urlencoded',
			{ enabled: true, maxLength: 2048 },
		);

		expect(result).toEqual({
			body: { username: 'bob', password: REDACTED },
		});
	});

	it('truncates bodies larger than the configured maximum', () => {
		const result = captureRequestBody(
			{ blob: 'x'.repeat(500) },
			'application/json',
			{ enabled: true, maxLength: 100 },
		);

		expect(typeof result.body).toBe('string');
		const body = result.body as string;
		expect(body.startsWith('{"blob"')).toBe(true);
		expect(body).toContain('[truncated');
		expect(body.length).toBeLessThan(500);
	});

	it('never logs binary bodies', () => {
		expect(
			captureRequestBody(Buffer.from('file-bytes'), 'application/octet-stream', {
				enabled: true,
				maxLength: 2048,
			}),
		).toEqual({ bodyOmittedReason: 'binary body' });
	});

	it('never logs streamed bodies', () => {
		const stream = { pipe: () => undefined };
		expect(
			captureRequestBody(stream, 'multipart/form-data', {
				enabled: true,
				maxLength: 2048,
			}),
		).toEqual({ bodyOmittedReason: 'streamed body' });
	});

	it('omits unsupported content types such as multipart or XML', () => {
		expect(
			captureRequestBody({ file: 'data' }, 'multipart/form-data; boundary=x', {
				enabled: true,
				maxLength: 2048,
			}),
		).toEqual({ bodyOmittedReason: 'unsupported content type' });

		expect(
			captureRequestBody({ a: 1 }, 'application/xml', {
				enabled: true,
				maxLength: 2048,
			}),
		).toEqual({ bodyOmittedReason: 'unsupported content type' });
	});

	it('handles circular payloads safely', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		// The depth limit breaks the cycle, so the result stays serializable
		// and never throws.
		const result = captureRequestBody(circular, 'application/json', {
			enabled: true,
			maxLength: 2048,
		});

		expect(() => JSON.stringify(result)).not.toThrow();
		expect(JSON.stringify(result)).toContain('max depth exceeded');
	});

	it('falls back when the payload cannot be serialized at all', () => {
		const hostile = {
			toJSON() {
				throw new Error('nope');
			},
		};

		expect(
			captureRequestBody(hostile, 'application/json', {
				enabled: true,
				maxLength: 2048,
			}),
		).toEqual({ body: '[unserializable body]' });
	});
});
