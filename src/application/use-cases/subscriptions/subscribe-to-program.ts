import { NotFoundError } from "../../../domain/shared/errors.js";
import { LocalTime } from "../../../domain/shared/local-time.js";
import { NotificationPreference } from "../../../domain/subscriptions/notification-preference.js";
import { UserProgramSubscription } from "../../../domain/subscriptions/subscription.js";
import type { SubscriptionDto } from "../../dto/schedule.js";
import { toSubscriptionDto } from "../../services/dto-mappers.js";
import type { Clock } from "../../ports/outbound/clock.js";
import type { IdGenerator } from "../../ports/outbound/id-generator.js";
import type { UnitOfWork } from "../../ports/outbound/unit-of-work.js";

export interface SubscriptionDefaults {
  dailySummaryTime: string;
  reminderOffsetMinutes: number;
  notifyOnEmptyDays: boolean;
}

export class SubscribeToProgram {
  constructor(
    private readonly deps: {
      uow: UnitOfWork;
      ids: IdGenerator;
      clock: Clock;
      defaults: SubscriptionDefaults;
    },
  ) {}

  async execute(userId: string, programOfferingId: string): Promise<SubscriptionDto> {
    const now = this.deps.clock.now();

    return this.deps.uow.run(async (repositories) => {
      const user = await repositories.users.findUserById(userId);
      if (!user) throw new NotFoundError(`User ${userId} not found`);

      const programOffering =
        await repositories.academic.getProgramOffering(programOfferingId);
      if (!programOffering) {
        throw new NotFoundError(`Program offering ${programOfferingId} not found`);
      }
      if (programOffering.courseOfferingIds.length === 0) {
        throw new NotFoundError(
          `Program offering ${programOfferingId} has no active course offerings`,
        );
      }

      const existing =
        await repositories.subscriptions.findActiveByUserId(userId);

      if (existing?.programOfferingId === programOfferingId) {
        let preference =
          await repositories.subscriptions.getPreferenceBySubscriptionId(
            existing.id,
          );
        if (!preference) {
          preference = NotificationPreference.create({
            id: this.deps.ids.next(),
            subscriptionId: existing.id,
            dailySummaryEnabled: true,
            dailySummaryTime: LocalTime.parse(this.deps.defaults.dailySummaryTime),
            classReminderEnabled: true,
            reminderOffsetMinutes: this.deps.defaults.reminderOffsetMinutes,
            notifyOnEmptyDays: this.deps.defaults.notifyOnEmptyDays,
            updatedAt: now,
          });
          await repositories.subscriptions.upsertPreference(preference);
        }
        return toSubscriptionDto({
          subscription: existing,
          preference,
          programOffering,
        });
      }

      await repositories.subscriptions.deactivateOtherActiveSubscriptions(
        userId,
        null,
      );
      if (existing) {
        await repositories.jobs.cancelPendingBySubscription(
          existing.id,
          now,
          "PROGRAM_CHANGED",
        );
      }

      const subscription = UserProgramSubscription.create({
        id: this.deps.ids.next(),
        userId,
        programOfferingId,
        createdAt: now,
        updatedAt: now,
      });
      await repositories.subscriptions.create(subscription);

      const preference = NotificationPreference.create({
        id: this.deps.ids.next(),
        subscriptionId: subscription.id,
        dailySummaryEnabled: true,
        dailySummaryTime: LocalTime.parse(this.deps.defaults.dailySummaryTime),
        classReminderEnabled: true,
        reminderOffsetMinutes: this.deps.defaults.reminderOffsetMinutes,
        notifyOnEmptyDays: this.deps.defaults.notifyOnEmptyDays,
        updatedAt: now,
      });
      await repositories.subscriptions.upsertPreference(preference);

      return toSubscriptionDto({ subscription, preference, programOffering });
    });
  }
}
