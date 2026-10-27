import { and, asc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import type {
	ClaimDueJobsInput,
	EnqueueResult,
	NotificationJobRepository,
} from '../../../../application/ports/outbound/notification-job-repository.js';
import type { DeliveryAttempt } from '../../../../domain/notifications/delivery-attempt.js';
import type { NotificationJob } from '../../../../domain/notifications/notification-job.js';
import { NotificationJobStatus } from '../../../../domain/notifications/notification-job.js';
import type { AppDatabase } from './db.js';
import { toNotificationJob } from './mappers.js';
import { deliveryAttempts, notificationJobs } from './schema.js';

export class PostgresNotificationJobRepository
	implements NotificationJobRepository
{
	constructor(private readonly db: AppDatabase) {}

	async enqueue(job: NotificationJob): Promise<EnqueueResult> {
		const [inserted] = await this.db
			.insert(notificationJobs)
			.values({
				id: job.id,
				type: job.type,
				userId: job.userId,
				subscriptionId: job.subscriptionId,
				occurrenceId: job.occurrenceId,
				recipientIdentityId: job.recipientIdentityId,
				dueAt: job.dueAt,
				status: job.status,
				idempotencyKey: job.idempotencyKey,
				attempts: job.attempts,
				maxAttempts: job.maxAttempts,
				nextAttemptAt: job.nextAttemptAt,
				lockedAt: job.lockedAt,
				lockedBy: job.lockedBy,
				lastError: job.lastError,
				payload: { ...job.payload },
				createdAt: job.createdAt,
				updatedAt: job.updatedAt,
			})
			.onConflictDoNothing({ target: notificationJobs.idempotencyKey })
			.returning();

		if (inserted) {
			return { job: toNotificationJob(inserted), created: true };
		}

		const [existing] = await this.db
			.select()
			.from(notificationJobs)
			.where(eq(notificationJobs.idempotencyKey, job.idempotencyKey))
			.limit(1);

		if (!existing) {
			throw new Error('Notification job conflict without an existing row');
		}

		if (existing.status === NotificationJobStatus.Cancelled) {
			const [revived] = await this.db
				.update(notificationJobs)
				.set({
					type: job.type,
					userId: job.userId,
					subscriptionId: job.subscriptionId,
					occurrenceId: job.occurrenceId,
					recipientIdentityId: job.recipientIdentityId,
					dueAt: job.dueAt,
					status: job.status,
					attempts: existing.attempts,
					maxAttempts: existing.maxAttempts,
					nextAttemptAt: job.nextAttemptAt,
					lockedAt: null,
					lockedBy: null,
					lastError: null,
					payload: { ...job.payload },
					updatedAt: job.updatedAt,
				})
				.where(
					and(
						eq(notificationJobs.id, existing.id),
						eq(notificationJobs.status, NotificationJobStatus.Cancelled),
					),
				)
				.returning();
			if (revived) {
				return { job: toNotificationJob(revived), created: true };
			}
		}

		return { job: toNotificationJob(existing), created: false };
	}

	async claimDue(input: ClaimDueJobsInput): Promise<NotificationJob[]> {
		const staleBefore = new Date(input.now.getTime() - input.lockTimeoutMs);
		const candidates = await this.db
			.select({ id: notificationJobs.id })
			.from(notificationJobs)
			.where(
				or(
					and(
						eq(notificationJobs.status, NotificationJobStatus.Pending),
						lte(notificationJobs.nextAttemptAt, input.now),
					),
					and(
						eq(notificationJobs.status, NotificationJobStatus.Claimed),
						or(
							isNull(notificationJobs.lockedAt),
							lte(notificationJobs.lockedAt, staleBefore),
						),
					),
				),
			)
			.orderBy(asc(notificationJobs.nextAttemptAt))
			.limit(input.limit)
			.for('update', { skipLocked: true });

		if (candidates.length === 0) return [];

		const rows = await this.db
			.update(notificationJobs)
			.set({
				status: NotificationJobStatus.Claimed,
				lockedAt: input.now,
				lockedBy: input.workerId,
				updatedAt: input.now,
			})
			.where(
				inArray(
					notificationJobs.id,
					candidates.map((candidate) => candidate.id),
				),
			)
			.returning();

		return rows.map(toNotificationJob);
	}

	async save(job: NotificationJob): Promise<void> {
		await this.db
			.update(notificationJobs)
			.set({
				status: job.status,
				attempts: job.attempts,
				nextAttemptAt: job.nextAttemptAt,
				lockedAt: job.lockedAt,
				lockedBy: job.lockedBy,
				lastError: job.lastError,
				updatedAt: job.updatedAt,
			})
			.where(eq(notificationJobs.id, job.id));
	}

	async findById(id: string): Promise<NotificationJob | null> {
		const [row] = await this.db
			.select()
			.from(notificationJobs)
			.where(eq(notificationJobs.id, id))
			.limit(1);
		return row ? toNotificationJob(row) : null;
	}

	async findByIdForUpdate(id: string): Promise<NotificationJob | null> {
		const [row] = await this.db
			.select()
			.from(notificationJobs)
			.where(eq(notificationJobs.id, id))
			.limit(1)
			.for('update');
		return row ? toNotificationJob(row) : null;
	}

	async cancelPendingByOccurrenceIds(
		occurrenceIds: ReadonlyArray<string>,
		now: Date,
		reason: string,
	): Promise<number> {
		if (occurrenceIds.length === 0) return 0;
		const rows = await this.db
			.update(notificationJobs)
			.set({
				status: NotificationJobStatus.Cancelled,
				lockedAt: null,
				lockedBy: null,
				lastError: reason,
				nextAttemptAt: now,
				updatedAt: now,
			})
			.where(
				and(
					inArray(notificationJobs.occurrenceId, [...occurrenceIds]),
					eq(notificationJobs.status, NotificationJobStatus.Pending),
				),
			)
			.returning({ id: notificationJobs.id });
		return rows.length;
	}

	async cancelPendingBySubscription(
		subscriptionId: string,
		now: Date,
		reason: string,
	): Promise<number> {
		const rows = await this.db
			.update(notificationJobs)
			.set({
				status: NotificationJobStatus.Cancelled,
				lockedAt: null,
				lockedBy: null,
				lastError: reason,
				nextAttemptAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(notificationJobs.subscriptionId, subscriptionId),
					eq(notificationJobs.status, NotificationJobStatus.Pending),
				),
			)
			.returning({ id: notificationJobs.id });
		return rows.length;
	}

	async cancelPendingByIdempotencyKeys(
		idempotencyKeys: ReadonlyArray<string>,
		now: Date,
		reason: string,
	): Promise<number> {
		if (idempotencyKeys.length === 0) return 0;
		const rows = await this.db
			.update(notificationJobs)
			.set({
				status: NotificationJobStatus.Cancelled,
				lockedAt: null,
				lockedBy: null,
				lastError: reason,
				nextAttemptAt: now,
				updatedAt: now,
			})
			.where(
				and(
					inArray(notificationJobs.idempotencyKey, [...idempotencyKeys]),
					eq(notificationJobs.status, NotificationJobStatus.Pending),
				),
			)
			.returning({ id: notificationJobs.id });
		return rows.length;
	}

	async listPendingBySubscription(
		subscriptionId: string,
	): Promise<NotificationJob[]> {
		const rows = await this.db
			.select()
			.from(notificationJobs)
			.where(
				and(
					eq(notificationJobs.subscriptionId, subscriptionId),
					eq(notificationJobs.status, NotificationJobStatus.Pending),
				),
			)
			.orderBy(asc(notificationJobs.dueAt));
		return rows.map(toNotificationJob);
	}

	async recordDeliveryAttempt(attempt: DeliveryAttempt): Promise<void> {
		await this.db
			.insert(deliveryAttempts)
			.values({
				id: attempt.id,
				jobId: attempt.jobId,
				attemptNo: attempt.attemptNo,
				provider: attempt.provider,
				status: attempt.status,
				providerMessageId: attempt.providerMessageId,
				error: attempt.error,
				startedAt: attempt.startedAt,
				finishedAt: attempt.finishedAt,
			})
			.onConflictDoNothing({
				target: [deliveryAttempts.jobId, deliveryAttempts.attemptNo],
			});
	}
}
