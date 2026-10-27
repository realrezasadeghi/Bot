import { describe, expect, it } from "vitest";
import {
  ClassOccurrenceStatus,
} from "../../src/domain/academic/class-occurrence.js";
import { MeetingPattern } from "../../src/domain/academic/entities.js";
import {
  ScheduleException,
  ScheduleExceptionType,
} from "../../src/domain/academic/schedule-exception.js";
import { LocalDate } from "../../src/domain/shared/local-date.js";
import { LocalTime } from "../../src/domain/shared/local-time.js";
import { Weekday } from "../../src/domain/shared/weekday.js";
import { generateClassOccurrences } from "../../src/domain/scheduling/occurrence-generator.js";

const from = LocalDate.parse("2026-01-03");
const to = LocalDate.parse("2026-01-17");

function pattern(overrides: Partial<Parameters<typeof MeetingPattern.create>[0]> = {}) {
  return MeetingPattern.create({
    id: "pattern-1",
    courseOfferingId: "offering-1",
    weekday: Weekday.Saturday,
    startTime: LocalTime.parse("08:00"),
    endTime: LocalTime.parse("09:30"),
    location: "Room 1",
    ...overrides,
  });
}

describe("generateClassOccurrences", () => {
  it("expands recurring weekly patterns within the range", () => {
    const plans = generateClassOccurrences({
      patterns: [pattern()],
      exceptions: [],
      from,
      to,
    });

    expect(plans.map((plan) => plan.date.toString())).toEqual([
      "2026-01-03",
      "2026-01-10",
      "2026-01-17",
    ]);
    expect(plans.every((plan) => plan.status === ClassOccurrenceStatus.Scheduled)).toBe(
      true,
    );
  });

  it("marks a cancelled occurrence without removing it", () => {
    const cancellation = ScheduleException.create({
      id: "exception-1",
      courseOfferingId: "offering-1",
      meetingPatternId: "pattern-1",
      date: LocalDate.parse("2026-01-10"),
      type: ScheduleExceptionType.Cancelled,
      reason: "Holiday",
    });

    const plans = generateClassOccurrences({
      patterns: [pattern()],
      exceptions: [cancellation],
      from,
      to,
    });

    expect(plans).toHaveLength(3);
    expect(plans[1]?.status).toBe(ClassOccurrenceStatus.Cancelled);
    expect(plans[1]?.exceptionId).toBe("exception-1");
  });

  it("moves a rescheduled occurrence to its new start time", () => {
    const rescheduled = ScheduleException.create({
      id: "exception-2",
      courseOfferingId: "offering-1",
      meetingPatternId: "pattern-1",
      date: LocalDate.parse("2026-01-10"),
      type: ScheduleExceptionType.Rescheduled,
      newStartTime: LocalTime.parse("10:00"),
      newEndTime: LocalTime.parse("11:30"),
      newLocation: "Room 2",
    });

    const plans = generateClassOccurrences({
      patterns: [pattern()],
      exceptions: [rescheduled],
      from,
      to,
    });

    const moved = plans.find(
      (plan) => plan.date.toString() === "2026-01-10",
    );
    expect(moved?.startTime.toString()).toBe("10:00");
    expect(moved?.endTime.toString()).toBe("11:30");
    expect(moved?.location).toBe("Room 2");
  });

  it("creates a make-up occurrence for a rescheduled date without a pattern", () => {
    const makeUp = ScheduleException.create({
      id: "exception-3",
      courseOfferingId: "offering-1",
      meetingPatternId: null,
      date: LocalDate.parse("2026-01-11"),
      type: ScheduleExceptionType.Rescheduled,
      newStartTime: LocalTime.parse("14:00"),
      newEndTime: LocalTime.parse("15:30"),
    });

    const plans = generateClassOccurrences({
      patterns: [pattern()],
      exceptions: [makeUp],
      from,
      to,
    });

    expect(
      plans.some(
        (plan) =>
          plan.date.toString() === "2026-01-11" &&
          plan.startTime.toString() === "14:00",
      ),
    ).toBe(true);
  });

  it("lets cancellation win over another exception on the same day", () => {
    const cancellation = ScheduleException.create({
      id: "exception-cancel",
      courseOfferingId: "offering-1",
      meetingPatternId: "pattern-1",
      date: LocalDate.parse("2026-01-10"),
      type: ScheduleExceptionType.Cancelled,
    });
    const rescheduled = ScheduleException.create({
      id: "exception-move",
      courseOfferingId: "offering-1",
      meetingPatternId: "pattern-1",
      date: LocalDate.parse("2026-01-10"),
      type: ScheduleExceptionType.Rescheduled,
      newStartTime: LocalTime.parse("10:00"),
      newEndTime: LocalTime.parse("11:30"),
    });

    const plans = generateClassOccurrences({
      patterns: [pattern()],
      exceptions: [rescheduled, cancellation],
      from,
      to,
    });

    const sameDay = plans.filter(
      (plan) => plan.date.toString() === "2026-01-10",
    );
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0]?.status).toBe(ClassOccurrenceStatus.Cancelled);
  });

  it("honors pattern effective date boundaries", () => {
    const plans = generateClassOccurrences({
      patterns: [
        pattern({
          effectiveFrom: LocalDate.parse("2026-01-10"),
          effectiveTo: LocalDate.parse("2026-01-10"),
        }),
      ],
      exceptions: [],
      from,
      to,
    });

    expect(plans.map((plan) => plan.date.toString())).toEqual(["2026-01-10"]);
  });
});
