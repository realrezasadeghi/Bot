import { UserAcademicSelection } from '../../../domain/academic/study-field.js';
import type { Clock } from '../../ports/outbound/clock.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface SaveStudentCourseSelectionInput {
	userId: string;
	academicLevelId?: string | null;
	studyFieldId?: string | null;
	academicTermId?: string | null;
	selectedCourseOfferingIds: ReadonlyArray<string>;
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
		const _now = this.deps.clock.now();

		return this.deps.uow.run(async (repositories) => {
			let selection = await repositories.studentSelections.findActiveByUserId(
				input.userId,
			);

			if (!selection) {
				selection = UserAcademicSelection.create({
					id: this.deps.ids.next(),
					userId: input.userId,
					academicLevelId: input.academicLevelId ?? null,
					studyFieldId: input.studyFieldId ?? null,
					academicTermId: input.academicTermId ?? null,
				});
				await repositories.studentSelections.create(selection);
			} else {
				if (input.academicLevelId !== undefined) {
					selection = selection.withLevel(input.academicLevelId);
				}
				if (input.studyFieldId !== undefined) {
					selection = selection.withField(input.studyFieldId);
				}
				if (input.academicTermId !== undefined) {
					selection = selection.withTerm(input.academicTermId);
				}
				await repositories.studentSelections.update(selection);
			}

			await repositories.studentSelections.replaceSelectedOfferings(
				selection.id,
				input.selectedCourseOfferingIds,
			);
		});
	}
}
