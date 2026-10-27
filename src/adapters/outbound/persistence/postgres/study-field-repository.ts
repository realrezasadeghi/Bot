import { and, asc, eq, type SQL } from 'drizzle-orm';
import type { StudyFieldRepository } from '../../../../application/ports/outbound/study-field-repository.js';
import { StudyField } from '../../../../domain/academic/study-field.js';
import type { AppDatabase } from './db.js';
import { studyFields } from './schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

function toStudyField(row: Row<typeof studyFields>): StudyField {
	return StudyField.create({
		id: row.id,
		name: row.name,
		code: row.code,
		description: row.description,
		academicLevelId: row.academicLevelId,
		isActive: row.isActive,
		sortOrder: row.sortOrder,
	});
}

export class PostgresStudyFieldRepository implements StudyFieldRepository {
	constructor(private readonly db: AppDatabase) {}

	async create(field: StudyField): Promise<StudyField> {
		const [row] = await this.db
			.insert(studyFields)
			.values({
				id: field.id,
				name: field.name,
				code: field.code,
				description: field.description,
				academicLevelId: field.academicLevelId,
				isActive: field.isActive,
				sortOrder: field.sortOrder,
			})
			.returning();
		if (!row) throw new Error('unreachable: insert should return a row');
		return toStudyField(row);
	}

	async update(field: StudyField): Promise<StudyField> {
		const [row] = await this.db
			.update(studyFields)
			.set({
				name: field.name,
				code: field.code,
				description: field.description,
				academicLevelId: field.academicLevelId,
				isActive: field.isActive,
				sortOrder: field.sortOrder,
				updatedAt: new Date(),
			})
			.where(eq(studyFields.id, field.id))
			.returning();
		if (!row) throw new Error('unreachable: update should return a row');
		return toStudyField(row);
	}

	async findById(id: string): Promise<StudyField | null> {
		const [row] = await this.db
			.select()
			.from(studyFields)
			.where(eq(studyFields.id, id))
			.limit(1);
		if (!row) return null;
		return toStudyField(row);
	}

	async findByCode(code: string): Promise<StudyField | null> {
		const [row] = await this.db
			.select()
			.from(studyFields)
			.where(eq(studyFields.code, code))
			.limit(1);
		if (!row) return null;
		return toStudyField(row);
	}

	async listByLevel(levelId?: string): Promise<StudyField[]> {
		const conditions: SQL[] = [];
		if (levelId) {
			conditions.push(eq(studyFields.academicLevelId, levelId));
		}

		const rows = await this.db
			.select()
			.from(studyFields)
			.where(and(...conditions))
			.orderBy(asc(studyFields.sortOrder), asc(studyFields.name));
		return rows.map(toStudyField);
	}

	async listActive(): Promise<StudyField[]> {
		const rows = await this.db
			.select()
			.from(studyFields)
			.where(eq(studyFields.isActive, true))
			.orderBy(asc(studyFields.sortOrder), asc(studyFields.name));
		return rows.map(toStudyField);
	}

	async deactivate(id: string): Promise<void> {
		await this.db
			.update(studyFields)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(studyFields.id, id));
	}
}
