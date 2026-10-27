import type { DeliveryAttempt } from "../../../domain/notifications/delivery-attempt.js";
import type { NotificationJob } from "../../../domain/notifications/notification-job.js";

export interface ClaimDueJobsInput {
  now: Date;
  workerId: string;
  limit: number;
  lockTimeoutMs: number;
}

export interface EnqueueResult {
  job: NotificationJob;
  created: boolean;
}

export interface NotificationJobRepository {
  enqueue(job: NotificationJob): Promise<EnqueueResult>;
  claimDue(input: ClaimDueJobsInput): Promise<NotificationJob[]>;
  save(job: NotificationJob): Promise<void>;
  findById(id: string): Promise<NotificationJob | null>;
  findByIdForUpdate(id: string): Promise<NotificationJob | null>;
  cancelPendingByOccurrenceIds(
    occurrenceIds: ReadonlyArray<string>,
    now: Date,
    reason: string,
  ): Promise<number>;
  cancelPendingBySubscription(
    subscriptionId: string,
    now: Date,
    reason: string,
  ): Promise<number>;
  cancelPendingByIdempotencyKeys(
    idempotencyKeys: ReadonlyArray<string>,
    now: Date,
    reason: string,
  ): Promise<number>;
  listPendingBySubscription(subscriptionId: string): Promise<NotificationJob[]>;
  recordDeliveryAttempt(attempt: DeliveryAttempt): Promise<void>;
}
