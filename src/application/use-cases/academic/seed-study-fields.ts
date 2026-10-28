import { AcademicLevel } from '../../../domain/academic/entities.js';
import { StudyField } from '../../../domain/academic/study-field.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export const UNDERGRADUATE_LEVEL_ID = '5b1f5c3e-9a2d-4a7b-8c1e-0d1f2a3b4c5d';

export const SEED_ACADEMIC_LEVELS: ReadonlyArray<{
	id: string;
	code: string;
	title: string;
}> = [
	{
		id: UNDERGRADUATE_LEVEL_ID,
		code: 'UNDERGRADUATE',
		title: 'Undergraduate',
	},
];

export const SEED_STUDY_FIELDS: ReadonlyArray<{
	id: string;
	name: string;
	code: string;
	description: string;
	academicLevelId: string;
	isActive: boolean;
	sortOrder: number;
}> = [
	{
		id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
		name: 'Computer Engineering',
		code: 'COMP-ENG',
		description: 'Computer engineering program',
		academicLevelId: UNDERGRADUATE_LEVEL_ID,
		isActive: true,
		sortOrder: 1,
	},
	{
		id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
		name: 'Electrical Engineering',
		code: 'ELEC-ENG',
		description: 'Electrical engineering program',
		academicLevelId: UNDERGRADUATE_LEVEL_ID,
		isActive: true,
		sortOrder: 2,
	},
	{
		id: '3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f',
		name: 'Mechanical Engineering',
		code: 'MECH-ENG',
		description: 'Mechanical engineering program',
		academicLevelId: UNDERGRADUATE_LEVEL_ID,
		isActive: true,
		sortOrder: 3,
	},
	{
		id: '4d5e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80',
		name: 'Business Administration',
		code: 'BUS-ADMIN',
		description: 'Business administration program',
		academicLevelId: UNDERGRADUATE_LEVEL_ID,
		isActive: true,
		sortOrder: 4,
	},
];

export async function seedStudyFields(uow: UnitOfWork): Promise<void> {
	await uow.run(async (repositories) => {
		for (const level of SEED_ACADEMIC_LEVELS) {
			await repositories.academic.upsertLevel(AcademicLevel.create(level));
		}

		for (const fieldData of SEED_STUDY_FIELDS) {
			const existing = await repositories.studyFields.findByCode(fieldData.code);
			if (existing) {
				await repositories.studyFields.update(
					StudyField.create({
						...fieldData,
						id: existing.id,
					}),
				);
			} else {
				await repositories.studyFields.create(StudyField.create(fieldData));
			}
		}
	});
}
