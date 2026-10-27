import { NotFoundError } from '../../../domain/shared/errors.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import { NotificationPreference } from '../../../domain/subscriptions/notification-preference.js';
import type { SubscriptionDto } from '../../dto/schedule.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';
import { toSubscriptionDto } from '../../services/dto-mappers.js';
import type { SubscriptionDefaults } from './subscribe-to-program.js';

export interface NotificationPreferenceChanges {
	dailySummaryEnabled?: boolean;
	dailySummaryTime?: string;
	classReminderEnabled?: boolean;
	reminderOffsetMinutes?: number;
	notifyOnEmptyDays?: boolean;
}

export class UpdateNotificationPreferences {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
			defaults: SubscriptionDefaults;
		},
	) {}

	async execute(
		userId: string,
		changes: NotificationPreferenceChanges,
	): Promise<SubscriptionDto> {
		const now = this.deps.clock.now();

		return this.deps.uow.run(async (repositories) => {
			const subscription =
				await repositories.subscriptions.findActiveByUserId(userId);
			if (!subscription) {
				throw new NotFoundError('No active program subscription');
			}

			const programOffering = await repositories.academic.getProgramOffering(
				subscription.programOfferingId,
			);
			if (!programOffering) {
				throw new NotFoundError(
					'Subscribed program offering is no longer available',
				);
			}

			let current = await repositories.subscriptions.getPreferenceBySubscriptionId(
				subscription.id,
			);
			if (!current) {
				current = NotificationPreference.create({
					id: this.deps.ids.next(),
					subscriptionId: subscription.id,
					dailySummaryTime: LocalTime.parse(this.deps.defaults.dailySummaryTime),
					reminderOffsetMinutes: this.deps.defaults.reminderOffsetMinutes,
					notifyOnEmptyDays: this.deps.defaults.notifyOnEmptyDays,
					updatedAt: now,
				});
			}

			const updated = current.withChanges({
				dailySummaryEnabled: changes.dailySummaryEnabled,
				dailySummaryTime: changes.dailySummaryTime
					? LocalTime.parse(changes.dailySummaryTime)
					: undefined,
				classReminderEnabled: changes.classReminderEnabled,
				reminderOffsetMinutes: changes.reminderOffsetMinutes,
				notifyOnEmptyDays: changes.notifyOnEmptyDays,
				updatedAt: now,
			});

			await repositories.subscriptions.upsertPreference(updated);
			await repositories.jobs.cancelPendingBySubscription(
				subscription.id,
				now,
				'NOTIFICATION_PREFERENCES_CHANGED',
			);

			return toSubscriptionDto({
				subscription,
				preference: updated,
				programOffering,
			});
		});
	}
}
