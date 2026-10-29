import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPostgresConnection } from '../../src/adapters/outbound/persistence/postgres/db.js';
import { PostgresNotificationJobRepository } from '../../src/adapters/outbound/persistence/postgres/notification-job-repository.js';
import { notificationJobs } from '../../src/adapters/outbound/persistence/postgres/schema.js';
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

	// Fixed fixture ids so foreign-key references resolve in a fresh database.
	const USER_ID = '11111111-1111-1111-1111-111111111111';
	const RECIPIENT_ID = '22222222-2222-2222-2222-222222222222';
	const SELECTION_ID = '33333333-3333-3333-3333-333333333333';

	beforeAll(async () => {
		if (!connection) return;
		await migrate(connection.db, { migrationsFolder: 'drizzle' });
		await connection.db.execute(sql`
			INSERT INTO users (id, display_name, time_zone, locale)
			VALUES (${USER_ID}, 'Test User', 'UTC', 'en-US')
			ON CONFLICT (id) DO NOTHING
		`);
		await connection.db.execute(sql`
			INSERT INTO platform_identities (id, user_id, platform, bot_scope, external_user_id)
			VALUES (${RECIPIENT_ID}, ${USER_ID}, 'TELEGRAM', 'telegram-main', 'ext-user')
			ON CONFLICT (id) DO NOTHING
		`);
		await connection.db.execute(sql`
			INSERT INTO student_academic_selections (id, user_id, is_active)
			VALUES (${SELECTION_ID}, ${USER_ID}, true)
			ON CONFLICT (id) DO NOTHING
		`);
	});

	afterAll(async () => {
		await connection?.pool.end();
	});

	beforeEach(async () => {
		if (!connection) return;
		await connection.db.delete(notificationJobs);
	});

	function buildJob(
		overrides: Partial<Parameters<typeof NotificationJob.create>[0]> = {},
	) {
		return NotificationJob.create({
			id: crypto.randomUUID(),
			type: NotificationType.ClassReminder,
			userId: USER_ID,
			recipientIdentityId: RECIPIENT_ID,
			subscriptionId: null,
			selectionId: SELECTION_ID,
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

		const job = buildJob({
			selectionId: SELECTION_ID,
			subscriptionId: null,
			dueAt: now,
		});
		await repository.enqueue(job);

		const cancelled = await repository.cancelPendingBySelection(
			SELECTION_ID,
			now,
			'SELECTION_UPDATED',
		);

		expect(cancelled).toBe(1);

		const reloaded = await repository.findById(job.id);
		expect(reloaded?.status).toBe(NotificationJobStatus.Cancelled);
		expect(reloaded?.lastError).toBe('SELECTION_UPDATED');
	});
});
