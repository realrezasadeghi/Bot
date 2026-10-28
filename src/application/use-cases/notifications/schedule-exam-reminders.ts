import { examReminderIdempotencyKey } from '../../../domain/notifications/idempotency.js';
import {
	NotificationJob,
	NotificationType,
} from '../../../domain/notifications/notification-job.js';
import { LocalDate } from '../../../domain/shared/local-date.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface ScheduleExamRemindersResult {
	enabled: boolean;
	selectionsProcessed: number;
	jobsCreated: number;
	jobsAlreadyPresent: number;
	skipped: number;
}

export class ScheduleExamReminders {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
			logger: Logger;
			enabled: boolean;
			horizonDays: number;
			offsetsMinutes: ReadonlyArray<number>;
		},
	) {}

	async execute(): Promise<ScheduleExamRemindersResult> {
		if (!this.deps.enabled) {
			this.deps.logger.info(
				{},
				'Exam reminder scheduling is disabled until examination data is verified',
			);
			return {
				enabled: false,
				selectionsProcessed: 0,
				jobsCreated: 0,
				jobsAlreadyPresent: 0,
				skipped: 0,
			};
		}

		const now = this.deps.clock.now();
		let selectionsProcessed = 0;
		let jobsCreated = 0;
		let jobsAlreadyPresent = 0;
		let skipped = 0;

		await this.deps.uow.run(async (repositories) => {
			const selections = await repositories.studentSelections.listActive();
			for (const { selection, courseOfferingIds } of selections) {
				if (courseOfferingIds.length === 0) {
					skipped += 1;
					continue;
				}

				const user = await repositories.users.findUserById(selection.userId);
				const identity =
					await repositories.users.findPreferredIdentityForUser(
						selection.userId,
					);
				if (!user || !identity) {
					skipped += 1;
					continue;
				}

				const today = LocalDate.fromInstant(now, user.timeZone);
				const horizonEnd = today.addDays(this.deps.horizonDays - 1);
				const examinations =
					await repositories.examinations.listUpcomingForCourseOfferingIds(
						courseOfferingIds,
						today,
						horizonEnd,
					);

				selectionsProcessed += 1;

				for (const examination of examinations) {
					if (!examination.isActive() || !examination.startTime) {
						skipped += 1;
						continue;
					}

					const startInstant = examination.examDate.toUtcInstant(
						examination.startTime,
						user.timeZone,
					);

					for (const offsetMinutes of this.deps.offsetsMinutes) {
						const dueAt = new Date(
							startInstant.getTime() - offsetMinutes * 60_000,
						);
						if (dueAt.getTime() <= now.getTime()) {
							skipped += 1;
							continue;
						}

						const job = NotificationJob.create({
							id: this.deps.ids.next(),
							type: NotificationType.ExamReminder,
							userId: user.id,
							selectionId: selection.id,
							recipientIdentityId: identity.id,
							dueAt,
							idempotencyKey: examReminderIdempotencyKey({
								selectionId: selection.id,
								examinationId: examination.id,
								examStartAtIso: startInstant.toISOString(),
								offsetMinutes,
							}),
							payload: {
								examinationId: examination.id,
								courseOfferingId: examination.courseOfferingId,
								examDate: examination.examDate.toString(),
								startTime: examination.startTime.toString(),
								endTime: examination.endTime?.toString() ?? null,
								startAtIso: startInstant.toISOString(),
								location: examination.location,
								offsetMinutes,
							},
							createdAt: now,
						});

						const result = await repositories.jobs.enqueue(job);
						if (result.created) jobsCreated += 1;
						else jobsAlreadyPresent += 1;
					}
				}
			}
		});

		this.deps.logger.info(
			{ selectionsProcessed, jobsCreated, jobsAlreadyPresent, skipped },
			'Exam reminder scheduling completed',
		);

		return {
			enabled: true,
			selectionsProcessed,
			jobsCreated,
			jobsAlreadyPresent,
			skipped,
		};
	}
}
