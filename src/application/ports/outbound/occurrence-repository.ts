import type { ClassOccurrence } from "../../../domain/academic/class-occurrence.js";
import type { LocalDate } from "../../../domain/shared/local-date.js";
import type { ScheduleOccurrenceView } from "../../dto/read-models.js";

export interface OccurrenceUpsertResult {
  created: number;
  updated: number;
  createdOccurrenceIds: string[];
  changedOccurrenceIds: string[];
  affectedOccurrenceIds: string[];
}

export interface ClassOccurrenceRepository {
  upsertMany(occurrences: ReadonlyArray<ClassOccurrence>): Promise<OccurrenceUpsertResult>;
  findById(id: string): Promise<ClassOccurrence | null>;
  listForCourses(
    courseOfferingIds: ReadonlyArray<string>,
    from: LocalDate,
    to: LocalDate,
  ): Promise<ScheduleOccurrenceView[]>;
  listFutureScheduledForCourses(
    courseOfferingIds: ReadonlyArray<string>,
    from: LocalDate,
    to: LocalDate,
  ): Promise<ScheduleOccurrenceView[]>;
  cancelFutureNotInKeys(input: {
    termId: string;
    from: LocalDate;
    keepKeys: ReadonlySet<string>;
    now: Date;
  }): Promise<string[]>;
}
