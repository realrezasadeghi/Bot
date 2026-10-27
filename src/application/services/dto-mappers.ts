import type { ProgramSummaryDto, SubscriptionDto } from "../dto/schedule.js";
import type {
  ProgramOfferingView,
  SubscriptionView,
} from "../dto/read-models.js";

export function toProgramSummaryDto(view: ProgramOfferingView): ProgramSummaryDto {
  return {
    id: view.programOffering.id,
    title: view.programOffering.title,
    levelTitle: view.level.title,
    fieldTitle: view.field.title,
    termTitle: view.term.title,
    termId: view.term.id,
    courseCount: view.courseOfferingIds.length,
  };
}

export function toSubscriptionDto(view: SubscriptionView): SubscriptionDto {
  const { subscription, preference, programOffering } = view;
  return {
    id: subscription.id,
    programOfferingId: subscription.programOfferingId,
    programTitle: programOffering.programOffering.title,
    termTitle: programOffering.term.title,
    mode: subscription.mode,
    status: subscription.status,
    selectedCourseOfferingIds: [...subscription.selectedCourseOfferingIds],
    preferences: {
      dailySummaryEnabled: preference.dailySummaryEnabled,
      dailySummaryTime: preference.dailySummaryTime.toString(),
      classReminderEnabled: preference.classReminderEnabled,
      reminderOffsetMinutes: preference.reminderOffsetMinutes,
      notifyOnEmptyDays: preference.notifyOnEmptyDays,
    },
  };
}
