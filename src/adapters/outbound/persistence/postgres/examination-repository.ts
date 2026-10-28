import { and, asc, eq, gte, inArray, lte, notInArray, sql } from 'drizzle-orm';
import type { ExaminationRepository } from '../../../../application/ports/outbound/examination-repository.js';
import {
	CourseExamination,
	ExaminationStatus,
} from '../../../../domain/academic/examination.js';
import type { LocalDate } from '../../../../domain/shared/local-date.js';
import type { AppDatabase } from './db.js';
import { toCourseExamination } from './mappers.js';
import { courseExaminations } from './schema.js';

export class PostgresExaminationRepository implements ExaminationRepository {
	constructor(private readonly db: AppDatabase) {}

	async upsertMany(
		examinations: ReadonlyArray<CourseExamination>,
	): Promise<CourseExamination[]> {
		if (examinations.length === 0) return [];

		const rows = await this.db
			.insert(courseExaminations)
			.values(
				examinations.map((examination) => ({
					id: examination.id,
					courseOfferingId: examination.courseOfferingId,
					examDate: examination.examDate.toString(),
					startMinute: examination.startTime?.minutes ?? null,
					endMinute: examination.endTime?.minutes ?? null,
					location: examination.location,
					sourceIdentifier: examination.sourceIdentifier,
					status: examination.status,
				})),
			)
			.onConflictDoUpdate({
				target: [
					courseExaminations.courseOfferingId,
					courseExaminations.examDate,
					courseExaminations.sourceIdentifier,
				],
				set: {
					startMinute: sql`excluded.start_minute`,
					endMinute: sql`excluded.end_minute`,
					location: sql`excluded.location`,
					status: sql`excluded.status`,
					updatedAt: new Date(),
				},
			})
			.returning();

		return rows.map(toCourseExamination);
	}

	async listByCourseOfferingIds(
		courseOfferingIds: ReadonlyArray<string>,
	): Promise<CourseExamination[]> {
		if (courseOfferingIds.length === 0) return [];
		const rows = await this.db
			.select()
			.from(courseExaminations)
			.where(inArray(courseExaminations.courseOfferingId, [...courseOfferingIds]))
			.orderBy(asc(courseExaminations.examDate), asc(courseExaminations.startMinute));
		return rows.map(toCourseExamination);
	}

	async listUpcomingForCourseOfferingIds(
		courseOfferingIds: ReadonlyArray<string>,
		from: LocalDate,
		to: LocalDate,
	): Promise<CourseExamination[]> {
		if (courseOfferingIds.length === 0) return [];
		const rows = await this.db
			.select()
			.from(courseExaminations)
			.where(
				and(
					inArray(courseExaminations.courseOfferingId, [...courseOfferingIds]),
					gte(courseExaminations.examDate, from.toString()),
					lte(courseExaminations.examDate, to.toString()),
				),
			)
			.orderBy(asc(courseExaminations.examDate), asc(courseExaminations.startMinute));
		return rows.map(toCourseExamination);
	}

	async deactivateByCourseOfferingIdsNotIn(
		courseOfferingIds: ReadonlyArray<string>,
		keepSourceIdentifiers: ReadonlyArray<string>,
	): Promise<number> {
		if (courseOfferingIds.length === 0) return 0;
		const conditions = [
			inArray(courseExaminations.courseOfferingId, [...courseOfferingIds]),
			eq(courseExaminations.status, ExaminationStatus.Scheduled),
		];
		if (keepSourceIdentifiers.length > 0) {
			conditions.push(
				notInArray(courseExaminations.sourceIdentifier, [
					...keepSourceIdentifiers,
				]),
			);
		}
		const rows = await this.db
			.update(courseExaminations)
			.set({ status: ExaminationStatus.CANCELLED, updatedAt: new Date() })
			.where(and(...conditions))
			.returning({ id: courseExaminations.id });
		return rows.length;
	}
}
