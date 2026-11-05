import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { ErrorEnvelopeSchema } from '../../../../src/adapters/inbound/http/api/contracts/index.js';
import { createHttpApi } from '../../../../src/adapters/inbound/http/http-api.js';
import { createFakeHttpDependencies } from '../../../fixtures/http-api-dependencies.js';

describe('application-level behaviour', () => {
	it('returns 404 for an unknown route', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies)).get(
			'/does-not-exist',
		);

		expect(response.status).toBe(404);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe('NOT_FOUND');
	});

	it('returns 400 for malformed JSON', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies))
			.post('/api/admin/sync')
			.set('Content-Type', 'application/json')
			.send('{');

		expect(response.status).toBe(400);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe(
			'REQUEST_ERROR',
		);
	});

	it('serves the OpenAPI document', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies)).get(
			'/api/openapi.json',
		);

		expect(response.status).toBe(200);
		expect(response.body.openapi).toBe('3.1.0');
		expect(Object.keys(response.body.paths)).toContain('/api/health');
	});

	it('serves the Scalar API reference', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies)).get(
			'/api/docs',
		);

		expect(response.status).toBe(200);
		expect(response.headers['content-type']).toContain('text/html');
	});

	it('does not expose docs when disabled', async () => {
		const { dependencies } = createFakeHttpDependencies({
			apiDocsEnabled: false,
		});

		const response = await supertest(createHttpApi(dependencies)).get(
			'/api/openapi.json',
		);

		expect(response.status).toBe(404);
	});
});
