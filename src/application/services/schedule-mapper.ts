import { WEEKDAY_LABELS_FA } from "../../domain/shared/weekday.js";
import type { ScheduleEntryDto } from "../dto/schedule.js";
import type { ScheduleOccurrenceView } from "../dto/read-models.js";

export function toScheduleEntryDto(view: ScheduleOccurrenceView): ScheduleEntryDto {
  const { occurrence, course, instructors } = view;
  const instructorName =
    instructors.length > 0
      ? instructors.map((instructor) => instructor.fullName).join("، ")
      : null;
  return {
    occurrenceId: occurrence.id,
    courseOfferingId: occurrence.courseOfferingId,
    date: occurrence.date.toString(),
    weekday: occurrence.date.weekday(),
    weekdayLabel: WEEKDAY_LABELS_FA[occurrence.date.weekday()],
    startTime: occurrence.startTime.toString(),
    endTime: occurrence.endTime.toString(),
    location: occurrence.location,
    courseCode: course.code,
    courseTitle: course.title,
    instructorName,
    status: occurrence.isActive() ? "SCHEDULED" : "CANCELLED",
  };
}
