import { asc, eq } from 'drizzle-orm';
import type { StudyFieldOfferingMappingRepository } from '../../../../application/ports/outbound/study-field-offering-mapping-repository.js';
import { StudyFieldOfferingMapping } from '../../../../domain/academic/study-field.js';
import type { AppDatabase } from './db.js';
import { studyFieldOfferingMappings } from './schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

function toStudyFieldOfferingMapping(
	row: Row<typeof studyFieldOfferingMappings>,
): StudyFieldOfferingMapping {
	return StudyFieldOfferingMapping.create({
		id: row.id,
		studyFieldId: row.studyFieldId,
		courseOfferingExternalKey: row.courseOfferingExternalKey,
	});
}

export class PostgresStudyFieldOfferingMappingRepository
	implements StudyFieldOfferingMappingRepository
{
	constructor(private readonly db: AppDatabase) {}

	async create(
		mapping: StudyFieldOfferingMapping,
	): Promise<StudyFieldOfferingMapping> {
		const [row] = await this.db
			.insert(studyFieldOfferingMappings)
			.values({
				id: mapping.id,
				studyFieldId: mapping.studyFieldId,
				courseOfferingExternalKey: mapping.courseOfferingExternalKey,
			})
			.returning();
		if (!row) throw new Error('unreachable: insert should return a row');
		return toStudyFieldOfferingMapping(row);
	}

	async deleteByField(fieldId: string): Promise<void> {
		await this.db
			.delete(studyFieldOfferingMappings)
			.where(eq(studyFieldOfferingMappings.studyFieldId, fieldId));
	}

	async deleteByOfferingExternalKey(
		courseOfferingExternalKey: string,
	): Promise<void> {
		await this.db
			.delete(studyFieldOfferingMappings)
			.where(
				eq(
					studyFieldOfferingMappings.courseOfferingExternalKey,
					courseOfferingExternalKey,
				),
			);
	}

	async listByField(fieldId: string): Promise<StudyFieldOfferingMapping[]> {
		const rows = await this.db
			.select()
			.from(studyFieldOfferingMappings)
			.where(eq(studyFieldOfferingMappings.studyFieldId, fieldId))
			.orderBy(asc(studyFieldOfferingMappings.courseOfferingExternalKey));
		return rows.map(toStudyFieldOfferingMapping);
	}

	async listByOfferingExternalKey(
		courseOfferingExternalKey: string,
	): Promise<StudyFieldOfferingMapping[]> {
		const rows = await this.db
			.select()
			.from(studyFieldOfferingMappings)
			.where(
				eq(
					studyFieldOfferingMappings.courseOfferingExternalKey,
					courseOfferingExternalKey,
				),
			)
			.orderBy(asc(studyFieldOfferingMappings.studyFieldId));
		return rows.map(toStudyFieldOfferingMapping);
	}
}
