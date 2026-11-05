import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import { ErrorEnvelopeSchema } from '../../../../src/adapters/inbound/http/api/contracts/index.js';
import { createHttpApi } from '../../../../src/adapters/inbound/http/http-api.js';
import { createFakeHttpDependencies } from '../../../fixtures/http-api-dependencies.js';

describe('admin authentication', () => {
	it('returns 503 when ADMIN_API_TOKEN is not configured', async () => {
		const { dependencies } = createFakeHttpDependencies({
			adminApiToken: null,
		});

		const response = await supertest(createHttpApi(dependencies)).post(
			'/api/admin/sync',
		);

		expect(response.status).toBe(503);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe(
			'ADMIN_DISABLED',
		);
	});

	it('returns 401 when the Authorization header is missing', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies)).post(
			'/api/admin/sync',
		);

		expect(response.status).toBe(401);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe(
			'UNAUTHORIZED',
		);
	});

	it('returns 401 when the token is wrong', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies))
			.post('/api/admin/sync')
			.set('Authorization', 'Bearer wrong-token');

		expect(response.status).toBe(401);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe(
			'UNAUTHORIZED',
		);
	});

	it('allows the request when the token is correct', async () => {
		const { dependencies } = createFakeHttpDependencies();

		const response = await supertest(createHttpApi(dependencies))
			.post('/api/admin/sync')
			.set('Authorization', 'Bearer test-admin-token');

		expect(response.status).toBe(200);
	});
});
