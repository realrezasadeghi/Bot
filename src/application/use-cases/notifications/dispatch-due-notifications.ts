import {
	type DeliveryAttempt,
	DeliveryAttemptStatus,
} from '../../../domain/notifications/delivery-attempt.js';
import type { NotificationJob } from '../../../domain/notifications/notification-job.js';
import {
	NotificationJobStatus,
	NotificationType,
} from '../../../domain/notifications/notification-job.js';
import { retryDelayMs } from '../../../domain/notifications/retry-policy.js';
import { LocalDate } from '../../../domain/shared/local-date.js';
import type { OutboundMessage } from '../../dto/messaging.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { Logger } from '../../ports/outbound/logger.js';
import type { MessagingPort } from '../../ports/outbound/messaging.js';
import type {
	Repositories,
	UnitOfWork,
} from '../../ports/outbound/unit-of-work.js';
import {
	formatClassReminder,
	formatDailySummary,
	formatExamReminder,
} from '../../services/notification-content.js';
import { toScheduleEntryDto } from '../../services/schedule-mapper.js';

type Decision =
	| { kind: 'send'; message: OutboundMessage; providerHint: string }
	| { kind: 'cancel'; reason: string };

export interface DispatchResult {
	claimed: number;
	sent: number;
	retried: number;
	failed: number;
	cancelled: number;
	lockLost: number;
}

