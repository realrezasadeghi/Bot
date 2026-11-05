import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import {
	ErrorEnvelopeSchema,
	HealthResponseSchema,
} from '../../../../src/adapters/inbound/http/api/contracts/index.js';
import { createHttpApi } from '../../../../src/adapters/inbound/http/http-api.js';
import { createFakeHttpDependencies } from '../../../fixtures/http-api-dependencies.js';

describe('GET /api/health', () => {
	it('returns ok when the database is reachable', async () => {
		const { dependencies } = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(dependencies)).get(
			'/api/health',
		);

		expect(response.status).toBe(200);
		expect(HealthResponseSchema.parse(response.body)).toEqual({
			status: 'ok',
		});
	});

	it('returns 500 when the database is unreachable', async () => {
		const { dependencies, repositories } = createFakeHttpDependencies();
		repositories.academic.listLevels.mockRejectedValueOnce(
			new Error('database down'),
		);

		const response = await supertest(createHttpApi(dependencies)).get(
			'/api/health',
		);

		expect(response.status).toBe(500);
		const body = ErrorEnvelopeSchema.parse(response.body);
		expect(body.error.code).toBe('INTERNAL_ERROR');
		expect(body.error.message).toBe('database down');
	});
});
