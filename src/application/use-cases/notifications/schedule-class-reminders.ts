import {
	reminderIdempotencyKey,
	selectionReminderIdempotencyKey,
} from '../../../domain/notifications/idempotency.js';
import {
	NotificationJob,
	NotificationType,
} from '../../../domain/notifications/notification-job.js';
import { LocalDate } from '../../../domain/shared/local-date.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface ScheduleRemindersResult {
	subscriptionsProcessed: number;
	selectionsProcessed: number;
	jobsCreated: number;
	jobsAlreadyPresent: number;
	skipped: number;
}

export class ScheduleClassReminders {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
			logger: Logger;
			horizonDays: number;
		},
	) {}

	async execute(
		input: { userId?: string } = {},
	): Promise<ScheduleRemindersResult> {
		const now = this.deps.clock.now();
		let subscriptionsProcessed = 0;
		let selectionsProcessed = 0;
		let jobsCreated = 0;
		let jobsAlreadyPresent = 0;
		let skipped = 0;

		await this.deps.uow.run(async (repositories) => {
			const subscriptions = input.userId
				? [
						await repositories.subscriptions.findActiveByUserId(input.userId),
					].filter((value): value is NonNullable<typeof value> => value !== null)
				: await repositories.subscriptions.listActive();

			for (const subscription of subscriptions) {
				const studentSelection =
					await repositories.studentSelections.findActiveByUserId(
						subscription.userId,
					);
				if (studentSelection) {
					await repositories.jobs.cancelPendingBySubscription(
						subscription.id,
						now,
						'STUDENT_SELECTION_ACTIVE',
					);
					skipped += 1;
					continue;
				}

				const preference =
					await repositories.subscriptions.getPreferenceBySubscriptionId(
						subscription.id,
					);
				if (!preference?.classReminderEnabled) {
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
				const identity = await repositories.users.findPreferredIdentityForUser(
					subscription.userId,
				);
				if (!user || !identity) {
					skipped += 1;
					this.deps.logger.warn(
						{ subscriptionId: subscription.id, userId: subscription.userId },
						'Skipping reminder scheduling because user or platform identity is missing',
					);
					continue;
				}

				const today = LocalDate.fromInstant(now, user.timeZone);
				const horizonEnd = today.addDays(this.deps.horizonDays - 1);
				const occurrences =
					await repositories.occurrences.listFutureScheduledForCourses(
						courseOfferingIds,
						today,
						horizonEnd,
					);

				subscriptionsProcessed += 1;

				for (const view of occurrences) {
					const { occurrence } = view;
					const startInstant = occurrence.date.toUtcInstant(
						occurrence.startTime,
						user.timeZone,
					);
					const dueAt = new Date(
						startInstant.getTime() - preference.reminderOffsetMinutes * 60_000,
					);
					if (dueAt.getTime() <= now.getTime()) {
						skipped += 1;
						continue;
					}

					const job = NotificationJob.create({
						id: this.deps.ids.next(),
						type: NotificationType.ClassReminder,
						userId: user.id,
						subscriptionId: subscription.id,
						occurrenceId: occurrence.id,
						recipientIdentityId: identity.id,
						dueAt,
						idempotencyKey: reminderIdempotencyKey({
							subscriptionId: subscription.id,
							occurrenceId: occurrence.id,
							occurrenceStartAtIso: startInstant.toISOString(),
							offsetMinutes: preference.reminderOffsetMinutes,
						}),
						payload: {
							occurrenceId: occurrence.id,
							courseOfferingId: occurrence.courseOfferingId,
							occurrenceDate: occurrence.date.toString(),
							startTime: occurrence.startTime.toString(),
							endTime: occurrence.endTime.toString(),
							startAtIso: startInstant.toISOString(),
							location: occurrence.location,
							offsetMinutes: preference.reminderOffsetMinutes,
						},
						createdAt: now,
					});

					const result = await repositories.jobs.enqueue(job);
					if (result.created) jobsCreated += 1;
					else jobsAlreadyPresent += 1;
				}
			}

			const selections = await repositories.studentSelections.listActive();
			for (const { selection, courseOfferingIds } of selections) {
				if (input.userId && selection.userId !== input.userId) {
					continue;
				}
				if (!selection.classReminderEnabled) {
					skipped += 1;
					continue;
				}
				if (courseOfferingIds.length === 0) {
					skipped += 1;
					continue;
				}

				const user = await repositories.users.findUserById(selection.userId);
				const identity = await repositories.users.findPreferredIdentityForUser(
					selection.userId,
				);
				if (!user || !identity) {
					skipped += 1;
					continue;
				}

				const today = LocalDate.fromInstant(now, user.timeZone);
				const horizonEnd = today.addDays(this.deps.horizonDays - 1);
				const occurrences =
					await repositories.occurrences.listFutureScheduledForCourses(
						courseOfferingIds,
						today,
						horizonEnd,
					);

				selectionsProcessed += 1;

				for (const view of occurrences) {
					const { occurrence } = view;
					const startInstant = occurrence.date.toUtcInstant(
						occurrence.startTime,
						user.timeZone,
					);
					const offsetMinutes = selection.reminderOffsetMinutes;
					const dueAt = new Date(startInstant.getTime() - offsetMinutes * 60_000);
					if (dueAt.getTime() <= now.getTime()) {
						skipped += 1;
						continue;
					}

					const job = NotificationJob.create({
						id: this.deps.ids.next(),
						type: NotificationType.ClassReminder,
						userId: user.id,
						selectionId: selection.id,
						occurrenceId: occurrence.id,
						recipientIdentityId: identity.id,
						dueAt,
						idempotencyKey: selectionReminderIdempotencyKey({
							selectionId: selection.id,
							occurrenceId: occurrence.id,
							occurrenceStartAtIso: startInstant.toISOString(),
							offsetMinutes,
						}),
						payload: {
							occurrenceId: occurrence.id,
							courseOfferingId: occurrence.courseOfferingId,
							occurrenceDate: occurrence.date.toString(),
							startTime: occurrence.startTime.toString(),
							endTime: occurrence.endTime.toString(),
							startAtIso: startInstant.toISOString(),
							location: occurrence.location,
							offsetMinutes,
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
				selectionsProcessed,
				jobsCreated,
				jobsAlreadyPresent,
				skipped,
			},
			'Class reminder scheduling completed',
		);

		return {
			subscriptionsProcessed,
			selectionsProcessed,
			jobsCreated,
			jobsAlreadyPresent,
			skipped,
		};
	}
}
