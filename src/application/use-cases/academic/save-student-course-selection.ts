import { UserAcademicSelection } from '../../../domain/academic/study-field.js';
import { NotFoundError } from '../../../domain/shared/errors.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';
import {
	resolveSelectionContext,
	uniqueIds,
	validateSelectedOfferings,
} from './course-selection-validation.js';

export interface SaveStudentCourseSelectionInput {
	userId: string;
	academicLevelId?: string | null;
	studyFieldId?: string | null;
	academicTermId?: string | null;
	selectedCourseOfferingIds: ReadonlyArray<string>;
	classReminderEnabled?: boolean;
	reminderOffsetMinutes?: number;
}

export class SaveStudentCourseSelection {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
		},
	) {}

	async execute(input: SaveStudentCourseSelectionInput): Promise<void> {
		const now = this.deps.clock.now();

		return this.deps.uow.run(async (repositories) => {
			const user = await repositories.users.findUserById(input.userId);
			if (!user) {
				throw new NotFoundError(`User ${input.userId} not found`);
			}

			let selection = await repositories.studentSelections.findActiveByUserId(
				input.userId,
			);

			const academicLevelId =
				input.academicLevelId !== undefined
					? input.academicLevelId
					: (selection?.academicLevelId ?? null);
			const studyFieldId =
				input.studyFieldId !== undefined
					? input.studyFieldId
					: (selection?.studyFieldId ?? null);
			const academicTermId =
				input.academicTermId !== undefined
					? input.academicTermId
					: (selection?.academicTermId ?? null);

			const context = await resolveSelectionContext(repositories, {
				academicLevelId,
				studyFieldId,
				academicTermId,
			});

			const uniqueOfferingIds = uniqueIds(input.selectedCourseOfferingIds);
			await validateSelectedOfferings(
				repositories,
				context,
				uniqueOfferingIds,
			);

			if (!selection) {
				selection = UserAcademicSelection.create({
					id: this.deps.ids.next(),
					userId: input.userId,
					academicLevelId: context.level.id,
					studyFieldId: context.field.id,
					academicTermId: context.term.id,
					classReminderEnabled: input.classReminderEnabled,
					reminderOffsetMinutes: input.reminderOffsetMinutes,
					updatedAt: now,
				});
				await repositories.studentSelections.create(selection);
			} else {
				selection = selection
					.withLevel(context.level.id)
					.withField(context.field.id)
					.withTerm(context.term.id);
				if (
					input.classReminderEnabled !== undefined ||
					input.reminderOffsetMinutes !== undefined
				) {
					selection = selection.withNotificationPreferences({
						classReminderEnabled: input.classReminderEnabled,
						reminderOffsetMinutes: input.reminderOffsetMinutes,
					});
				}
				await repositories.studentSelections.update(selection);
			}

			await repositories.studentSelections.replaceSelectedOfferings(
				selection.id,
				uniqueOfferingIds,
			);
			await repositories.jobs.cancelPendingBySelection(
				selection.id,
				now,
				'COURSE_SELECTION_CHANGED',
			);
			const subscription =
				await repositories.subscriptions.findActiveByUserId(input.userId);
			if (subscription) {
				await repositories.jobs.cancelPendingBySubscription(
					subscription.id,
					now,
					'STUDENT_SELECTION_ACTIVE',
				);
			}
		});
	}
}
