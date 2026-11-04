import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

describe('logging configuration', () => {
	it('enables request body logging by default outside production', () => {
		expect(loadConfig({}).log.requestBody).toBe(true);
		expect(loadConfig({ NODE_ENV: 'test' }).log.requestBody).toBe(true);
		expect(loadConfig({ NODE_ENV: 'development' }).log.requestBody).toBe(true);
	});

	it('disables request body logging in production unless explicitly enabled', () => {
		expect(loadConfig({ NODE_ENV: 'production' }).log.requestBody).toBe(false);
		expect(
			loadConfig({ NODE_ENV: 'production', LOG_REQUEST_BODY: 'true' }).log
				.requestBody,
		).toBe(true);
		expect(
			loadConfig({ NODE_ENV: 'development', LOG_REQUEST_BODY: 'false' }).log
				.requestBody,
		).toBe(false);
	});

	it('defaults the body truncation length to 2048 characters', () => {
		expect(loadConfig({}).log.bodyMaxLength).toBe(2048);
		expect(loadConfig({ LOG_BODY_MAX_LENGTH: '512' }).log.bodyMaxLength).toBe(
			512,
		);
	});

	it('rejects an invalid body truncation length', () => {
		expect(() => loadConfig({ LOG_BODY_MAX_LENGTH: 'nope' })).toThrow(
			/LOG_BODY_MAX_LENGTH/,
		);
	});

	it('keeps LOG_LEVEL and pretty-printing behaviour unchanged', () => {
		expect(loadConfig({}).log.level).toBe('info');
		expect(loadConfig({ LOG_LEVEL: 'debug' }).log.level).toBe('debug');
		expect(loadConfig({}).log.pretty).toBe(true);
		expect(loadConfig({ NODE_ENV: 'production' }).log.pretty).toBe(false);
	});
});
