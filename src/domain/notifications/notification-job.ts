import { ConflictError, ValidationError } from '../shared/errors.js';

export enum NotificationType {
	DailySummary = 'DAILY_SUMMARY',
	ClassReminder = 'CLASS_REMINDER',
	ExamReminder = 'EXAM_REMINDER',
}

export enum NotificationJobStatus {
	Pending = 'PENDING',
	Claimed = 'CLAIMED',
	Sent = 'SENT',
	Failed = 'FAILED',
	Cancelled = 'CANCELLED',
}

export type NotificationPayload = Readonly<Record<string, unknown>>;

export class NotificationJob {
	private constructor(
		readonly id: string,
		readonly type: NotificationType,
		readonly userId: string,
		readonly subscriptionId: string,
		readonly occurrenceId: string | null,
		readonly recipientIdentityId: string,
		readonly dueAt: Date,
		readonly status: NotificationJobStatus,
		readonly idempotencyKey: string,
		readonly attempts: number,
		readonly maxAttempts: number,
		readonly nextAttemptAt: Date,
		readonly lockedAt: Date | null,
		readonly lockedBy: string | null,
		readonly lastError: string | null,
		readonly payload: NotificationPayload,
		readonly createdAt: Date,
		readonly updatedAt: Date,
	) {}

	static create(input: {
		id: string;
		type: NotificationType;
		userId: string;
		subscriptionId: string;
		occurrenceId?: string | null;
		recipientIdentityId: string;
		dueAt: Date;
		idempotencyKey: string;
		maxAttempts?: number;
		payload?: NotificationPayload;
		createdAt?: Date;
	}): NotificationJob {
		if (!input.id.trim())
			throw new ValidationError('NotificationJob.id is required');
		if (!input.userId.trim()) {
			throw new ValidationError('NotificationJob.userId is required');
		}
		if (!input.subscriptionId.trim()) {
			throw new ValidationError('NotificationJob.subscriptionId is required');
		}
		if (!input.recipientIdentityId.trim()) {
			throw new ValidationError('NotificationJob.recipientIdentityId is required');
		}
		if (!input.idempotencyKey.trim()) {
			throw new ValidationError('NotificationJob.idempotencyKey is required');
		}
		if (Number.isNaN(input.dueAt.getTime())) {
			throw new ValidationError('NotificationJob.dueAt is invalid');
		}

		const maxAttempts = input.maxAttempts ?? 5;
		if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
			throw new ValidationError('NotificationJob.maxAttempts must be >= 1');
		}

