import { describe, expect, it } from 'vitest';
import {
	NotificationJob,
	NotificationJobStatus,
	NotificationType,
} from '../../src/domain/notifications/notification-job.js';

const now = new Date('2026-01-01T08:00:00.000Z');

function job() {
	return NotificationJob.create({
		id: 'job-1',
		type: NotificationType.ClassReminder,
		userId: 'user-1',
		subscriptionId: 'subscription-1',
		recipientIdentityId: 'identity-1',
		dueAt: now,
		idempotencyKey: 'reminder:occurrence-1',
		maxAttempts: 2,
		createdAt: now,
	});
}

describe('NotificationJob', () => {
	it('claims a due pending job and records a successful attempt', () => {
		const claimed = job().claim('worker-1', now);
		expect(claimed.status).toBe(NotificationJobStatus.Claimed);
		expect(claimed.lockedBy).toBe('worker-1');

		const sent = claimed.markSent(now);
		expect(sent.status).toBe(NotificationJobStatus.Sent);
		expect(sent.attempts).toBe(1);
		expect(sent.lockedAt).toBeNull();
	});

	it('fails after max attempts', () => {
		const firstRetry = job()
			.claim('worker-1', now)
			.markRetry(now, 'temporary', 1_000);
		expect(firstRetry.status).toBe(NotificationJobStatus.Pending);
		expect(firstRetry.attempts).toBe(1);
		expect(firstRetry.nextAttemptAt.getTime()).toBe(now.getTime() + 1_000);

		const failed = firstRetry
			.claim('worker-1', new Date(now.getTime() + 1_000))
			.markRetry(now, 'still failing', 1_000);
		expect(failed.status).toBe(NotificationJobStatus.Failed);
		expect(failed.attempts).toBe(2);
	});

	it('reclaims stale claimed jobs after the lock timeout', () => {
		const claimed = job().claim('worker-1', now);
		expect(claimed.canBeClaimed(new Date(now.getTime() + 500), 1_000)).toBe(
			false,
		);
		expect(claimed.canBeClaimed(new Date(now.getTime() + 1_000), 1_000)).toBe(
			true,
		);
	});

	it('treats cancellation as terminal and idempotent', () => {
		const cancelled = job().cancel(now, 'UNSUBSCRIBED');
		expect(cancelled.status).toBe(NotificationJobStatus.Cancelled);
		expect(cancelled.cancel(now).status).toBe(NotificationJobStatus.Cancelled);
	});

	it('allows a student selection as the single notification owner', () => {
		const selectionJob = NotificationJob.create({
			id: 'job-2',
			type: NotificationType.ClassReminder,
			userId: 'user-1',
			selectionId: 'selection-1',
			recipientIdentityId: 'identity-1',
			dueAt: now,
			idempotencyKey: 'selection-reminder:occurrence-1',
			createdAt: now,
		});
		expect(selectionJob.subscriptionId).toBeNull();
		expect(selectionJob.selectionId).toBe('selection-1');
	});

	it('rejects jobs without an owner or with two owners', () => {
		expect(() =>
			NotificationJob.create({
				id: 'job-3',
				type: NotificationType.ClassReminder,
				userId: 'user-1',
				recipientIdentityId: 'identity-1',
				dueAt: now,
				idempotencyKey: 'no-owner',
				createdAt: now,
			}),
		).toThrow('exactly one of subscriptionId or selectionId');

		expect(() =>
			NotificationJob.create({
				id: 'job-4',
				type: NotificationType.ClassReminder,
				userId: 'user-1',
				subscriptionId: 'subscription-1',
				selectionId: 'selection-1',
				recipientIdentityId: 'identity-1',
				dueAt: now,
				idempotencyKey: 'two-owners',
				createdAt: now,
			}),
		).toThrow('exactly one of subscriptionId or selectionId');
	});
});
