import {
  ClassOccurrenceStatus,
  type ClassOccurrencePlan,
} from "../academic/class-occurrence.js";
import type { MeetingPattern } from "../academic/entities.js";
import type {
  ScheduleException} from "../academic/schedule-exception.js";
import {
  ScheduleExceptionType,
} from "../academic/schedule-exception.js";
import { ValidationError } from "../shared/errors.js";
import type {
  LocalDate} from "../shared/local-date.js";
import {
  eachDateInclusive,
  maxLocalDate,
  minLocalDate,
} from "../shared/local-date.js";
import type { LocalTime } from "../shared/local-time.js";

export interface GenerateOccurrencesInput {
  patterns: ReadonlyArray<MeetingPattern>;
  exceptions: ReadonlyArray<ScheduleException>;
  from: LocalDate;
  to: LocalDate;
}

function occurrenceKey(plan: ClassOccurrencePlan): string {
  return [
    plan.courseOfferingId,
    plan.date.toString(),
    plan.startTime.minutes.toString(),
  ].join("|");
}

function applyException(
  plan: ClassOccurrencePlan,
  exception: ScheduleException,
): ClassOccurrencePlan {
  switch (exception.type) {
    case ScheduleExceptionType.Cancelled:
      return {
        ...plan,
        status: ClassOccurrenceStatus.Cancelled,
        exceptionId: exception.id,
      };
    case ScheduleExceptionType.Rescheduled:
    case ScheduleExceptionType.TimeChanged:
      return {
        ...plan,
        startTime: exception.newStartTime ?? plan.startTime,
        endTime: exception.newEndTime ?? plan.endTime,
        location: exception.newLocation ?? plan.location,
        exceptionId: exception.id,
      };
    case ScheduleExceptionType.LocationChanged:
      return {
        ...plan,
        location: exception.newLocation ?? plan.location,
        exceptionId: exception.id,
      };
  }
}

/**
 * Pure scheduling rule: recurring meeting patterns + dated exceptions produce
 * concrete class occurrences. Cancellation wins over any other exception.
 */
export function generateClassOccurrences(
  input: GenerateOccurrencesInput,
): ClassOccurrencePlan[] {
  if (input.from.isAfter(input.to)) {
    throw new ValidationError("Occurrence generation range start must not be after end");
  }

  const plans = new Map<string, ClassOccurrencePlan>();
  const exceptionsByOfferingAndDate = new Map<string, ScheduleException[]>();

  for (const exception of input.exceptions) {
    const key = `${exception.courseOfferingId}|${exception.date.toString()}`;
    const existing = exceptionsByOfferingAndDate.get(key) ?? [];
    existing.push(exception);
    exceptionsByOfferingAndDate.set(key, existing);
  }

  for (const pattern of input.patterns) {
    if (!pattern.isActive) continue;

    const rangeStart = pattern.effectiveFrom
      ? maxLocalDate(input.from, pattern.effectiveFrom)
      : input.from;
    const rangeEnd = pattern.effectiveTo
      ? minLocalDate(input.to, pattern.effectiveTo)
      : input.to;

    for (const date of eachDateInclusive(rangeStart, rangeEnd)) {
      if (!pattern.appliesOn(date)) continue;

      let plan: ClassOccurrencePlan = {
        courseOfferingId: pattern.courseOfferingId,
        meetingPatternId: pattern.id,
        date,
        startTime: pattern.startTime,
        endTime: pattern.endTime,
        location: pattern.location,
        status: ClassOccurrenceStatus.Scheduled,
        exceptionId: null,
      };

      const applicable =
        exceptionsByOfferingAndDate.get(
          `${pattern.courseOfferingId}|${date.toString()}`,
        ) ?? [];

      for (const exception of applicable) {
        if (exception.appliesTo(pattern.courseOfferingId, pattern.id, date)) {
          plan = applyException(plan, exception);
        }
      }

      if (!plan.startTime.isBefore(plan.endTime)) {
        throw new ValidationError(
          `Exception produced an invalid time range for ${pattern.courseOfferingId} on ${date.toString()}`,
        );
      }

      const key = occurrenceKey(plan);
      const existing = plans.get(key);
      if (existing) {
        const existingCancelled =
          existing.status === ClassOccurrenceStatus.Cancelled;
        const nextCancelled = plan.status === ClassOccurrenceStatus.Cancelled;
        if (existingCancelled || !nextCancelled) {
          continue;
        }
      }
      plans.set(key, plan);
    }
  }

  // A rescheduled exception can introduce an extra occurrence on a date that
  // has no recurring pattern (for example, a make-up class).
  for (const exception of input.exceptions) {
    if (exception.type === ScheduleExceptionType.Cancelled) continue;
    if (!exception.newStartTime || !exception.newEndTime) continue;
    if (!exception.date.isBetweenInclusive(input.from, input.to)) continue;

    const plan: ClassOccurrencePlan = {
      courseOfferingId: exception.courseOfferingId,
      meetingPatternId: exception.meetingPatternId,
      date: exception.date,
      startTime: exception.newStartTime,
      endTime: exception.newEndTime,
      location: exception.newLocation,
      status: ClassOccurrenceStatus.Scheduled,
      exceptionId: exception.id,
    };

    const key = occurrenceKey(plan);
    if (!plans.has(key)) {
      plans.set(key, plan);
    }
  }

  return [...plans.values()].sort((left, right) => {
    const dateComparison = left.date.compare(right.date);
    if (dateComparison !== 0) return dateComparison;
    const timeComparison = left.startTime.minutes - right.startTime.minutes;
    if (timeComparison !== 0) return timeComparison;
    return left.courseOfferingId.localeCompare(right.courseOfferingId);
  });
}

export function isOccurrenceReminderEligible(input: {
  occurrenceStatus: ClassOccurrenceStatus;
  startTime: LocalTime;
  occurrenceDate: LocalDate;
  now: Date;
  timeZone: string;
  offsetMinutes: number;
}): boolean {
  if (input.occurrenceStatus !== ClassOccurrenceStatus.Scheduled) return false;
  const startInstant = input.occurrenceDate.toUtcInstant(input.startTime, input.timeZone);
  const reminderInstant = new Date(startInstant.getTime() - input.offsetMinutes * 60_000);
  return reminderInstant.getTime() > input.now.getTime();
}
