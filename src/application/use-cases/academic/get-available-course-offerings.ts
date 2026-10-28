import { NotFoundError } from '../../../domain/shared/errors.js';
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

			const fieldId = filter.studyFieldId ?? selection?.studyFieldId ?? null;
			const termId = filter.termId ?? selection?.academicTermId ?? null;

			if (!fieldId || !termId) {
				return [];
			}

			const [field, term] = await Promise.all([
				repositories.studyFields.findById(fieldId),
				repositories.academic.getTermById(termId),
			]);
			if (!field?.isActive) {
				throw new NotFoundError(`Study field ${fieldId} is not available`);
			}
			if (!term?.isActive) {
				throw new NotFoundError(`Academic term ${termId} is not available`);
			}

			const mappings =
				await repositories.studyFieldOfferingMappings.listByField(fieldId);
			if (mappings.length === 0) {
				return [];
			}

			const externalKeys = new Set(
				mappings.map((mapping) => mapping.courseOfferingExternalKey),
			);

			const offerings =
				await repositories.academic.listCourseOfferingsByTerm(termId);

			const result: CourseOfferingView[] = [];
			const seen = new Set<string>();
			for (const view of offerings) {
				const offering = view.courseOffering;
				if (!offering.isActive) continue;
				if (!externalKeys.has(offering.externalKey)) continue;
				if (seen.has(offering.id)) continue;
				seen.add(offering.id);
				result.push(view);
			}

			return result.sort((left, right) => {
				const courseCompare = left.course.code.localeCompare(right.course.code);
				if (courseCompare !== 0) return courseCompare;
				return (left.courseOffering.sectionCode ?? '').localeCompare(
					right.courseOffering.sectionCode ?? '',
				);
			});
		});
	}
}
