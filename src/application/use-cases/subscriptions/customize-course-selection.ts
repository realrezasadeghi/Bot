import { NotFoundError } from '../../../domain/shared/errors.js';
import { LocalTime } from '../../../domain/shared/local-time.js';
import { NotificationPreference } from '../../../domain/subscriptions/notification-preference.js';
import type { SubscriptionDto } from '../../dto/schedule.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';
import { toSubscriptionDto } from '../../services/dto-mappers.js';
import type { SubscriptionDefaults } from './subscribe-to-program.js';

export class CustomizeCourseSelection {
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
		selectedCourseOfferingIds: ReadonlyArray<string>,
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

			const updated = subscription.customize(
				programOffering.courseOfferingIds,
				selectedCourseOfferingIds,
			);
			await repositories.subscriptions.update(updated);
			await repositories.jobs.cancelPendingBySubscription(
				updated.id,
				now,
				'COURSE_SELECTION_CHANGED',
			);

			let preference =
				await repositories.subscriptions.getPreferenceBySubscriptionId(updated.id);
			if (!preference) {
				preference = NotificationPreference.create({
					id: this.deps.ids.next(),
					subscriptionId: updated.id,
					dailySummaryTime: LocalTime.parse(this.deps.defaults.dailySummaryTime),
					reminderOffsetMinutes: this.deps.defaults.reminderOffsetMinutes,
					notifyOnEmptyDays: this.deps.defaults.notifyOnEmptyDays,
					updatedAt: now,
				});
				await repositories.subscriptions.upsertPreference(preference);
			}

			return toSubscriptionDto({
				subscription: updated,
				preference,
				programOffering,
			});
		});
	}
}

export class FollowProgramDefault {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
		},
	) {}

	async execute(userId: string): Promise<void> {
		const now = this.deps.clock.now();
		await this.deps.uow.run(async (repositories) => {
			const subscription =
				await repositories.subscriptions.findActiveByUserId(userId);
			if (!subscription) throw new NotFoundError('No active program subscription');
			const updated = subscription.followProgram();
			await repositories.subscriptions.update(updated);
			await repositories.jobs.cancelPendingBySubscription(
				updated.id,
				now,
				'COURSE_SELECTION_CHANGED',
			);
		});
	}
}
