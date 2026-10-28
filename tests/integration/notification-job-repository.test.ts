import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresConnection } from '../../src/adapters/outbound/persistence/postgres/db.js';
import { PostgresNotificationJobRepository } from '../../src/adapters/outbound/persistence/postgres/notification-job-repository.js';
import {
	NotificationJob,
	NotificationJobStatus,
	NotificationType,
} from '../../src/domain/notifications/notification-job.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('PostgresNotificationJobRepository', () => {
	const connection = databaseUrl
		? createPostgresConnection({ connectionString: databaseUrl, max: 4 })
		: null;
	const repository = connection
		? new PostgresNotificationJobRepository(connection.db)
		: null;

	const now = new Date('2026-01-10T00:00:00.000Z');

	beforeAll(async () => {
		if (!connection) return;
		await migrate(connection.db, { migrationsFolder: 'drizzle' });
	});

	afterAll(async () => {
		await connection?.pool.end();
	});

	function buildJob(
		overrides: Partial<Parameters<typeof NotificationJob.create>[0]> = {},
	) {
		return NotificationJob.create({
			id: crypto.randomUUID(),
			type: NotificationType.ClassReminder,
			userId: crypto.randomUUID(),
			recipientIdentityId: crypto.randomUUID(),
			dueAt: now,
			idempotencyKey: `key-${crypto.randomUUID()}`,
			createdAt: now,
			...overrides,
		});
	}

	it('creates a job once per idempotency key', async () => {
		if (!repository) return;

		const job = buildJob();
		const first = await repository.enqueue(job);
		const second = await repository.enqueue(job);

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.job.id).toBe(job.id);
		expect(second.job.status).toBe(NotificationJobStatus.Pending);
	});

	it('claims due jobs and marks them as sent', async () => {
		if (!repository) return;

		const job = buildJob({ dueAt: now });
		await repository.enqueue(job);

		const claimed = await repository.claimDue({
			now,
			workerId: 'worker-1',
			limit: 10,
			lockTimeoutMs: 60_000,
		});

		expect(claimed.map((entry) => entry.id)).toContain(job.id);

		const claimedJob = claimed.find((entry) => entry.id === job.id);
		expect(claimedJob?.status).toBe(NotificationJobStatus.Claimed);
		expect(claimedJob?.lockedBy).toBe('worker-1');

		const sent = claimedJob?.markSent(now);
		expect(sent).toBeDefined();
		if (!sent) return;

		await repository.save(sent);

		const reloaded = await repository.findById(job.id);
		expect(reloaded?.status).toBe(NotificationJobStatus.Sent);
		expect(reloaded?.attempts).toBe(1);
	});

	it('does not claim jobs that are not due yet', async () => {
		if (!repository) return;

		const job = buildJob({ dueAt: new Date(now.getTime() + 3_600_000) });
		await repository.enqueue(job);

		const claimed = await repository.claimDue({
			now,
			workerId: 'worker-1',
			limit: 50,
			lockTimeoutMs: 60_000,
		});

		expect(claimed.map((entry) => entry.id)).not.toContain(job.id);
	});

	it('cancels pending jobs for a selection', async () => {
		if (!repository) return;

		const selectionId = crypto.randomUUID();
		const job = buildJob({
			selectionId,
			subscriptionId: null,
			dueAt: now,
		});
		await repository.enqueue(job);

		const cancelled = await repository.cancelPendingBySelection(
			selectionId,
			now,
			'SELECTION_UPDATED',
		);

		expect(cancelled).toBe(1);

		const reloaded = await repository.findById(job.id);
		expect(reloaded?.status).toBe(NotificationJobStatus.Cancelled);
		expect(reloaded?.lastError).toBe('SELECTION_UPDATED');
	});
});