		const now = input.createdAt ?? new Date();
		return new NotificationJob(
			input.id.trim(),
			input.type,
			input.userId.trim(),
			input.subscriptionId.trim(),
			input.occurrenceId?.trim() || null,
			input.recipientIdentityId.trim(),
			input.dueAt,
			NotificationJobStatus.Pending,
			input.idempotencyKey.trim(),
			0,
			maxAttempts,
			input.dueAt,
			null,
			null,
			null,
			Object.freeze({ ...(input.payload ?? {}) }),
			now,
			now,
		);
	}

	static rehydrate(input: {
		id: string;
		type: NotificationType;
		userId: string;
		subscriptionId: string;
		occurrenceId: string | null;
		recipientIdentityId: string;
		dueAt: Date;
		status: NotificationJobStatus;
		idempotencyKey: string;
		attempts: number;
		maxAttempts: number;
		nextAttemptAt: Date;
		lockedAt: Date | null;
		lockedBy: string | null;
		lastError: string | null;
		payload: NotificationPayload;
		createdAt: Date;
		updatedAt: Date;
	}): NotificationJob {
		return new NotificationJob(
			input.id,
			input.type,
			input.userId,
			input.subscriptionId,
			input.occurrenceId,
			input.recipientIdentityId,
			input.dueAt,
			input.status,
			input.idempotencyKey,
			input.attempts,
			input.maxAttempts,
			input.nextAttemptAt,
			input.lockedAt,
			input.lockedBy,
			input.lastError,
			Object.freeze({ ...input.payload }),
			input.createdAt,
			input.updatedAt,
		);
	}

	isTerminal(): boolean {
		return (
			this.status === NotificationJobStatus.Sent ||
			this.status === NotificationJobStatus.Failed ||
			this.status === NotificationJobStatus.Cancelled
		);
	}

	canBeClaimed(now: Date, lockTimeoutMs: number): boolean {
		if (this.status === NotificationJobStatus.Pending) {
			return this.nextAttemptAt.getTime() <= now.getTime();
		}
		if (this.status === NotificationJobStatus.Claimed) {
			if (!this.lockedAt) return true;
			return this.lockedAt.getTime() + lockTimeoutMs <= now.getTime();
		}
		return false;
	}

	claim(workerId: string, now: Date): NotificationJob {
		if (!this.canBeClaimed(now, Number.POSITIVE_INFINITY)) {
			throw new ConflictError('Notification job is not claimable');
		}
		return this.copy({
			status: NotificationJobStatus.Claimed,
			lockedAt: now,
			lockedBy: workerId,
			updatedAt: now,
		});
	}

	markSent(now: Date): NotificationJob {
		if (this.status !== NotificationJobStatus.Claimed) {
			throw new ConflictError('Only claimed jobs can be marked sent');
		}
		return this.copy({
			status: NotificationJobStatus.Sent,
			attempts: this.attempts + 1,
			lockedAt: null,
			lockedBy: null,
			lastError: null,
			nextAttemptAt: now,
			updatedAt: now,
		});
	}

	markRetry(now: Date, error: string, delayMs: number): NotificationJob {
		if (this.status !== NotificationJobStatus.Claimed) {
			throw new ConflictError('Only claimed jobs can be retried');
		}
		const attempts = this.attempts + 1;
		if (attempts >= this.maxAttempts) {
			return this.copy({
				status: NotificationJobStatus.Failed,
				attempts,
				lockedAt: null,
				lockedBy: null,
				lastError: error,
				nextAttemptAt: now,
				updatedAt: now,
			});
		}

		return this.copy({
			status: NotificationJobStatus.Pending,
			attempts,
			lockedAt: null,
			lockedBy: null,
			lastError: error,
			nextAttemptAt: new Date(now.getTime() + Math.max(0, delayMs)),
			updatedAt: now,
		});
	}

	markFailed(now: Date, error: string): NotificationJob {
		if (this.isTerminal()) {
			throw new ConflictError('Notification job is already terminal');
		}
		return this.copy({
			status: NotificationJobStatus.Failed,
			attempts: this.attempts + 1,
			lockedAt: null,
			lockedBy: null,
			lastError: error,
			nextAttemptAt: now,
			updatedAt: now,
		});
	}

	cancel(now: Date, reason?: string): NotificationJob {
		if (this.isTerminal()) return this;
		return this.copy({
			status: NotificationJobStatus.Cancelled,
			lockedAt: null,
			lockedBy: null,
			lastError: reason ?? this.lastError,
			nextAttemptAt: now,
			updatedAt: now,
		});
	}

	release(now: Date): NotificationJob {
		if (this.status !== NotificationJobStatus.Claimed) return this;
		return this.copy({
			status: NotificationJobStatus.Pending,
			lockedAt: null,
			lockedBy: null,
			nextAttemptAt: now,
			updatedAt: now,
		});
	}

	private copy(overrides: Partial<NotificationJob>): NotificationJob {
		return new NotificationJob(
			this.id,
			this.type,
			this.userId,
			this.subscriptionId,
			this.occurrenceId,
			this.recipientIdentityId,
			this.dueAt,
			overrides.status ?? this.status,
			this.idempotencyKey,
			overrides.attempts ?? this.attempts,
			overrides.maxAttempts ?? this.maxAttempts,
			overrides.nextAttemptAt ?? this.nextAttemptAt,
			overrides.lockedAt === undefined ? this.lockedAt : overrides.lockedAt,
			overrides.lockedBy === undefined ? this.lockedBy : overrides.lockedBy,
			overrides.lastError === undefined ? this.lastError : overrides.lastError,
			this.payload,
			this.createdAt,
			overrides.updatedAt ?? this.updatedAt,
		);
	}
}
