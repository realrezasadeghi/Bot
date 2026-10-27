import type { ClassOccurrenceStatus } from "../../../../domain/academic/class-occurrence.js";
import { ClassOccurrence } from "../../../../domain/academic/class-occurrence.js";
import {
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
import type {
  ScheduleExceptionType} from "../../../../domain/academic/schedule-exception.js";
import {
  ScheduleException
} from "../../../../domain/academic/schedule-exception.js";
import type { SyncRunStatus} from "../../../../domain/academic/sync-run.js";
import { type SyncRun } from "../../../../domain/academic/sync-run.js";
import type { PlatformCode} from "../../../../domain/identity/platform-identity.js";
import { PlatformIdentity } from "../../../../domain/identity/platform-identity.js";
import { User } from "../../../../domain/identity/user.js";
import type {
  DeliveryAttemptStatus} from "../../../../domain/notifications/delivery-attempt.js";
import {
  type DeliveryAttempt,
} from "../../../../domain/notifications/delivery-attempt.js";
import type {
  NotificationJobStatus,
  NotificationType} from "../../../../domain/notifications/notification-job.js";
import {
  NotificationJob
} from "../../../../domain/notifications/notification-job.js";
import { NotificationPreference } from "../../../../domain/subscriptions/notification-preference.js";
import type {
  SubscriptionMode,
  SubscriptionStatus} from "../../../../domain/subscriptions/subscription.js";
import {
  UserProgramSubscription,
} from "../../../../domain/subscriptions/subscription.js";
import { LocalDate } from "../../../../domain/shared/local-date.js";
import { LocalTime } from "../../../../domain/shared/local-time.js";
import type { Weekday } from "../../../../domain/shared/weekday.js";
import type {
  academicLevels,
  academicPrograms,
  academicTerms,
  classOccurrences,
  courseOfferings,
  courses,
  deliveryAttempts,
  fieldsOfStudy,
  instructors,
  meetingPatterns,
  notificationJobs,
  notificationPreferences,
  platformIdentities,
  programOfferings,
  scheduleExceptions,
  syncRuns,
  userProgramSubscriptions,
  users,
} from "./schema.js";

type Row<T extends { $inferSelect: unknown }> = T["$inferSelect"];

export function toUser(row: Row<typeof users>): User {
  return User.create({
    id: row.id,
    displayName: row.displayName,
    timeZone: row.timeZone,
    locale: row.locale,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPlatformIdentity(
  row: Row<typeof platformIdentities>,
): PlatformIdentity {
  return PlatformIdentity.create({
    id: row.id,
    userId: row.userId,
    platform: row.platform as PlatformCode,
    botScope: row.botScope,
    externalUserId: row.externalUserId,
    externalChatId: row.externalChatId,
    username: row.username,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toAcademicLevel(row: Row<typeof academicLevels>): AcademicLevel {
  return AcademicLevel.create({ id: row.id, code: row.code, title: row.title });
}

export function toFieldOfStudy(row: Row<typeof fieldsOfStudy>): FieldOfStudy {
  return FieldOfStudy.create({
    id: row.id,
    levelId: row.levelId,
    code: row.code,
    title: row.title,
  });
}

export function toAcademicTerm(row: Row<typeof academicTerms>): AcademicTerm {
  return AcademicTerm.create({
    id: row.id,
    externalCode: row.externalCode,
    title: row.title,
    startsOn: row.startsOn ? LocalDate.parse(row.startsOn) : null,
    endsOn: row.endsOn ? LocalDate.parse(row.endsOn) : null,
    isActive: row.isActive,
  });
}

export function toAcademicProgram(row: Row<typeof academicPrograms>): AcademicProgram {
  return AcademicProgram.create({
    id: row.id,
    levelId: row.levelId,
    fieldOfStudyId: row.fieldOfStudyId,
    code: row.code,
    title: row.title,
  });
}

export function toProgramOffering(row: Row<typeof programOfferings>): ProgramOffering {
  return ProgramOffering.create({
    id: row.id,
    programId: row.programId,
    termId: row.termId,
    externalKey: row.externalKey,
    title: row.title,
  });
}

export function toCourse(row: Row<typeof courses>): Course {
  return Course.create({
    id: row.id,
    code: row.code,
    title: row.title,
    units: row.units,
  });
}

export function toInstructor(row: Row<typeof instructors>): Instructor {
  return Instructor.create({
    id: row.id,
    externalKey: row.externalKey,
    fullName: row.fullName,
  });
}

export function toCourseOffering(
  row: Row<typeof courseOfferings>,
  instructorIds: ReadonlyArray<string> = [],
): CourseOffering {
  return CourseOffering.create({
    id: row.id,
    courseId: row.courseId,
    termId: row.termId,
    programOfferingId: row.programOfferingId,
    sectionCode: row.sectionCode,
    instructorIds,
    location: row.location,
    externalKey: row.externalKey,
    isActive: row.isActive,
  });
}

export function toMeetingPattern(row: Row<typeof meetingPatterns>): MeetingPattern {
  return MeetingPattern.create({
    id: row.id,
    courseOfferingId: row.courseOfferingId,
    weekday: row.weekday as Weekday,
    startTime: LocalTime.fromMinutes(row.startMinute),
    endTime: LocalTime.fromMinutes(row.endMinute),
    location: row.location,
    effectiveFrom:
      row.effectiveFrom === "1970-01-01" ? null : LocalDate.parse(row.effectiveFrom),
    effectiveTo:
      row.effectiveTo === "9999-12-31" ? null : LocalDate.parse(row.effectiveTo),
    isActive: row.isActive,
  });
}

export function toScheduleException(
  row: Row<typeof scheduleExceptions>,
): ScheduleException {
  return ScheduleException.create({
    id: row.id,
    courseOfferingId: row.courseOfferingId,
    meetingPatternId: row.meetingPatternId,
    date: LocalDate.parse(row.exceptionDate),
    type: row.type as ScheduleExceptionType,
    newStartTime:
      row.newStartMinute === null ? null : LocalTime.fromMinutes(row.newStartMinute),
    newEndTime:
      row.newEndMinute === null ? null : LocalTime.fromMinutes(row.newEndMinute),
    newLocation: row.newLocation,
    reason: row.reason,
  });
}

export function toClassOccurrence(row: Row<typeof classOccurrences>): ClassOccurrence {
  return ClassOccurrence.create({
    id: row.id,
    courseOfferingId: row.courseOfferingId,
    meetingPatternId: row.meetingPatternId,
    date: LocalDate.parse(row.occurrenceDate),
    startTime: LocalTime.fromMinutes(row.startMinute),
    endTime: LocalTime.fromMinutes(row.endMinute),
    location: row.location,
    status: row.status as ClassOccurrenceStatus,
    exceptionId: row.exceptionId,
    generatedAt: row.generatedAt,
  });
}

export function toSubscription(
  row: Row<typeof userProgramSubscriptions>,
  selectedCourseOfferingIds: ReadonlyArray<string>,
): UserProgramSubscription {
  return UserProgramSubscription.create({
    id: row.id,
    userId: row.userId,
    programOfferingId: row.programOfferingId,
    mode: row.mode as SubscriptionMode,
    status: row.status as SubscriptionStatus,
    selectedCourseOfferingIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toNotificationPreference(
  row: Row<typeof notificationPreferences>,
): NotificationPreference {
  return NotificationPreference.create({
    id: row.id,
    subscriptionId: row.subscriptionId,
    dailySummaryEnabled: row.dailySummaryEnabled,
    dailySummaryTime: LocalTime.fromMinutes(row.dailySummaryMinute),
    classReminderEnabled: row.classReminderEnabled,
    reminderOffsetMinutes: row.reminderOffsetMinutes,
    notifyOnEmptyDays: row.notifyOnEmptyDays,
    updatedAt: row.updatedAt,
  });
}

export function toNotificationJob(row: Row<typeof notificationJobs>): NotificationJob {
  return NotificationJob.rehydrate({
    id: row.id,
    type: row.type as NotificationType,
    userId: row.userId,
    subscriptionId: row.subscriptionId,
    occurrenceId: row.occurrenceId,
    recipientIdentityId: row.recipientIdentityId,
    dueAt: row.dueAt,
    status: row.status as NotificationJobStatus,
    idempotencyKey: row.idempotencyKey,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    lastError: row.lastError,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toDeliveryAttempt(row: Row<typeof deliveryAttempts>): DeliveryAttempt {
  return {
    id: row.id,
    jobId: row.jobId,
    attemptNo: row.attemptNo,
    provider: row.provider,
    status: row.status as DeliveryAttemptStatus,
    providerMessageId: row.providerMessageId,
    error: row.error,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export function toSyncRun(row: Row<typeof syncRuns>): SyncRun {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    status: row.status as SyncRunStatus,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    stats: row.stats as SyncRun["stats"],
    errorSummary: row.errorSummary,
  };
}
