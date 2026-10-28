import { StudyFieldOfferingMapping } from '../../../domain/academic/study-field.js';
import { NotFoundError, ValidationError } from '../../../domain/shared/errors.js';
import type { IdGenerator } from '../../ports/outbound/id-generator.js';
import type { UnitOfWork } from '../../ports/outbound/unit-of-work.js';

export interface StudyFieldMappingSeed {
	studyFieldCode: string;
	courseOfferingExternalKeys: ReadonlyArray<string>;
}

export async function seedStudyFieldMappings(
	uow: UnitOfWork,
	ids: IdGenerator,
	seeds: ReadonlyArray<StudyFieldMappingSeed>,
): Promise<number> {
	let created = 0;
	await uow.run(async (repositories) => {
		for (const seed of seeds) {
			if (!seed.studyFieldCode.trim()) {
				throw new ValidationError('studyFieldCode is required');
			}
			const field = await repositories.studyFields.findByCode(
				seed.studyFieldCode,
			);
			if (!field) {
				throw new NotFoundError(
					`Study field ${seed.studyFieldCode} was not found`,
				);
			}

			const existing =
				await repositories.studyFieldOfferingMappings.listByField(field.id);
			const existingKeys = new Set(
				existing.map((mapping) => mapping.courseOfferingExternalKey),
			);

			for (const externalKey of seed.courseOfferingExternalKeys) {
				const trimmed = externalKey.trim();
				if (!trimmed || existingKeys.has(trimmed)) continue;
				await repositories.studyFieldOfferingMappings.create(
					StudyFieldOfferingMapping.create({
						id: ids.next(),
						studyFieldId: field.id,
						courseOfferingExternalKey: trimmed,
					}),
				);
				existingKeys.add(trimmed);
				created += 1;
			}
		}
	});
	return created;
}
