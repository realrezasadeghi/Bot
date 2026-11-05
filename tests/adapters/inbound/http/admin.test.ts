import supertest from 'supertest';
import { describe, expect, it } from 'vitest';
import {
	DispatchResponseSchema,
	ErrorEnvelopeSchema,
	LatestSyncRunResponseSchema,
	OccurrencesResponseSchema,
	ScheduleNotificationsResponseSchema,
	SyncResponseSchema,
} from '../../../../src/adapters/inbound/http/api/contracts/index.js';
import { createHttpApi } from '../../../../src/adapters/inbound/http/http-api.js';
import { createFakeHttpDependencies } from '../../../fixtures/http-api-dependencies.js';

const adminToken = 'Bearer test-admin-token';

describe('admin routes', () => {
	it('POST /api/admin/sync returns the synchronization result', async () => {
		const fixture = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/admin/sync')
			.set('Authorization', adminToken);

		expect(response.status).toBe(200);
		const body = SyncResponseSchema.parse(response.body);
		expect(body.termId).toBe('term-1');
		expect(body.complete).toBe(true);
		expect(body.synchronization.status).toBe('COMPLETED');
		expect(fixture.syncAcademicTerm.execute).toHaveBeenCalledOnce();
	});

	it('POST /api/admin/occurrences rejects a missing termId', async () => {
		const { dependencies } = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(dependencies))
			.post('/api/admin/occurrences')
			.set('Authorization', adminToken)
			.send({});

		expect(response.status).toBe(400);
		const body = ErrorEnvelopeSchema.parse(response.body);
		expect(body.error.code).toBe('VALIDATION_ERROR');
		expect(body.error.details).toMatchObject({
			issues: [expect.stringContaining('termId')],
		});
	});

	it('POST /api/admin/occurrences rejects an invalid date', async () => {
		const { dependencies } = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(dependencies))
			.post('/api/admin/occurrences')
			.set('Authorization', adminToken)
			.send({ termId: 'term-1', from: 'not-a-date' });

		expect(response.status).toBe(400);
		expect(ErrorEnvelopeSchema.parse(response.body).error.code).toBe(
			'VALIDATION_ERROR',
		);
	});

	it('POST /api/admin/occurrences forwards valid input', async () => {
		const fixture = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/admin/occurrences')
			.set('Authorization', adminToken)
			.send({
				termId: 'term-1',
				from: '2026-01-01',
				to: '2026-01-31',
				reconcileAbsent: true,
			});

		expect(response.status).toBe(200);
		OccurrencesResponseSchema.parse(response.body);
		expect(fixture.generateClassOccurrences.execute).toHaveBeenCalledWith(
			expect.objectContaining({
				termId: 'term-1',
				from: expect.anything(),
				to: expect.anything(),
				reconcileAbsent: true,
			}),
		);
	});

	it('POST /api/admin/notifications/schedule forwards userId', async () => {
		const fixture = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/admin/notifications/schedule')
			.set('Authorization', adminToken)
			.send({ userId: 'user-1' });

		expect(response.status).toBe(200);
		ScheduleNotificationsResponseSchema.parse(response.body);
		expect(fixture.scheduleClassReminders.execute).toHaveBeenCalledWith({
			userId: 'user-1',
		});
		expect(fixture.generateDailySummaries.execute).toHaveBeenCalledWith({
			userId: 'user-1',
		});
	});

	it('POST /api/admin/notifications/schedule works without a body', async () => {
		const fixture = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(fixture.dependencies))
			.post('/api/admin/notifications/schedule')
			.set('Authorization', adminToken);

		expect(response.status).toBe(200);
		ScheduleNotificationsResponseSchema.parse(response.body);
		expect(fixture.scheduleClassReminders.execute).toHaveBeenCalledWith({
			userId: undefined,
		});
	});

	it('POST /api/admin/notifications/dispatch returns dispatch counters', async () => {
		const { dependencies } = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(dependencies))
			.post('/api/admin/notifications/dispatch')
			.set('Authorization', adminToken);

		expect(response.status).toBe(200);
		DispatchResponseSchema.parse(response.body);
	});

	it('GET /api/admin/sync-runs/latest uses the configured source key', async () => {
		const fixture = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(fixture.dependencies))
			.get('/api/admin/sync-runs/latest')
			.set('Authorization', adminToken);

		expect(response.status).toBe(200);
		const body = LatestSyncRunResponseSchema.parse(response.body);
		expect(body.syncRun?.id).toBe('sync-run-1');
		expect(fixture.repositories.syncRuns.findLatest).toHaveBeenCalledWith(
			'eqbal-portal',
		);
	});

	it('GET /api/admin/sync-runs/latest accepts a sourceKey query', async () => {
		const fixture = createFakeHttpDependencies();
		const response = await supertest(createHttpApi(fixture.dependencies))
			.get('/api/admin/sync-runs/latest?sourceKey=custom-source')
			.set('Authorization', adminToken);

		expect(response.status).toBe(200);
		expect(fixture.repositories.syncRuns.findLatest).toHaveBeenCalledWith(
			'custom-source',
		);
	});
});
