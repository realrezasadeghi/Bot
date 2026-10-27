import type { UnitOfWork } from '../../../application/ports/outbound/unit-of-work.js';
import { StudyField } from '../../../domain/academic/study-field.js';

/**
 * Seed data for application-defined academic fields.
 *
 * These fields are managed by our application, not imported from the university
 * portal. They provide the discovery and filtering mechanism for students to
 * find relevant course offerings.
 *
 * To add or modify fields, edit this file and re-run the seed script.
 * Future administrative CRUD interfaces can manage these without changing
 * the student selection workflow.
 */
export const SEED_STUDY_FIELDS: Array<
	Omit<Parameters<typeof StudyField.create>[0], 'id'>
> = [
	{
		name: 'Computer Engineering',
		code: 'COMP-ENG',
		description: 'Computer engineering program',
		academicLevelId: 'level-undergraduate',
		isActive: true,
		sortOrder: 1,
	},
	{
		name: 'Electrical Engineering',
		code: 'ELEC-ENG',
		description: 'Electrical engineering program',
		academicLevelId: 'level-undergraduate',
		isActive: true,
		sortOrder: 2,
	},
	{
		name: 'Mechanical Engineering',
		code: 'MECH-ENG',
		description: 'Mechanical engineering program',
		academicLevelId: 'level-undergraduate',
		isActive: true,
		sortOrder: 3,
	},
	{
		name: 'Business Administration',
		code: 'BUS-ADMIN',
		description: 'Business administration program',
		academicLevelId: 'level-undergraduate',
		isActive: true,
		sortOrder: 4,
	},
];

export async function seedStudyFields(uow: UnitOfWork): Promise<void> {
	const { studyFields } = uow as any;
	if (!studyFields) {
		throw new Error(
			'UnitOfWork does not expose studyFields repository. Ensure student-selection repositories are wired.',
		);
	}

	for (const fieldData of SEED_STUDY_FIELDS) {
		const existing = await studyFields.findByCode(fieldData.code);
		if (existing) {
			// Update if fields have changed
			await studyFields.update(
				StudyField.create({
					...existing,
					...fieldData,
				}),
			);
		} else {
			await studyFields.create(
				StudyField.create({
					...fieldData,
					id: `field-${fieldData.code.toLowerCase()}`,
				}),
			);
		}
	}
}