export class DispatchDueNotifications {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			clock: Clock;
			ids: IdGenerator;
			logger: Logger;
			messaging: MessagingPort;
			workerId: string;
			lockTimeoutMs: number;
			batchSize: number;
		},
	) {}

	async execute(): Promise<DispatchResult> {
		const now = this.deps.clock.now();
		const jobs = await this.deps.uow.run((repositories) =>
			repositories.jobs.claimDue({
				now,
				workerId: this.deps.workerId,
				limit: this.deps.batchSize,
				lockTimeoutMs: this.deps.lockTimeoutMs,
			}),
		);

		const result: DispatchResult = {
			claimed: jobs.length,
			sent: 0,
			retried: 0,
			failed: 0,
			cancelled: 0,
			lockLost: 0,
		};

		for (const job of jobs) {
			try {
				const decision = await this.deps.uow.run((repositories) =>
					this.decide(job, repositories),
				);

				if (decision.kind === 'cancel') {
					const saved = await this.transition(job, (latest) =>
						latest.cancel(this.deps.clock.now(), decision.reason),
					);
					if (saved) result.cancelled += 1;
					else result.lockLost += 1;
					continue;
				}

				await this.deliver(job, decision, result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.deps.logger.error(
					{ jobId: job.id, error: message },
					'Notification job processing failed unexpectedly',
				);
				const saved = await this.transition(job, (latest) =>
					latest.markRetry(
						this.deps.clock.now(),
						message,
						retryDelayMs(job.attempts + 1),
					),
				);
				if (saved) result.retried += 1;
				else result.lockLost += 1;
			}
		}

		if (jobs.length > 0) {
			this.deps.logger.info(
				{ ...result },
				'Notification dispatch cycle completed',
			);
		}

		return result;
	}

	private async decide(
		job: NotificationJob,
		repositories: Repositories,
	): Promise<Decision> {
		const user = await repositories.users.findUserById(job.userId);
		if (!user) return { kind: 'cancel', reason: 'USER_NOT_FOUND' };

		if (job.selectionId) {
			return this.decideForSelection(job, user, repositories);
		}

		const subscriptionId = job.subscriptionId;
		if (!subscriptionId) {
			return { kind: 'cancel', reason: 'NOTIFICATION_OWNER_MISSING' };
		}

		const subscription =
			await repositories.subscriptions.findById(subscriptionId);
		if (!subscription?.isActive()) {
			return { kind: 'cancel', reason: 'SUBSCRIPTION_INACTIVE' };
		}

		const preference =
			await repositories.subscriptions.getPreferenceBySubscriptionId(
				subscription.id,
			);
		if (!preference) return { kind: 'cancel', reason: 'PREFERENCE_MISSING' };

		if (
			job.type === NotificationType.ClassReminder &&
			!preference.classReminderEnabled
		) {
			return { kind: 'cancel', reason: 'REMINDERS_DISABLED' };
		}
		if (
			job.type === NotificationType.DailySummary &&
			!preference.dailySummaryEnabled
		) {
			return { kind: 'cancel', reason: 'SUMMARIES_DISABLED' };
		}

		let identity = await repositories.users.findIdentityById(
			job.recipientIdentityId,
		);
		if (!identity || identity.userId !== user.id) {
			identity = await repositories.users.findPreferredIdentityForUser(user.id);
		}
		if (!identity) return { kind: 'cancel', reason: 'NO_PLATFORM_IDENTITY' };

		const programOffering = await repositories.academic.getProgramOffering(
			subscription.programOfferingId,
		);
		if (!programOffering) {
			return { kind: 'cancel', reason: 'PROGRAM_OFFERING_MISSING' };
		}

		const effectiveCourseIds = subscription.effectiveCourseOfferingIds(
			programOffering.courseOfferingIds,
		);

		const recipient = {
			platform: identity.platform,
			botScope: identity.botScope,
			externalUserId: identity.externalUserId,
			externalChatId: identity.externalChatId,
		};

		if (job.type === NotificationType.ClassReminder) {
			if (!job.occurrenceId) {
				return { kind: 'cancel', reason: 'REMINDER_WITHOUT_OCCURRENCE' };
			}

			const occurrence = await repositories.occurrences.findById(job.occurrenceId);
			if (!occurrence?.isActive()) {
				return { kind: 'cancel', reason: 'OCCURRENCE_CANCELLED_OR_MISSING' };
			}

			if (!effectiveCourseIds.has(occurrence.courseOfferingId)) {
				return { kind: 'cancel', reason: 'COURSE_NO_LONGER_SELECTED' };
			}

			const expectedStart = job.payload.startAtIso;
			if (typeof expectedStart !== 'string') {
				return { kind: 'cancel', reason: 'REMINDER_PAYLOAD_INVALID' };
			}
			const currentStart = occurrence.date.toUtcInstant(
				occurrence.startTime,
				user.timeZone,
			);
			if (currentStart.toISOString() !== expectedStart) {
				return { kind: 'cancel', reason: 'OCCURRENCE_RESCHEDULED' };
			}
			if (currentStart.getTime() <= this.deps.clock.now().getTime()) {
				return { kind: 'cancel', reason: 'REMINDER_TOO_LATE' };
			}

			const views = await repositories.occurrences.listForCourses(
				[occurrence.courseOfferingId],
				occurrence.date,
				occurrence.date,
			);
			const view = views.find(
				(candidate) => candidate.occurrence.id === occurrence.id,
			);
			if (!view) {
				return { kind: 'cancel', reason: 'OCCURRENCE_DETAILS_MISSING' };
			}

			const entry = toScheduleEntryDto(view);
			if (entry.status !== 'SCHEDULED') {
				return { kind: 'cancel', reason: 'OCCURRENCE_CANCELLED' };
			}

			const offsetMinutes = preference.reminderOffsetMinutes;
			return {
				kind: 'send',
				providerHint: identity.platform,
				message: {
					recipient,
					text: formatClassReminder({ entry, offsetMinutes }),
					buttons: [],
				},
			};
		}

		const localDateValue = job.payload.localDate;
		if (typeof localDateValue !== 'string') {
			return { kind: 'cancel', reason: 'SUMMARY_PAYLOAD_INVALID' };
		}

		const localDate = LocalDate.parse(localDateValue);
		const today = LocalDate.fromInstant(this.deps.clock.now(), user.timeZone);
		if (!localDate.equals(today)) {
			return { kind: 'cancel', reason: 'SUMMARY_STALE' };
		}

		if (effectiveCourseIds.size === 0) {
			return { kind: 'cancel', reason: 'NO_SELECTED_COURSES' };
		}

		const views = await repositories.occurrences.listForCourses(
			[...effectiveCourseIds],
			localDate,
			localDate,
		);
		const entries = views
			.filter((view) => view.occurrence.isActive())
			.map(toScheduleEntryDto)
			.sort((left, right) => left.startTime.localeCompare(right.startTime));

		if (entries.length === 0 && !preference.notifyOnEmptyDays) {
			return { kind: 'cancel', reason: 'EMPTY_DAY' };
		}

		return {
			kind: 'send',
			providerHint: identity.platform,
			message: {
				recipient,
				text: formatDailySummary({
					date: localDate.toString(),
					entries,
					notifyOnEmptyDays: preference.notifyOnEmptyDays,
				}),
				buttons: [],
			},
		};
	}

	private async decideForSelection(
		job: NotificationJob,
		user: Awaited<ReturnType<Repositories['users']['findUserById']>>,
		repositories: Repositories,
	): Promise<Decision> {
		if (!user || !job.selectionId) {
			return { kind: 'cancel', reason: 'SELECTION_OWNER_MISSING' };
		}

		const selection = await repositories.studentSelections.findById(
			job.selectionId,
		);
		if (!selection?.isActive || selection.userId !== user.id) {
			return { kind: 'cancel', reason: 'SELECTION_INACTIVE' };
		}

		if (job.type === NotificationType.ExamReminder) {
			return this.decideForExam(job, user, selection, repositories);
		}
		if (job.type !== NotificationType.ClassReminder) {
			return { kind: 'cancel', reason: 'UNSUPPORTED_SELECTION_NOTIFICATION' };
		}
		if (!selection.classReminderEnabled) {
			return { kind: 'cancel', reason: 'REMINDERS_DISABLED' };
		}

		let identity = await repositories.users.findIdentityById(
			job.recipientIdentityId,
		);
		if (!identity || identity.userId !== user.id) {
			identity = await repositories.users.findPreferredIdentityForUser(user.id);
		}
		if (!identity) return { kind: 'cancel', reason: 'NO_PLATFORM_IDENTITY' };

		if (!job.occurrenceId) {
			return { kind: 'cancel', reason: 'REMINDER_WITHOUT_OCCURRENCE' };
		}

		const occurrence = await repositories.occurrences.findById(job.occurrenceId);
		if (!occurrence?.isActive()) {
			return { kind: 'cancel', reason: 'OCCURRENCE_CANCELLED_OR_MISSING' };
		}

		const selectedOfferingIds =
			await repositories.studentSelections.listSelectedOfferings(selection.id);
		if (!selectedOfferingIds.includes(occurrence.courseOfferingId)) {
			return { kind: 'cancel', reason: 'COURSE_NO_LONGER_SELECTED' };
		}

		const expectedStart = job.payload.startAtIso;
		if (typeof expectedStart !== 'string') {
			return { kind: 'cancel', reason: 'REMINDER_PAYLOAD_INVALID' };
		}
		const currentStart = occurrence.date.toUtcInstant(
			occurrence.startTime,
			user.timeZone,
		);
		if (currentStart.toISOString() !== expectedStart) {
			return { kind: 'cancel', reason: 'OCCURRENCE_RESCHEDULED' };
		}
		if (currentStart.getTime() <= this.deps.clock.now().getTime()) {
			return { kind: 'cancel', reason: 'REMINDER_TOO_LATE' };
		}

		const views = await repositories.occurrences.listForCourses(
			[occurrence.courseOfferingId],
			occurrence.date,
			occurrence.date,
		);
		const view = views.find(
			(candidate) => candidate.occurrence.id === occurrence.id,
		);
		if (!view) {
			return { kind: 'cancel', reason: 'OCCURRENCE_DETAILS_MISSING' };
		}

		const entry = toScheduleEntryDto(view);
		if (entry.status !== 'SCHEDULED') {
			return { kind: 'cancel', reason: 'OCCURRENCE_CANCELLED' };
		}

		return {
			kind: 'send',
			providerHint: identity.platform,
			message: {
				recipient: {
					platform: identity.platform,
					botScope: identity.botScope,
					externalUserId: identity.externalUserId,
					externalChatId: identity.externalChatId,
				},
				text: formatClassReminder({
					entry,
					offsetMinutes: selection.reminderOffsetMinutes,
				}),
				buttons: [],
			},
		};
	}

	private async decideForExam(
		job: NotificationJob,
		user: NonNullable<Awaited<ReturnType<Repositories['users']['findUserById']>>>,
		selection: NonNullable<
			Awaited<ReturnType<Repositories['studentSelections']['findActiveByUserId']>>
		>,
		repositories: Repositories,
	): Promise<Decision> {
		const examinationId = job.payload.examinationId;
		if (typeof examinationId !== 'string') {
			return { kind: 'cancel', reason: 'EXAM_PAYLOAD_INVALID' };
		}

		const selectedOfferingIds =
			await repositories.studentSelections.listSelectedOfferings(selection.id);
		if (selectedOfferingIds.length === 0) {
			return { kind: 'cancel', reason: 'NO_SELECTED_COURSES' };
		}

		const examinations =
			await repositories.examinations.listByCourseOfferingIds(selectedOfferingIds);
		const examination = examinations.find(
			(candidate) => candidate.id === examinationId,
		);
		if (!examination?.isActive() || !examination.startTime) {
			return { kind: 'cancel', reason: 'EXAMINATION_CANCELLED_OR_MISSING' };
		}
		if (!selectedOfferingIds.includes(examination.courseOfferingId)) {
			return { kind: 'cancel', reason: 'COURSE_NO_LONGER_SELECTED' };
		}

		const expectedStart = job.payload.startAtIso;
		if (typeof expectedStart !== 'string') {
			return { kind: 'cancel', reason: 'EXAM_PAYLOAD_INVALID' };
		}
		const currentStart = examination.examDate.toUtcInstant(
			examination.startTime,
			user.timeZone,
		);
		if (currentStart.toISOString() !== expectedStart) {
			return { kind: 'cancel', reason: 'EXAMINATION_RESCHEDULED' };
		}
		if (currentStart.getTime() <= this.deps.clock.now().getTime()) {
			return { kind: 'cancel', reason: 'REMINDER_TOO_LATE' };
		}

		let identity = await repositories.users.findIdentityById(
			job.recipientIdentityId,
		);
		if (!identity || identity.userId !== user.id) {
			identity = await repositories.users.findPreferredIdentityForUser(user.id);
		}
		if (!identity) return { kind: 'cancel', reason: 'NO_PLATFORM_IDENTITY' };

		const offerings = await repositories.academic.listCourseOfferingsByIds([
			examination.courseOfferingId,
		]);
		const view = offerings[0];
		if (!view) return { kind: 'cancel', reason: 'COURSE_OFFERING_MISSING' };

		const offsetMinutes =
			typeof job.payload.offsetMinutes === 'number'
				? job.payload.offsetMinutes
				: 0;

		return {
			kind: 'send',
			providerHint: identity.platform,
			message: {
				recipient: {
					platform: identity.platform,
					botScope: identity.botScope,
					externalUserId: identity.externalUserId,
					externalChatId: identity.externalChatId,
				},
				text: formatExamReminder({
					examination: {
						examinationId: examination.id,
						courseOfferingId: examination.courseOfferingId,
						courseCode: view.course.code,
						courseTitle: view.course.title,
						sectionCode: view.courseOffering.sectionCode,
						instructorNames: view.instructors.map(
							(instructor) => instructor.fullName,
						),
						examDate: examination.examDate.toString(),
						startTime: examination.startTime.toString(),
						endTime: examination.endTime?.toString() ?? null,
						location: examination.location,
						sourceIdentifier: examination.sourceIdentifier,
						status: 'SCHEDULED',
					},
					offsetMinutes,
				}),
				buttons: [],
			},
		};
	}

	private async deliver(
		job: NotificationJob,
		decision: Extract<Decision, { kind: 'send' }>,
		result: DispatchResult,
	): Promise<void> {
		const attemptNo = job.attempts + 1;
		const startedAt = this.deps.clock.now();
		let provider = decision.providerHint;
		let providerMessageId: string | null = null;
		let delivered = false;
		let retryable = true;
		let retryAfterMs: number | null = null;
		let error: string | null = null;

		try {
			const sendResult = await this.deps.messaging.send(decision.message);
			provider = sendResult.provider;
			providerMessageId = sendResult.providerMessageId;
			delivered = sendResult.delivered;
			retryable = sendResult.retryable;
			retryAfterMs = sendResult.retryAfterMs;
			error = sendResult.error;
		} catch (sendError) {
			error = sendError instanceof Error ? sendError.message : String(sendError);
		}

		const finishedAt = this.deps.clock.now();
		const attempt: DeliveryAttempt = {
			id: this.deps.ids.next(),
			jobId: job.id,
			attemptNo,
			provider,
			status: delivered
				? DeliveryAttemptStatus.Delivered
				: DeliveryAttemptStatus.Failed,
			providerMessageId,
			error,
			startedAt,
			finishedAt,
		};

		const saved = await this.transition(
			job,
			(latest) => {
				if (delivered) {
					return latest.markSent(finishedAt);
				}
				if (retryable) {
					return latest.markRetry(
						finishedAt,
						error ?? 'Notification delivery failed',
						retryAfterMs ?? retryDelayMs(attemptNo),
					);
				}
				return latest.markFailed(
					finishedAt,
					error ?? 'Notification delivery failed permanently',
				);
			},
			attempt,
		);

		if (!saved) {
			result.lockLost += 1;
			this.deps.logger.warn(
				{ jobId: job.id, attemptNo },
				'Delivery completed but job lock was lost; duplicate delivery is possible',
			);
			return;
		}

		if (delivered) result.sent += 1;
		else if (retryable) result.retried += 1;
		else result.failed += 1;
	}

	private async transition(
		job: NotificationJob,
		transition: (latest: NotificationJob) => NotificationJob,
		attempt?: DeliveryAttempt,
	): Promise<boolean> {
		return this.deps.uow.run(async (repositories) => {
			const latest = await repositories.jobs.findByIdForUpdate(job.id);
			if (
				!latest ||
				latest.status !== NotificationJobStatus.Claimed ||
				latest.lockedBy !== this.deps.workerId
			) {
				return false;
			}

			if (attempt) {
				await repositories.jobs.recordDeliveryAttempt(attempt);
			}
			await repositories.jobs.save(transition(latest));
			return true;
		});
	}
}
