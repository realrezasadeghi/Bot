import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

describe('API documentation configuration', () => {
	it('enables docs by default outside production', () => {
		expect(loadConfig({}).http.apiDocs.enabled).toBe(true);
		expect(loadConfig({ NODE_ENV: 'test' }).http.apiDocs.enabled).toBe(true);
		expect(loadConfig({ NODE_ENV: 'development' }).http.apiDocs.enabled).toBe(
			true,
		);
	});

	it('disables docs in production unless explicitly enabled', () => {
		expect(loadConfig({ NODE_ENV: 'production' }).http.apiDocs.enabled).toBe(
			false,
		);
		expect(
			loadConfig({ NODE_ENV: 'production', API_DOCS_ENABLED: 'true' }).http.apiDocs
				.enabled,
		).toBe(true);
		expect(
			loadConfig({ NODE_ENV: 'development', API_DOCS_ENABLED: 'false' }).http
				.apiDocs.enabled,
		).toBe(false);
	});

	it('uses the default docs paths', () => {
		const { apiDocs } = loadConfig({}).http;

		expect(apiDocs.path).toBe('/api/docs');
		expect(apiDocs.openapiPath).toBe('/api/openapi.json');
	});

	it('rejects paths that do not start with a slash', () => {
		expect(() => loadConfig({ API_DOCS_PATH: 'api/docs' })).toThrow(
			/API_DOCS_PATH/,
		);
		expect(() => loadConfig({ API_OPENAPI_PATH: 'openapi.json' })).toThrow(
			/API_OPENAPI_PATH/,
		);
	});
});
