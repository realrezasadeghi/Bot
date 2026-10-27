import type { CourseOfferingView } from '../../dto/read-models.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface CourseOfferingFilter {
	studyFieldId?: string;
	termId?: string;
}

export class GetAvailableCourseOfferings {
	constructor(private readonly uow: UnitOfWork) {}

	async execute(
		userId: string,
		filter: CourseOfferingFilter = {},
	): Promise<CourseOfferingView[]> {
		return this.uow.run(async (repositories) => {
			const selection =
				await repositories.studentSelections.findActiveByUserId(userId);
			if (!selection) {
				return [];
			}

			const fieldId = filter.studyFieldId ?? selection.studyFieldId;
			const termId = filter.termId ?? selection.academicTermId;

			if (!fieldId || !termId) {
				return [];
			}

			const mappings =
				await repositories.studyFieldOfferingMappings.listByField(fieldId);
			if (mappings.length === 0) {
				return [];
			}

			const externalKeys = mappings.map(
				(mapping) => mapping.courseOfferingExternalKey,
			);

			const offerings =
				await repositories.academic.listCourseOfferingsByTerm(termId);

			const externalKeyToView = new Map(
				offerings.map((view) => [view.courseOffering.externalKey, view]),
			);

			const result: CourseOfferingView[] = [];
			const seen = new Set<string>();
			for (const externalKey of externalKeys) {
				const view = externalKeyToView.get(externalKey);
				if (view && !seen.has(view.courseOffering.id)) {
					seen.add(view.courseOffering.id);
					result.push(view);
				}
			}

			return result;
		});
	}
}
