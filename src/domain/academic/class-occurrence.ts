import { ValidationError } from "../shared/errors.js";
import type { LocalDate } from "../shared/local-date.js";
import type { LocalTime } from "../shared/local-time.js";

export enum ClassOccurrenceStatus {
  Scheduled = "SCHEDULED",
  Cancelled = "CANCELLED",
}

export interface ClassOccurrencePlan {
  courseOfferingId: string;
  meetingPatternId: string | null;
  date: LocalDate;
  startTime: LocalTime;
  endTime: LocalTime;
  location: string | null;
  status: ClassOccurrenceStatus;
  exceptionId: string | null;
}

export class ClassOccurrence {
  private constructor(
    readonly id: string,
    readonly courseOfferingId: string,
    readonly meetingPatternId: string | null,
    readonly date: LocalDate,
    readonly startTime: LocalTime,
    readonly endTime: LocalTime,
    readonly location: string | null,
    readonly status: ClassOccurrenceStatus,
    readonly exceptionId: string | null,
    readonly generatedAt: Date,
  ) {}

  static create(input: {
    id: string;
    courseOfferingId: string;
    meetingPatternId?: string | null;
    date: LocalDate;
    startTime: LocalTime;
    endTime: LocalTime;
    location?: string | null;
    status?: ClassOccurrenceStatus;
    exceptionId?: string | null;
    generatedAt: Date;
  }): ClassOccurrence {
    if (!input.id.trim()) throw new ValidationError("ClassOccurrence.id is required");
    if (!input.courseOfferingId.trim()) {
      throw new ValidationError("ClassOccurrence.courseOfferingId is required");
    }
    if (!input.startTime.isBefore(input.endTime)) {
      throw new ValidationError("ClassOccurrence start time must be before end time");
    }

    return new ClassOccurrence(
      input.id.trim(),
      input.courseOfferingId.trim(),
      input.meetingPatternId?.trim() || null,
      input.date,
      input.startTime,
      input.endTime,
      input.location?.trim() || null,
      input.status ?? ClassOccurrenceStatus.Scheduled,
      input.exceptionId?.trim() || null,
      input.generatedAt,
    );
  }

  isActive(): boolean {
    return this.status === ClassOccurrenceStatus.Scheduled;
  }

  hasSameSchedule(other: ClassOccurrence): boolean {
    return (
      this.startTime.equals(other.startTime) &&
      this.endTime.equals(other.endTime) &&
      this.location === other.location &&
      this.status === other.status
    );
  }
}
