import type { NotificationPreference } from "../../../domain/subscriptions/notification-preference.js";
import type { UserProgramSubscription } from "../../../domain/subscriptions/subscription.js";

export interface SubscriptionRepository {
  create(subscription: UserProgramSubscription): Promise<UserProgramSubscription>;
  update(subscription: UserProgramSubscription): Promise<UserProgramSubscription>;
  findById(id: string): Promise<UserProgramSubscription | null>;
  findActiveByUserId(userId: string): Promise<UserProgramSubscription | null>;
  listActive(): Promise<UserProgramSubscription[]>;
  deactivateOtherActiveSubscriptions(
    userId: string,
    exceptSubscriptionId: string | null,
  ): Promise<number>;

  getPreferenceBySubscriptionId(
    subscriptionId: string,
  ): Promise<NotificationPreference | null>;
  upsertPreference(
    preference: NotificationPreference,
  ): Promise<NotificationPreference>;
}
