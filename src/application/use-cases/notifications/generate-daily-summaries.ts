import { dailySummaryIdempotencyKey } from "../../../domain/notifications/idempotency.js";
import {
  NotificationJob,
  NotificationType,
} from "../../../domain/notifications/notification-job.js";
import { LocalDate } from "../../../domain/shared/local-date.js";
import type { Clock } from "../../ports/outbound/clock.js";
import type { IdGenerator } from "../../ports/outbound/id-generator.js";
import type { Logger } from "../../ports/outbound/logger.js";
import type { UnitOfWork } from "../../ports/outbound/unit-of-work.js";

export interface GenerateDailySummariesResult {
  subscriptionsProcessed: number;
  jobsCreated: number;
  jobsAlreadyPresent: number;
  jobsCancelled: number;
  skipped: number;
}

export class GenerateDailySummaries {
  constructor(
    private readonly deps: {
      uow: UnitOfWork;
      ids: IdGenerator;
      clock: Clock;
      logger: Logger;
      horizonDays: number;
    },
  ) {}

  async execute(input: { userId?: string } = {}): Promise<GenerateDailySummariesResult> {
    const now = this.deps.clock.now();
    let subscriptionsProcessed = 0;
    let jobsCreated = 0;
    let jobsAlreadyPresent = 0;
    let jobsCancelled = 0;
    let skipped = 0;

    await this.deps.uow.run(async (repositories) => {
      const subscriptions = input.userId
        ? [
            await repositories.subscriptions.findActiveByUserId(input.userId),
          ].filter((value): value is NonNullable<typeof value> => value !== null)
        : await repositories.subscriptions.listActive();

      for (const subscription of subscriptions) {
        const preference =
          await repositories.subscriptions.getPreferenceBySubscriptionId(
            subscription.id,
          );
        if (!preference?.dailySummaryEnabled) {
          skipped += 1;
          continue;
        }

        const programOffering = await repositories.academic.getProgramOffering(
          subscription.programOfferingId,
        );
        if (!programOffering) {
          skipped += 1;
          continue;
        }

        const courseOfferingIds = [
          ...subscription.effectiveCourseOfferingIds(
            programOffering.courseOfferingIds,
          ),
        ];
        if (courseOfferingIds.length === 0) {
          skipped += 1;
          continue;
        }

        const user = await repositories.users.findUserById(subscription.userId);
        const identity =
          await repositories.users.findPreferredIdentityForUser(
            subscription.userId,
          );
        if (!user || !identity) {
          skipped += 1;
          continue;
        }

        const today = LocalDate.fromInstant(now, user.timeZone);
        subscriptionsProcessed += 1;

        for (let dayOffset = 0; dayOffset < this.deps.horizonDays; dayOffset += 1) {
          const date = today.addDays(dayOffset);
          const dueAt = date.toUtcInstant(
            preference.dailySummaryTime,
            user.timeZone,
          );
          if (dueAt.getTime() <= now.getTime()) {
            skipped += 1;
            continue;
          }

          const views = await repositories.occurrences.listForCourses(
            courseOfferingIds,
            date,
            date,
          );
          const scheduled = views.filter((view) => view.occurrence.isActive());

          const idempotencyKey = dailySummaryIdempotencyKey({
            subscriptionId: subscription.id,
            localDate: date.toString(),
          });

          if (scheduled.length === 0 && !preference.notifyOnEmptyDays) {
            const cancelled =
              await repositories.jobs.cancelPendingByIdempotencyKeys(
                [idempotencyKey],
                now,
                "EMPTY_DAY_NOTIFICATION_DISABLED",
              );
            jobsCancelled += cancelled;
            continue;
          }

          const job = NotificationJob.create({
            id: this.deps.ids.next(),
            type: NotificationType.DailySummary,
            userId: user.id,
            subscriptionId: subscription.id,
            occurrenceId: null,
            recipientIdentityId: identity.id,
            dueAt,
            idempotencyKey,
            payload: {
              localDate: date.toString(),
            },
            createdAt: now,
          });

          const result = await repositories.jobs.enqueue(job);
          if (result.created) jobsCreated += 1;
          else jobsAlreadyPresent += 1;
        }
      }
    });

    this.deps.logger.info(
      {
        subscriptionsProcessed,
        jobsCreated,
        jobsAlreadyPresent,
        jobsCancelled,
        skipped,
      },
      "Daily summary scheduling completed",
    );

    return {
      subscriptionsProcessed,
      jobsCreated,
      jobsAlreadyPresent,
      jobsCancelled,
      skipped,
    };
  }
}
