import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { ScheduleOccurrenceView } from '../../../../application/dto/read-models.js';
import type {
	ClassOccurrenceRepository,
	OccurrenceUpsertResult,
} from '../../../../application/ports/outbound/occurrence-repository.js';
import type { ClassOccurrence } from '../../../../domain/academic/class-occurrence.js';
import { ClassOccurrenceStatus } from '../../../../domain/academic/class-occurrence.js';
import type { LocalDate } from '../../../../domain/shared/local-date.js';
import type { AppDatabase } from './db.js';
import {
	toClassOccurrence,
	toCourse,
	toCourseOffering,
	toInstructor,
} from './mappers.js';
import {
	classOccurrences,
	courseOfferingInstructors,
	courseOfferings,
	courses,
	instructors,
} from './schema.js';

export class PostgresClassOccurrenceRepository
	implements ClassOccurrenceRepository
{
	constructor(private readonly db: AppDatabase) {}

	async upsertMany(
		occurrences: ReadonlyArray<ClassOccurrence>,
	): Promise<OccurrenceUpsertResult> {
		if (occurrences.length === 0) {
			return {
				created: 0,
				updated: 0,
				createdOccurrenceIds: [],
				changedOccurrenceIds: [],
				affectedOccurrenceIds: [],
			};
		}

		const byNaturalKey = new Map<string, ClassOccurrence>();
		for (const occurrence of occurrences) {
			byNaturalKey.set(
				[
					occurrence.courseOfferingId,
					occurrence.date.toString(),
					occurrence.startTime.minutes.toString(),
				].join('|'),
				occurrence,
			);
		}
		const uniqueOccurrences = [...byNaturalKey.values()];

		const rows = await this.db
			.insert(classOccurrences)
			.values(
				uniqueOccurrences.map((occurrence) => ({
					id: occurrence.id,
					courseOfferingId: occurrence.courseOfferingId,
					meetingPatternId: occurrence.meetingPatternId,
					occurrenceDate: occurrence.date.toString(),
					startMinute: occurrence.startTime.minutes,
					endMinute: occurrence.endTime.minutes,
					location: occurrence.location,
					status: occurrence.status,
					exceptionId: occurrence.exceptionId,
					generatedAt: occurrence.generatedAt,
				})),
			)
			.onConflictDoUpdate({
				target: [
					classOccurrences.courseOfferingId,
					classOccurrences.occurrenceDate,
					classOccurrences.startMinute,
				],
				set: {
					meetingPatternId: sql`excluded.meeting_pattern_id`,
					endMinute: sql`excluded.end_minute`,
					location: sql`excluded.location`,
					status: sql`excluded.status`,
					exceptionId: sql`excluded.exception_id`,
					generatedAt: sql`excluded.generated_at`,
					updatedAt: sql`now()`,
				},
				setWhere: sql`
          ${classOccurrences.meetingPatternId} IS DISTINCT FROM excluded.meeting_pattern_id
          OR ${classOccurrences.endMinute} IS DISTINCT FROM excluded.end_minute
          OR ${classOccurrences.location} IS DISTINCT FROM excluded.location
          OR ${classOccurrences.status} IS DISTINCT FROM excluded.status
          OR ${classOccurrences.exceptionId} IS DISTINCT FROM excluded.exception_id
        `,
			})
			.returning({
				id: classOccurrences.id,
				inserted: sql<boolean>`xmax = 0`,
			});

		const createdOccurrenceIds = rows
			.filter((row) => row.inserted)
			.map((row) => row.id);
		const changedOccurrenceIds = rows
			.filter((row) => !row.inserted)
			.map((row) => row.id);

		return {
			created: createdOccurrenceIds.length,
			updated: changedOccurrenceIds.length,
			createdOccurrenceIds,
			changedOccurrenceIds,
			affectedOccurrenceIds: rows.map((row) => row.id),
		};
	}

	async findById(id: string): Promise<ClassOccurrence | null> {
		const [row] = await this.db
			.select()
			.from(classOccurrences)
			.where(eq(classOccurrences.id, id))
			.limit(1);
		return row ? toClassOccurrence(row) : null;
	}

	async listForCourses(
		courseOfferingIds: ReadonlyArray<string>,
		from: LocalDate,
		to: LocalDate,
	): Promise<ScheduleOccurrenceView[]> {
		return this.loadViews(courseOfferingIds, from, to, false);
	}

	async listFutureScheduledForCourses(
		courseOfferingIds: ReadonlyArray<string>,
		from: LocalDate,
		to: LocalDate,
	): Promise<ScheduleOccurrenceView[]> {
		return this.loadViews(courseOfferingIds, from, to, true);
	}

	private async loadViews(
		courseOfferingIds: ReadonlyArray<string>,
		from: LocalDate,
		to: LocalDate,
		onlyScheduled: boolean,
	): Promise<ScheduleOccurrenceView[]> {
		if (courseOfferingIds.length === 0) return [];

		const conditions = [
			inArray(classOccurrences.courseOfferingId, [...courseOfferingIds]),
			gte(classOccurrences.occurrenceDate, from.toString()),
			lte(classOccurrences.occurrenceDate, to.toString()),
		];
		if (onlyScheduled) {
			conditions.push(
				eq(classOccurrences.status, ClassOccurrenceStatus.Scheduled),
			);
		}

		const rows = await this.db
			.select({
				occurrence: classOccurrences,
				offering: courseOfferings,
				course: courses,
			})
			.from(classOccurrences)
			.innerJoin(
				courseOfferings,
				eq(classOccurrences.courseOfferingId, courseOfferings.id),
			)
			.innerJoin(courses, eq(courseOfferings.courseId, courses.id))
			.where(and(...conditions))
			.orderBy(
				asc(classOccurrences.occurrenceDate),
				asc(classOccurrences.startMinute),
				asc(courses.code),
			);

		if (rows.length === 0) return [];

		const uniqueOfferingIds = [...new Set(rows.map((row) => row.offering.id))];
		const instructorRows = await this.db
			.select({
				courseOfferingId: courseOfferingInstructors.courseOfferingId,
				instructor: instructors,
			})
			.from(courseOfferingInstructors)
			.innerJoin(
				instructors,
				eq(courseOfferingInstructors.instructorId, instructors.id),
			)
			.where(
				inArray(courseOfferingInstructors.courseOfferingId, uniqueOfferingIds),
			);

		const instructorsByOffering = new Map<
			string,
			ReturnType<typeof toInstructor>[]
		>();
		for (const row of instructorRows) {
			const list = instructorsByOffering.get(row.courseOfferingId) ?? [];
			list.push(toInstructor(row.instructor));
			instructorsByOffering.set(row.courseOfferingId, list);
		}

		return rows.map((row) => {
			const offeringInstructors = instructorsByOffering.get(row.offering.id) ?? [];
			return {
				occurrence: toClassOccurrence(row.occurrence),
				courseOffering: toCourseOffering(
					row.offering,
					offeringInstructors.map((instructor) => instructor.id),
				),
				course: toCourse(row.course),
				instructors: offeringInstructors,
			};
		});
	}

	async cancelFutureNotInKeys(input: {
		termId: string;
		from: LocalDate;
		keepKeys: ReadonlySet<string>;
		now: Date;
	}): Promise<string[]> {
		const rows = await this.db
			.select({
				id: classOccurrences.id,
				courseOfferingId: classOccurrences.courseOfferingId,
				occurrenceDate: classOccurrences.occurrenceDate,
				startMinute: classOccurrences.startMinute,
			})
			.from(classOccurrences)
			.innerJoin(
				courseOfferings,
				eq(classOccurrences.courseOfferingId, courseOfferings.id),
			)
			.where(
				and(
					eq(courseOfferings.termId, input.termId),
					gte(classOccurrences.occurrenceDate, input.from.toString()),
					eq(classOccurrences.status, ClassOccurrenceStatus.Scheduled),
				),
			);

		const toCancel = rows
			.filter(
				(row) =>
					!input.keepKeys.has(
						[
							row.courseOfferingId,
							row.occurrenceDate,
							row.startMinute.toString(),
						].join('|'),
					),
			)
			.map((row) => row.id);

		if (toCancel.length === 0) return [];

		const updated = await this.db
			.update(classOccurrences)
			.set({ status: ClassOccurrenceStatus.Cancelled, updatedAt: input.now })
			.where(inArray(classOccurrences.id, toCancel))
			.returning({ id: classOccurrences.id });

		return updated.map((row) => row.id);
	}
}
