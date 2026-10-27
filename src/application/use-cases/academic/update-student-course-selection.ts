import { UserAcademicSelection } from '../../../domain/academic/study-field.js';
import { NotFoundError } from '../../../domain/shared/errors.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface UpdateStudentCourseSelectionInput {
	userId: string;
	addCourseOfferingIds?: ReadonlyArray<string>;
	removeCourseOfferingIds?: ReadonlyArray<string>;
}

export class UpdateStudentCourseSelection {
	constructor(
		private readonly deps: {
			uow: UnitOfWork;
			ids: IdGenerator;
			clock: Clock;
		},
	) {}

	async execute(input: UpdateStudentCourseSelectionInput): Promise<void> {
		const now = this.deps.clock.now();

		return this.deps.uow.run(async (repositories) => {
			const selection = await repositories.studentSelections.findActiveByUserId(
				input.userId,
			);
			if (!selection) {
				throw new NotFoundError(
					`No active academic selection for user ${input.userId}`,
				);
			}

			const currentOfferings =
				await repositories.studentSelections.listSelectedOfferings(selection.id);

			const toAdd = (input.addCourseOfferingIds ?? []).filter(
				(id) => !currentOfferings.includes(id),
			);
			const toRemove = (input.removeCourseOfferingIds ?? []).filter((id) =>
				currentOfferings.includes(id),
			);

			for (const offeringId of toAdd) {
				await repositories.studentSelections.addSelectedOffering(
					selection.id,
					offeringId,
				);
			}
			for (const offeringId of toRemove) {
				await repositories.studentSelections.removeSelectedOffering(
					selection.id,
					offeringId,
				);
			}

			await repositories.studentSelections.update(
				UserAcademicSelection.create({
					id: selection.id,
					userId: selection.userId,
					academicLevelId: selection.academicLevelId,
					studyFieldId: selection.studyFieldId,
					academicTermId: selection.academicTermId,
					isActive: selection.isActive,
					updatedAt: now,
				}),
			);
		});
	}
}
