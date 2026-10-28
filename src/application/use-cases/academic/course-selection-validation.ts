import type { AcademicLevel, AcademicTerm } from '../../../domain/academic/entities.js';
import type { CourseOfferingView } from '../../dto/read-models.js';
import { NotFoundError, ValidationError } from '../../../domain/shared/errors.js';
import type { StudyField } from '../../../domain/academic/study-field.js';
import type { Repositories } from '../../ports/outbound/unit-of-work.js';

export interface SelectionContext {
	level: AcademicLevel;
	field: StudyField;
	term: AcademicTerm;
}

export function uniqueIds(ids: ReadonlyArray<string>): string[] {
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const id of ids) {
		const trimmed = id.trim();
		if (trimmed.length === 0) {
			throw new ValidationError('Course offering IDs must not be empty');
		}
		if (seen.has(trimmed)) continue;
		seen.add(trimmed);
		unique.push(trimmed);
	}
	return unique;
}

export async function resolveSelectionContext(
	repositories: Repositories,
	input: {
		academicLevelId: string | null;
		studyFieldId: string | null;
		academicTermId: string | null;
	},
): Promise<SelectionContext> {
	if (!input.academicLevelId || !input.studyFieldId || !input.academicTermId) {
		throw new ValidationError(
			'Academic level, study field and academic term are required',
		);
	}

	const [levels, fields] = await Promise.all([
		repositories.academic.listLevels(),
		repositories.studyFields.listByLevel(input.academicLevelId),
	]);
	const level = levels.find((candidate) => candidate.id === input.academicLevelId);
	if (!level) {
		throw new NotFoundError(
			`Academic level ${input.academicLevelId} was not found`,
		);
	}

	const field = fields.find(
		(candidate) =>
			candidate.id === input.studyFieldId && candidate.isActive,
	);
	if (!field) {
		throw new NotFoundError(
			`Study field ${input.studyFieldId} is not available for level ${input.academicLevelId}`,
		);
	}
	if (field.academicLevelId !== level.id) {
		throw new ValidationError(
			'Study field does not belong to the selected academic level',
		);
	}

	const term = await repositories.academic.getTermById(input.academicTermId);
	if (!term) {
		throw new NotFoundError(
			`Academic term ${input.academicTermId} was not found`,
		);
	}
	if (!term.isActive) {
		throw new ValidationError(
			`Academic term ${input.academicTermId} is not active`,
		);
	}

	return { level, field, term };
}

export async function validateSelectedOfferings(
	repositories: Repositories,
	context: SelectionContext,
	courseOfferingIds: ReadonlyArray<string>,
): Promise<CourseOfferingView[]> {
	const uniqueOfferingIds = uniqueIds(courseOfferingIds);
	if (uniqueOfferingIds.length === 0) return [];

	const [offerings, mappings] = await Promise.all([
		repositories.academic.listCourseOfferingsByIds(uniqueOfferingIds),
		repositories.studyFieldOfferingMappings.listByField(context.field.id),
	]);

	if (offerings.length !== uniqueOfferingIds.length) {
		const found = new Set(offerings.map((view) => view.courseOffering.id));
		const missing = uniqueOfferingIds.filter((id) => !found.has(id));
		throw new NotFoundError(
			`Course offering(s) not found: ${missing.join(', ')}`,
		);
	}

	const mappedExternalKeys = new Set(
		mappings.map((mapping) => mapping.courseOfferingExternalKey),
	);

	for (const view of offerings) {
		const offering = view.courseOffering;
		if (!offering.isActive) {
			throw new ValidationError(
				`Course offering ${offering.id} is not active`,
			);
		}
		if (offering.termId !== context.term.id) {
			throw new ValidationError(
				`Course offering ${offering.id} does not belong to the selected term`,
			);
		}
		if (!mappedExternalKeys.has(offering.externalKey)) {
			throw new ValidationError(
				`Course offering ${offering.id} is not mapped to study field ${context.field.id}`,
			);
		}
	}

	return offerings;
}
