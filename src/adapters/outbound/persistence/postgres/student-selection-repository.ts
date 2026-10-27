import { and, eq } from 'drizzle-orm';
import type { StudentSelectionRepository } from '../../../../application/ports/outbound/student-selection-repository.js';
import { UserAcademicSelection } from '../../../../domain/academic/study-field.js';
import type { AppDatabase } from './db.js';
import {
	studentAcademicSelections,
	studentSelectedOfferings,
} from './schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

function toUserAcademicSelection(
	row: Row<typeof studentAcademicSelections>,
): UserAcademicSelection {
	return UserAcademicSelection.create({
		id: row.id,
		userId: row.userId,
		academicLevelId: row.academicLevelId,
		studyFieldId: row.studyFieldId,
		academicTermId: row.academicTermId,
		isActive: row.isActive,
		updatedAt: row.updatedAt,
	});
}

export class PostgresStudentSelectionRepository
	implements StudentSelectionRepository
{
	constructor(private readonly db: AppDatabase) {}

	async create(
		selection: UserAcademicSelection,
	): Promise<UserAcademicSelection> {
		const [row] = await this.db
			.insert(studentAcademicSelections)
			.values({
				id: selection.id,
				userId: selection.userId,
				academicLevelId: selection.academicLevelId,
				studyFieldId: selection.studyFieldId,
				academicTermId: selection.academicTermId,
				isActive: selection.isActive,
				updatedAt: selection.updatedAt,
			})
			.returning();
		if (!row) throw new Error('unreachable: insert should return a row');
		return toUserAcademicSelection(row);
	}

	async update(
		selection: UserAcademicSelection,
	): Promise<UserAcademicSelection> {
		const [row] = await this.db
			.update(studentAcademicSelections)
			.set({
				academicLevelId: selection.academicLevelId,
				studyFieldId: selection.studyFieldId,
				academicTermId: selection.academicTermId,
				isActive: selection.isActive,
				updatedAt: selection.updatedAt,
			})
			.where(eq(studentAcademicSelections.id, selection.id))
			.returning();
		if (!row) throw new Error('unreachable: update should return a row');
		return toUserAcademicSelection(row);
	}

	async findActiveByUserId(
		userId: string,
	): Promise<UserAcademicSelection | null> {
		const [row] = await this.db
			.select()
			.from(studentAcademicSelections)
			.where(
				and(
					eq(studentAcademicSelections.userId, userId),
					eq(studentAcademicSelections.isActive, true),
				),
			)
			.limit(1);
		if (!row) return null;
		return toUserAcademicSelection(row);
	}

	async findById(id: string): Promise<UserAcademicSelection | null> {
		const [row] = await this.db
			.select()
			.from(studentAcademicSelections)
			.where(eq(studentAcademicSelections.id, id))
			.limit(1);
		if (!row) return null;
		return toUserAcademicSelection(row);
	}

	async deactivateByUserId(userId: string): Promise<void> {
		await this.db
			.update(studentAcademicSelections)
			.set({ isActive: false, updatedAt: new Date() })
			.where(eq(studentAcademicSelections.userId, userId));
	}

	async addSelectedOffering(
		selectionId: string,
		courseOfferingId: string,
	): Promise<void> {
		await this.db.insert(studentSelectedOfferings).values({
			id: crypto.randomUUID(),
			selectionId,
			courseOfferingId,
		});
	}

	async removeSelectedOffering(
		selectionId: string,
		courseOfferingId: string,
	): Promise<void> {
		await this.db
			.delete(studentSelectedOfferings)
			.where(
				and(
					eq(studentSelectedOfferings.selectionId, selectionId),
					eq(studentSelectedOfferings.courseOfferingId, courseOfferingId),
				),
			);
	}

	async listSelectedOfferings(selectionId: string): Promise<string[]> {
		const rows = await this.db
			.select({ courseOfferingId: studentSelectedOfferings.courseOfferingId })
			.from(studentSelectedOfferings)
			.where(eq(studentSelectedOfferings.selectionId, selectionId));
		return rows.map((row) => row.courseOfferingId);
	}

	async replaceSelectedOfferings(
		selectionId: string,
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<void> {
		await this.db
			.delete(studentSelectedOfferings)
			.where(eq(studentSelectedOfferings.selectionId, selectionId));

		if (courseOfferingIds.length > 0) {
			await this.db.insert(studentSelectedOfferings).values(
				courseOfferingIds.map((courseOfferingId) => ({
					id: crypto.randomUUID(),
					selectionId,
					courseOfferingId,
				})),
			);
		}
	}
}
