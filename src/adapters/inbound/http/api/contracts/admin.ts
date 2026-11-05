import { z } from 'zod';
import { SyncRunStatus } from '../../../../../domain/academic/sync-run.js';
import {
	IsoDateTimeSchema,
	LocalDateStringSchema,
	NonEmptyStringSchema,
} from './common.js';

const CountSchema = z.number().int().nonnegative();

export const SyncRunStatusSchema = z
	.enum(SyncRunStatus)
	.meta({ id: 'SyncRunStatus' });

export const SyncRunStatsSchema = z
	.object({
		levels: CountSchema,
		fields: CountSchema,
		terms: CountSchema,
		programs: CountSchema,
		programOfferings: CountSchema,
		courses: CountSchema,
		instructors: CountSchema,
		courseOfferings: CountSchema,
		meetingPatterns: CountSchema,
		scheduleExceptions: CountSchema,
		examinations: CountSchema,
		occurrencesCreated: CountSchema,
		occurrencesUpdated: CountSchema,
		occurrencesCancelled: CountSchema,
		warnings: CountSchema,
	})
	.meta({ id: 'SyncRunStats' });

export const SyncRunSchema = z
	.object({
		id: z.string(),
		sourceKey: z.string(),
		status: SyncRunStatusSchema,
		startedAt: IsoDateTimeSchema,
		finishedAt: IsoDateTimeSchema.nullable(),
		stats: SyncRunStatsSchema.nullable(),
		errorSummary: z.string().nullable(),
	})
	.meta({ id: 'SyncRun' });

export const SynchronizationResultSchema = z
	.object({
		syncRunId: z.string(),
		status: SyncRunStatusSchema,
		stats: SyncRunStatsSchema,
		warnings: z.array(z.string()),
		complete: z.boolean(),
		reconcileAbsent: z.boolean(),
	})
	.meta({ id: 'SynchronizationResult' });

export const GenerateOccurrencesResultSchema = z
	.object({
		created: CountSchema,
		updated: CountSchema,
		cancelled: CountSchema,
		createdOccurrenceIds: z.array(z.string()),
		changedOccurrenceIds: z.array(z.string()),
		cancelledOccurrenceIds: z.array(z.string()),
	})
	.meta({ id: 'GenerateOccurrencesResult' });

export const SyncResponseSchema = z
	.object({
		synchronization: SynchronizationResultSchema,
		termId: z.string().nullable(),
		occurrences: GenerateOccurrencesResultSchema.nullable(),
		warnings: z.array(z.string()),
		complete: z.boolean(),
	})
	.meta({ id: 'SyncResponse' });

export const OccurrencesRequestSchema = z
	.object({
		termId: NonEmptyStringSchema,
		from: LocalDateStringSchema.optional(),
		to: LocalDateStringSchema.optional(),
		reconcileAbsent: z.boolean().optional(),
	})
	.meta({
		id: 'OccurrencesRequest',
		example: {
			termId: 'term-1',
			from: '2026-11-05',
			to: '2026-11-12',
			reconcileAbsent: false,
		},
	});

export const OccurrencesResponseSchema = GenerateOccurrencesResultSchema;

export const ScheduleRemindersResultSchema = z
	.object({
		subscriptionsProcessed: CountSchema,
		selectionsProcessed: CountSchema,
		jobsCreated: CountSchema,
		jobsAlreadyPresent: CountSchema,
		skipped: CountSchema,
	})
	.meta({ id: 'ScheduleRemindersResult' });

export const ScheduleExamRemindersResultSchema = z
	.object({
		enabled: z.boolean(),
		selectionsProcessed: CountSchema,
		jobsCreated: CountSchema,
		jobsAlreadyPresent: CountSchema,
		skipped: CountSchema,
	})
	.meta({ id: 'ScheduleExamRemindersResult' });

export const GenerateDailySummariesResultSchema = z
	.object({
		subscriptionsProcessed: CountSchema,
		jobsCreated: CountSchema,
		jobsAlreadyPresent: CountSchema,
		jobsCancelled: CountSchema,
		skipped: CountSchema,
	})
	.meta({ id: 'GenerateDailySummariesResult' });

export const ScheduleNotificationsRequestSchema = z
	.object({
		userId: NonEmptyStringSchema.optional(),
	})
	.meta({
		id: 'ScheduleNotificationsRequest',
		example: { userId: 'user-1' },
	});

export const ScheduleNotificationsResponseSchema = z
	.object({
		reminders: ScheduleRemindersResultSchema,
		examReminders: ScheduleExamRemindersResultSchema,
		summaries: GenerateDailySummariesResultSchema,
	})
	.meta({ id: 'ScheduleNotificationsResponse' });

export const DispatchResponseSchema = z
	.object({
		claimed: CountSchema,
		sent: CountSchema,
		retried: CountSchema,
		failed: CountSchema,
		cancelled: CountSchema,
		lockLost: CountSchema,
	})
	.meta({ id: 'DispatchResponse' });

export const LatestSyncRunQuerySchema = z
	.object({
		sourceKey: NonEmptyStringSchema.optional(),
	})
	.meta({ id: 'LatestSyncRunQuery' });

export const LatestSyncRunResponseSchema = z
	.object({
		syncRun: SyncRunSchema.nullable(),
	})
	.meta({ id: 'LatestSyncRunResponse' });

export type SyncRunStats = z.infer<typeof SyncRunStatsSchema>;
export type SyncRun = z.infer<typeof SyncRunSchema>;
export type SyncResponse = z.infer<typeof SyncResponseSchema>;
export type OccurrencesRequest = z.infer<typeof OccurrencesRequestSchema>;
export type OccurrencesResponse = z.infer<typeof OccurrencesResponseSchema>;
export type ScheduleNotificationsRequest = z.infer<
	typeof ScheduleNotificationsRequestSchema
>;
export type ScheduleNotificationsResponse = z.infer<
	typeof ScheduleNotificationsResponseSchema
>;
export type DispatchResponse = z.infer<typeof DispatchResponseSchema>;
export type LatestSyncRunQuery = z.infer<typeof LatestSyncRunQuerySchema>;
export type LatestSyncRunResponse = z.infer<typeof LatestSyncRunResponseSchema>;
