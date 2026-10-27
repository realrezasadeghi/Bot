import {
  and,
  asc,
  desc,
  eq,
  inArray,
  notInArray,
  type SQL,
} from "drizzle-orm";
import type {
  AcademicLevel,
  AcademicProgram,
  AcademicTerm,
  Course,
  CourseOffering,
  FieldOfStudy,
  Instructor,
  MeetingPattern,
  ProgramOffering,
} from "../../../../domain/academic/entities.js";
import type { ScheduleException } from "../../../../domain/academic/schedule-exception.js";
import type {
  AcademicCatalogRepository,
  ProgramOfferingFilter,
} from "../../../../application/ports/outbound/academic-catalog-repository.js";
import type {
  CourseOfferingView,
  ProgramOfferingView,
} from "../../../../application/dto/read-models.js";
import type { AppDatabase } from "./db.js";
import {
  academicLevels,
  academicPrograms,
  academicTerms,
  courseOfferingInstructors,
  courseOfferings,
  courses,
  fieldsOfStudy,
  instructors,
  meetingPatterns,
  programOfferings,
  scheduleExceptions,
} from "./schema.js";
import {
  toAcademicLevel,
  toAcademicProgram,
  toAcademicTerm,
  toCourse,
  toCourseOffering,
  toFieldOfStudy,
  toInstructor,
  toMeetingPattern,
  toProgramOffering,
  toScheduleException,
} from "./mappers.js";

export class PostgresAcademicCatalogRepository implements AcademicCatalogRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsertLevel(level: AcademicLevel): Promise<AcademicLevel> {
    const [row] = await this.db
      .insert(academicLevels)
      .values({ id: level.id, code: level.code, title: level.title })
      .onConflictDoUpdate({
        target: academicLevels.code,
        set: { title: level.title, updatedAt: new Date() },
      })
      .returning();
    return toAcademicLevel(row!);
  }

  async upsertFieldOfStudy(field: FieldOfStudy): Promise<FieldOfStudy> {
    const [row] = await this.db
      .insert(fieldsOfStudy)
      .values({
        id: field.id,
        levelId: field.levelId,
        code: field.code,
        title: field.title,
      })
      .onConflictDoUpdate({
        target: [fieldsOfStudy.levelId, fieldsOfStudy.code],
        set: { title: field.title, updatedAt: new Date() },
      })
      .returning();
    return toFieldOfStudy(row!);
  }

  async upsertTerm(term: AcademicTerm): Promise<AcademicTerm> {
    const [existing] = await this.db
      .select()
      .from(academicTerms)
      .where(eq(academicTerms.externalCode, term.externalCode))
      .limit(1);

    const startsOn = term.startsOn?.toString() ?? existing?.startsOn ?? null;
    const endsOn = term.endsOn?.toString() ?? existing?.endsOn ?? null;
    const now = new Date();

    const [row] = await this.db
      .insert(academicTerms)
      .values({
        id: term.id,
        externalCode: term.externalCode,
        title: term.title,
        startsOn,
        endsOn,
        isActive: term.isActive,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: academicTerms.externalCode,
        set: {
          title: term.title,
          startsOn,
          endsOn,
          isActive: term.isActive,
          lastSyncedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    return toAcademicTerm(row!);
  }

  async upsertProgram(program: AcademicProgram): Promise<AcademicProgram> {
    const [row] = await this.db
      .insert(academicPrograms)
      .values({
        id: program.id,
        levelId: program.levelId,
        fieldOfStudyId: program.fieldOfStudyId,
        code: program.code,
        title: program.title,
      })
      .onConflictDoUpdate({
        target: [
          academicPrograms.levelId,
          academicPrograms.fieldOfStudyId,
          academicPrograms.code,
        ],
        set: { title: program.title, updatedAt: new Date() },
      })
      .returning();
    return toAcademicProgram(row!);
  }

  async upsertProgramOffering(offering: ProgramOffering): Promise<ProgramOffering> {
    const [row] = await this.db
      .insert(programOfferings)
      .values({
        id: offering.id,
        programId: offering.programId,
        termId: offering.termId,
        externalKey: offering.externalKey,
        title: offering.title,
      })
      .onConflictDoUpdate({
        target: [programOfferings.termId, programOfferings.externalKey],
        set: {
          programId: offering.programId,
          title: offering.title,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toProgramOffering(row!);
  }

  async upsertCourse(course: Course): Promise<Course> {
    const [existing] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.code, course.code))
      .limit(1);

    const [row] = await this.db
      .insert(courses)
      .values({
        id: course.id,
        code: course.code,
        title: course.title,
        units: course.units ?? existing?.units ?? null,
      })
      .onConflictDoUpdate({
        target: courses.code,
        set: {
          title: course.title,
          units: course.units ?? existing?.units ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toCourse(row!);
  }

  async upsertInstructor(instructor: Instructor): Promise<Instructor> {
    const [row] = await this.db
      .insert(instructors)
      .values({
        id: instructor.id,
        externalKey: instructor.externalKey,
        fullName: instructor.fullName,
      })
      .onConflictDoUpdate({
        target: instructors.externalKey,
        set: { fullName: instructor.fullName, updatedAt: new Date() },
      })
      .returning();
    return toInstructor(row!);
  }

  async upsertCourseOffering(offering: CourseOffering): Promise<CourseOffering> {
    const [existing] = await this.db
      .select()
      .from(courseOfferings)
      .where(
        and(
          eq(courseOfferings.termId, offering.termId),
          eq(courseOfferings.externalKey, offering.externalKey),
        ),
      )
      .limit(1);

    const now = new Date();
    const [row] = await this.db
      .insert(courseOfferings)
      .values({
        id: offering.id,
        courseId: offering.courseId,
        termId: offering.termId,
        programOfferingId:
          offering.programOfferingId ?? existing?.programOfferingId ?? null,
        sectionCode: offering.sectionCode ?? existing?.sectionCode ?? null,
        location: offering.location ?? existing?.location ?? null,
        externalKey: offering.externalKey,
        isActive: offering.isActive,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [courseOfferings.termId, courseOfferings.externalKey],
        set: {
          courseId: offering.courseId,
          programOfferingId:
            offering.programOfferingId ?? existing?.programOfferingId ?? null,
          sectionCode: offering.sectionCode ?? existing?.sectionCode ?? null,
          location: offering.location ?? existing?.location ?? null,
          isActive: offering.isActive,
          lastSyncedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    const saved = row!;
    if (offering.instructorIds.length === 0) {
      await this.db
        .delete(courseOfferingInstructors)
        .where(eq(courseOfferingInstructors.courseOfferingId, saved.id));
    } else {
      await this.db
        .delete(courseOfferingInstructors)
        .where(
          and(
            eq(courseOfferingInstructors.courseOfferingId, saved.id),
            notInArray(
              courseOfferingInstructors.instructorId,
              [...offering.instructorIds],
            ),
          ),
        );
      await this.db
        .insert(courseOfferingInstructors)
        .values(
          offering.instructorIds.map((instructorId) => ({
            courseOfferingId: saved.id,
            instructorId,
          })),
        )
        .onConflictDoNothing();
    }

    return toCourseOffering(saved, offering.instructorIds);
  }

  async upsertMeetingPattern(pattern: MeetingPattern): Promise<MeetingPattern> {
    const effectiveFrom = pattern.effectiveFrom?.toString() ?? "1970-01-01";
    const effectiveTo = pattern.effectiveTo?.toString() ?? "9999-12-31";

    const [existing] = await this.db
      .select()
      .from(meetingPatterns)
      .where(
        and(
          eq(meetingPatterns.courseOfferingId, pattern.courseOfferingId),
          eq(meetingPatterns.weekday, pattern.weekday),
          eq(meetingPatterns.startMinute, pattern.startTime.minutes),
          eq(meetingPatterns.endMinute, pattern.endTime.minutes),
          eq(meetingPatterns.effectiveFrom, effectiveFrom),
          eq(meetingPatterns.effectiveTo, effectiveTo),
        ),
      )
      .limit(1);

    const now = new Date();
    const [row] = await this.db
      .insert(meetingPatterns)
      .values({
        id: pattern.id,
        courseOfferingId: pattern.courseOfferingId,
        weekday: pattern.weekday,
        startMinute: pattern.startTime.minutes,
        endMinute: pattern.endTime.minutes,
        location: pattern.location ?? existing?.location ?? null,
        effectiveFrom,
        effectiveTo,
        isActive: pattern.isActive,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          meetingPatterns.courseOfferingId,
          meetingPatterns.weekday,
          meetingPatterns.startMinute,
          meetingPatterns.endMinute,
          meetingPatterns.effectiveFrom,
          meetingPatterns.effectiveTo,
        ],
        set: {
          location: pattern.location ?? existing?.location ?? null,
          isActive: pattern.isActive,
          updatedAt: now,
        },
      })
      .returning();
    return toMeetingPattern(row!);
  }

  async upsertScheduleException(
    exception: ScheduleException,
  ): Promise<ScheduleException> {
    const naturalKey = [exception.courseOfferingId, exception.date.toString()].join(
      "|",
    );

    const [row] = await this.db
      .insert(scheduleExceptions)
      .values({
        id: exception.id,
        naturalKey,
        courseOfferingId: exception.courseOfferingId,
        meetingPatternId: exception.meetingPatternId,
        exceptionDate: exception.date.toString(),
        type: exception.type,
        newStartMinute: exception.newStartTime?.minutes ?? null,
        newEndMinute: exception.newEndTime?.minutes ?? null,
        newLocation: exception.newLocation,
        reason: exception.reason,
      })
      .onConflictDoUpdate({
        target: scheduleExceptions.naturalKey,
        set: {
          meetingPatternId: exception.meetingPatternId,
          newStartMinute: exception.newStartTime?.minutes ?? null,
          newEndMinute: exception.newEndTime?.minutes ?? null,
          newLocation: exception.newLocation,
          reason: exception.reason,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toScheduleException(row!);
  }

  async deactivateMeetingPatternsNotIn(
    courseOfferingId: string,
    keepPatternIds: ReadonlyArray<string>,
  ): Promise<string[]> {
    const conditions: SQL[] = [
      eq(meetingPatterns.courseOfferingId, courseOfferingId),
      eq(meetingPatterns.isActive, true),
    ];
    if (keepPatternIds.length > 0) {
      conditions.push(notInArray(meetingPatterns.id, [...keepPatternIds]));
    }

    const rows = await this.db
      .update(meetingPatterns)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: meetingPatterns.id });
    return rows.map((row) => row.id);
  }

  async deactivateCourseOfferingsNotIn(
    termId: string,
    keepCourseOfferingIds: ReadonlyArray<string>,
  ): Promise<string[]> {
    const conditions: SQL[] = [
      eq(courseOfferings.termId, termId),
      eq(courseOfferings.isActive, true),
    ];
    if (keepCourseOfferingIds.length > 0) {
      conditions.push(
        notInArray(courseOfferings.id, [...keepCourseOfferingIds]),
      );
    }

    const rows = await this.db
      .update(courseOfferings)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: courseOfferings.id });

    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      await this.db
        .update(meetingPatterns)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(meetingPatterns.courseOfferingId, ids));
    }
    return ids;
  }

  async deleteScheduleExceptionsNotIn(
    termId: string,
    keepNaturalKeys: ReadonlyArray<string>,
  ): Promise<number> {
    const offeringRows = await this.db
      .select({ id: courseOfferings.id })
      .from(courseOfferings)
      .where(eq(courseOfferings.termId, termId));
    if (offeringRows.length === 0) return 0;

    const conditions: SQL[] = [
      inArray(
        scheduleExceptions.courseOfferingId,
        offeringRows.map((row) => row.id),
      ),
    ];
    if (keepNaturalKeys.length > 0) {
      conditions.push(
        notInArray(scheduleExceptions.naturalKey, [...keepNaturalKeys]),
      );
    }

    const rows = await this.db
      .delete(scheduleExceptions)
      .where(and(...conditions))
      .returning({ id: scheduleExceptions.id });
    return rows.length;
  }

  async listLevels(): Promise<AcademicLevel[]> {
    const rows = await this.db
      .select()
      .from(academicLevels)
      .orderBy(asc(academicLevels.title));
    return rows.map(toAcademicLevel);
  }

  async listFieldsOfStudy(levelId?: string): Promise<FieldOfStudy[]> {
    const rows = await this.db
      .select()
      .from(fieldsOfStudy)
      .where(levelId ? eq(fieldsOfStudy.levelId, levelId) : undefined)
      .orderBy(asc(fieldsOfStudy.title));
    return rows.map(toFieldOfStudy);
  }

  async listTerms(): Promise<AcademicTerm[]> {
    const rows = await this.db
      .select()
      .from(academicTerms)
      .orderBy(desc(academicTerms.isActive), desc(academicTerms.externalCode));
    return rows.map(toAcademicTerm);
  }

  async getTermById(id: string): Promise<AcademicTerm | null> {
    const [row] = await this.db
      .select()
      .from(academicTerms)
      .where(eq(academicTerms.id, id))
      .limit(1);
    return row ? toAcademicTerm(row) : null;
  }

  async getTermByExternalCode(externalCode: string): Promise<AcademicTerm | null> {
    const [row] = await this.db
      .select()
      .from(academicTerms)
      .where(eq(academicTerms.externalCode, externalCode))
      .limit(1);
    return row ? toAcademicTerm(row) : null;
  }

  async listProgramOfferings(
    filter: ProgramOfferingFilter = {},
  ): Promise<ProgramOfferingView[]> {
    const conditions: SQL[] = [];
    if (filter.termId) conditions.push(eq(programOfferings.termId, filter.termId));
    if (filter.levelId) conditions.push(eq(academicLevels.id, filter.levelId));
    if (filter.fieldOfStudyId) {
      conditions.push(eq(fieldsOfStudy.id, filter.fieldOfStudyId));
    }

    const rows = await this.db
      .select({
        offering: programOfferings,
        program: academicPrograms,
        level: academicLevels,
        field: fieldsOfStudy,
        term: academicTerms,
      })
      .from(programOfferings)
      .innerJoin(academicPrograms, eq(programOfferings.programId, academicPrograms.id))
      .innerJoin(academicLevels, eq(academicPrograms.levelId, academicLevels.id))
      .innerJoin(
        fieldsOfStudy,
        eq(academicPrograms.fieldOfStudyId, fieldsOfStudy.id),
      )
      .innerJoin(academicTerms, eq(programOfferings.termId, academicTerms.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(academicTerms.externalCode), asc(programOfferings.title));

    if (rows.length === 0) return [];

    const offeringIds = rows.map((row) => row.offering.id);
    const courseRows = await this.db
      .select({
        programOfferingId: courseOfferings.programOfferingId,
        id: courseOfferings.id,
      })
      .from(courseOfferings)
      .where(
        and(
          inArray(courseOfferings.programOfferingId, offeringIds),
          eq(courseOfferings.isActive, true),
        ),
      );

    const coursesByOffering = new Map<string, string[]>();
    for (const courseRow of courseRows) {
      if (!courseRow.programOfferingId) continue;
      const list = coursesByOffering.get(courseRow.programOfferingId) ?? [];
      list.push(courseRow.id);
      coursesByOffering.set(courseRow.programOfferingId, list);
    }

    return rows
      .map((row) => ({
        programOffering: toProgramOffering(row.offering),
        program: toAcademicProgram(row.program),
        level: toAcademicLevel(row.level),
        field: toFieldOfStudy(row.field),
        term: toAcademicTerm(row.term),
        courseOfferingIds: coursesByOffering.get(row.offering.id) ?? [],
      }))
      .filter((view) => view.courseOfferingIds.length > 0);
  }

  async getProgramOffering(id: string): Promise<ProgramOfferingView | null> {
    const [row] = await this.db
      .select({
        offering: programOfferings,
        program: academicPrograms,
        level: academicLevels,
        field: fieldsOfStudy,
        term: academicTerms,
      })
      .from(programOfferings)
      .innerJoin(academicPrograms, eq(programOfferings.programId, academicPrograms.id))
      .innerJoin(academicLevels, eq(academicPrograms.levelId, academicLevels.id))
      .innerJoin(
        fieldsOfStudy,
        eq(academicPrograms.fieldOfStudyId, fieldsOfStudy.id),
      )
      .innerJoin(academicTerms, eq(programOfferings.termId, academicTerms.id))
      .where(eq(programOfferings.id, id))
      .limit(1);

    if (!row) return null;

    const courseRows = await this.db
      .select({ id: courseOfferings.id })
      .from(courseOfferings)
      .where(
        and(
          eq(courseOfferings.programOfferingId, id),
          eq(courseOfferings.isActive, true),
        ),
      );

    return {
      programOffering: toProgramOffering(row.offering),
      program: toAcademicProgram(row.program),
      level: toAcademicLevel(row.level),
      field: toFieldOfStudy(row.field),
      term: toAcademicTerm(row.term),
      courseOfferingIds: courseRows.map((courseRow) => courseRow.id),
    };
  }

  async listProgramCourseOfferingIds(
    programOfferingId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ id: courseOfferings.id })
      .from(courseOfferings)
      .where(
        and(
          eq(courseOfferings.programOfferingId, programOfferingId),
          eq(courseOfferings.isActive, true),
        ),
      );
    return rows.map((row) => row.id);
  }

  async listCourseOfferingsByTerm(termId: string): Promise<CourseOfferingView[]> {
    return this.loadCourseOfferings(
      and(
        eq(courseOfferings.termId, termId),
        eq(courseOfferings.isActive, true),
      ),
    );
  }

  async getCourseOffering(id: string): Promise<CourseOfferingView | null> {
    const views = await this.loadCourseOfferings(eq(courseOfferings.id, id));
    return views[0] ?? null;
  }

  private async loadCourseOfferings(
    condition: SQL | undefined,
  ): Promise<CourseOfferingView[]> {
    const rows = await this.db
      .select({ offering: courseOfferings, course: courses })
      .from(courseOfferings)
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .where(condition)
      .orderBy(asc(courses.code), asc(courseOfferings.sectionCode));

    if (rows.length === 0) return [];

    const offeringIds = rows.map((row) => row.offering.id);
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
      .where(inArray(courseOfferingInstructors.courseOfferingId, offeringIds));

    const patternRows = await this.db
      .select()
      .from(meetingPatterns)
      .where(inArray(meetingPatterns.courseOfferingId, offeringIds))
      .orderBy(asc(meetingPatterns.weekday), asc(meetingPatterns.startMinute));

    const instructorsByOffering = new Map<string, Instructor[]>();
    for (const row of instructorRows) {
      const list = instructorsByOffering.get(row.courseOfferingId) ?? [];
      list.push(toInstructor(row.instructor));
      instructorsByOffering.set(row.courseOfferingId, list);
    }

    const patternsByOffering = new Map<string, MeetingPattern[]>();
    for (const row of patternRows) {
      const list = patternsByOffering.get(row.courseOfferingId) ?? [];
      list.push(toMeetingPattern(row));
      patternsByOffering.set(row.courseOfferingId, list);
    }

    return rows.map((row) => {
      const offeringInstructors = instructorsByOffering.get(row.offering.id) ?? [];
      return {
        courseOffering: toCourseOffering(
          row.offering,
          offeringInstructors.map((instructor) => instructor.id),
        ),
        course: toCourse(row.course),
        instructors: offeringInstructors,
        patterns: patternsByOffering.get(row.offering.id) ?? [],
      };
    });
  }

  async listMeetingPatternsByCourseOfferingIds(
    courseOfferingIds: ReadonlyArray<string>,
  ): Promise<MeetingPattern[]> {
    if (courseOfferingIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(meetingPatterns)
      .where(inArray(meetingPatterns.courseOfferingId, [...courseOfferingIds]))
      .orderBy(asc(meetingPatterns.weekday), asc(meetingPatterns.startMinute));
    return rows.map(toMeetingPattern);
  }

  async listScheduleExceptionsByCourseOfferingIds(
    courseOfferingIds: ReadonlyArray<string>,
  ): Promise<ScheduleException[]> {
    if (courseOfferingIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(scheduleExceptions)
      .where(
        inArray(scheduleExceptions.courseOfferingId, [...courseOfferingIds]),
      )
      .orderBy(asc(scheduleExceptions.exceptionDate));
    return rows.map(toScheduleException);
  }

  async listCourseOfferingIdsByTerm(termId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: courseOfferings.id })
      .from(courseOfferings)
      .where(
        and(
          eq(courseOfferings.termId, termId),
          eq(courseOfferings.isActive, true),
        ),
      );
    return rows.map((row) => row.id);
  }
}
