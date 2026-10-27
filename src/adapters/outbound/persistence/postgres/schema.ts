import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';

export const platformCodeEnum = pgEnum('platform_code', ['TELEGRAM', 'BALE']);
export const subscriptionModeEnum = pgEnum('subscription_mode', [
	'FOLLOW_PROGRAM',
	'CUSTOMIZED',
]);
export const subscriptionStatusEnum = pgEnum('subscription_status', [
	'ACTIVE',
	'UNSUBSCRIBED',
]);
export const scheduleExceptionTypeEnum = pgEnum('schedule_exception_type', [
	'CANCELLED',
	'RESCHEDULED',
	'TIME_CHANGED',
	'LOCATION_CHANGED',
]);
export const classOccurrenceStatusEnum = pgEnum('class_occurrence_status', [
	'SCHEDULED',
	'CANCELLED',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
	'DAILY_SUMMARY',
	'CLASS_REMINDER',
]);
export const notificationJobStatusEnum = pgEnum('notification_job_status', [
	'PENDING',
	'CLAIMED',
	'SENT',
	'FAILED',
	'CANCELLED',
]);
export const deliveryAttemptStatusEnum = pgEnum('delivery_attempt_status', [
	'DELIVERED',
	'FAILED',
]);
export const syncRunStatusEnum = pgEnum('sync_run_status', [
	'RUNNING',
	'COMPLETED',
	'FAILED',
]);
export const externalEntityTypeEnum = pgEnum('external_entity_type', [
	'ACADEMIC_LEVEL',
	'FIELD_OF_STUDY',
	'ACADEMIC_TERM',
	'ACADEMIC_PROGRAM',
	'PROGRAM_OFFERING',
	'COURSE',
	'INSTRUCTOR',
	'COURSE_OFFERING',
	'MEETING_PATTERN',
	'SCHEDULE_EXCEPTION',
]);

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.defaultNow(),
};

export const academicLevels = pgTable(
	'academic_levels',
	{
		id: uuid('id').primaryKey(),
		code: text('code').notNull(),
		title: text('title').notNull(),
		...timestamps,
	},
	(table) => [uniqueIndex('academic_levels_code_uq').on(table.code)],
);

export const fieldsOfStudy = pgTable(
	'fields_of_study',
	{
		id: uuid('id').primaryKey(),
		levelId: uuid('level_id')
			.notNull()
			.references(() => academicLevels.id, { onDelete: 'restrict' }),
		code: text('code').notNull(),
		title: text('title').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('fields_of_study_level_code_uq').on(table.levelId, table.code),
		index('fields_of_study_level_idx').on(table.levelId),
	],
);

export const academicTerms = pgTable(
	'academic_terms',
	{
		id: uuid('id').primaryKey(),
		externalCode: text('external_code').notNull(),
		title: text('title').notNull(),
		startsOn: date('starts_on', { mode: 'string' }),
		endsOn: date('ends_on', { mode: 'string' }),
		isActive: boolean('is_active').notNull().default(true),
		lastSyncedAt: timestamp('last_synced_at', {
			withTimezone: true,
			mode: 'date',
		})
			.notNull()
			.defaultNow(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('academic_terms_external_code_uq').on(table.externalCode),
		check(
			'academic_terms_date_range_chk',
			sql`${table.startsOn} IS NULL OR ${table.endsOn} IS NULL OR ${table.startsOn} <= ${table.endsOn}`,
		),
	],
);

export const academicPrograms = pgTable(
	'academic_programs',
	{
		id: uuid('id').primaryKey(),
		levelId: uuid('level_id')
			.notNull()
			.references(() => academicLevels.id, { onDelete: 'restrict' }),
		fieldOfStudyId: uuid('field_of_study_id')
			.notNull()
			.references(() => fieldsOfStudy.id, { onDelete: 'restrict' }),
		code: text('code').notNull(),
		title: text('title').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('academic_programs_natural_uq').on(
			table.levelId,
			table.fieldOfStudyId,
			table.code,
		),
		index('academic_programs_level_idx').on(table.levelId),
		index('academic_programs_field_idx').on(table.fieldOfStudyId),
	],
);

export const programOfferings = pgTable(
	'program_offerings',
	{
		id: uuid('id').primaryKey(),
		programId: uuid('program_id')
			.notNull()
			.references(() => academicPrograms.id, { onDelete: 'restrict' }),
		termId: uuid('term_id')
			.notNull()
			.references(() => academicTerms.id, { onDelete: 'restrict' }),
		externalKey: text('external_key').notNull(),
		title: text('title').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('program_offerings_term_external_uq').on(
			table.termId,
			table.externalKey,
		),
		uniqueIndex('program_offerings_program_term_uq').on(
			table.programId,
			table.termId,
		),
		index('program_offerings_term_idx').on(table.termId),
	],
);

export const courses = pgTable(
	'courses',
	{
		id: uuid('id').primaryKey(),
		code: text('code').notNull(),
		title: text('title').notNull(),
		units: integer('units'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('courses_code_uq').on(table.code),
		check(
			'courses_units_chk',
			sql`${table.units} IS NULL OR (${table.units} >= 0 AND ${table.units} <= 30)`,
		),
	],
);

export const instructors = pgTable(
	'instructors',
	{
		id: uuid('id').primaryKey(),
		externalKey: text('external_key').notNull(),
		fullName: text('full_name').notNull(),
		...timestamps,
	},
	(table) => [uniqueIndex('instructors_external_key_uq').on(table.externalKey)],
);

export const courseOfferings = pgTable(
	'course_offerings',
	{
		id: uuid('id').primaryKey(),
		courseId: uuid('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'restrict' }),
		termId: uuid('term_id')
			.notNull()
			.references(() => academicTerms.id, { onDelete: 'restrict' }),
		programOfferingId: uuid('program_offering_id').references(
			() => programOfferings.id,
			{ onDelete: 'set null' },
		),
		sectionCode: text('section_code'),
		location: text('location'),
		externalKey: text('external_key').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		lastSyncedAt: timestamp('last_synced_at', {
			withTimezone: true,
			mode: 'date',
		})
			.notNull()
			.defaultNow(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('course_offerings_term_external_uq').on(
			table.termId,
			table.externalKey,
		),
		index('course_offerings_term_idx').on(table.termId),
		index('course_offerings_course_idx').on(table.courseId),
		index('course_offerings_program_idx').on(table.programOfferingId),
	],
);

export const courseOfferingInstructors = pgTable(
	'course_offering_instructors',
	{
		courseOfferingId: uuid('course_offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'cascade' }),
		instructorId: uuid('instructor_id')
			.notNull()
			.references(() => instructors.id, { onDelete: 'cascade' }),
	},
	(table) => [
		primaryKey({
			name: 'course_offering_instructors_pk',
			columns: [table.courseOfferingId, table.instructorId],
		}),
		index('course_offering_instructors_instructor_idx').on(table.instructorId),
	],
);

export const meetingPatterns = pgTable(
	'meeting_patterns',
	{
		id: uuid('id').primaryKey(),
		courseOfferingId: uuid('course_offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'cascade' }),
		weekday: smallint('weekday').notNull(),
		startMinute: smallint('start_minute').notNull(),
		endMinute: smallint('end_minute').notNull(),
		location: text('location'),
		effectiveFrom: date('effective_from', { mode: 'string' })
			.notNull()
			.default('1970-01-01'),
		effectiveTo: date('effective_to', { mode: 'string' })
			.notNull()
			.default('9999-12-31'),
		isActive: boolean('is_active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		uniqueIndex('meeting_patterns_natural_uq').on(
			table.courseOfferingId,
			table.weekday,
			table.startMinute,
			table.endMinute,
			table.effectiveFrom,
			table.effectiveTo,
		),
		index('meeting_patterns_course_offering_idx').on(table.courseOfferingId),
		check(
			'meeting_patterns_weekday_chk',
			sql`${table.weekday} >= 0 AND ${table.weekday} <= 6`,
		),
		check(
			'meeting_patterns_time_chk',
			sql`${table.startMinute} >= 0 AND ${table.endMinute} <= 1439 AND ${table.startMinute} < ${table.endMinute}`,
		),
		check(
			'meeting_patterns_date_range_chk',
			sql`${table.effectiveFrom} <= ${table.effectiveTo}`,
		),
	],
);

export const scheduleExceptions = pgTable(
	'schedule_exceptions',
	{
		id: uuid('id').primaryKey(),
		naturalKey: text('natural_key').notNull(),
		courseOfferingId: uuid('course_offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'cascade' }),
		meetingPatternId: uuid('meeting_pattern_id').references(
			() => meetingPatterns.id,
			{ onDelete: 'set null' },
		),
		exceptionDate: date('exception_date', { mode: 'string' }).notNull(),
		type: scheduleExceptionTypeEnum('type').notNull(),
		newStartMinute: smallint('new_start_minute'),
		newEndMinute: smallint('new_end_minute'),
		newLocation: text('new_location'),
		reason: text('reason'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('schedule_exceptions_natural_uq').on(table.naturalKey),
		index('schedule_exceptions_course_date_idx').on(
			table.courseOfferingId,
			table.exceptionDate,
		),
		check(
			'schedule_exceptions_times_chk',
			sql`(${table.newStartMinute} IS NULL AND ${table.newEndMinute} IS NULL) OR (${table.newStartMinute} >= 0 AND ${table.newEndMinute} <= 1439 AND ${table.newStartMinute} < ${table.newEndMinute})`,
		),
	],
);

export const classOccurrences = pgTable(
	'class_occurrences',
	{
		id: uuid('id').primaryKey(),
		courseOfferingId: uuid('course_offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'cascade' }),
		meetingPatternId: uuid('meeting_pattern_id').references(
			() => meetingPatterns.id,
			{ onDelete: 'set null' },
		),
		occurrenceDate: date('occurrence_date', { mode: 'string' }).notNull(),
		startMinute: smallint('start_minute').notNull(),
		endMinute: smallint('end_minute').notNull(),
		location: text('location'),
		status: classOccurrenceStatusEnum('status').notNull().default('SCHEDULED'),
		exceptionId: uuid('exception_id').references(() => scheduleExceptions.id, {
			onDelete: 'set null',
		}),
		generatedAt: timestamp('generated_at', {
			withTimezone: true,
			mode: 'date',
		}).notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('class_occurrences_natural_uq').on(
			table.courseOfferingId,
			table.occurrenceDate,
			table.startMinute,
		),
		index('class_occurrences_date_idx').on(table.occurrenceDate),
		index('class_occurrences_course_date_idx').on(
			table.courseOfferingId,
			table.occurrenceDate,
		),
		index('class_occurrences_status_idx').on(table.status),
		check(
			'class_occurrences_time_chk',
			sql`${table.startMinute} >= 0 AND ${table.endMinute} <= 1439 AND ${table.startMinute} < ${table.endMinute}`,
		),
	],
);

export const users = pgTable('users', {
	id: uuid('id').primaryKey(),
	displayName: text('display_name'),
	timeZone: text('time_zone').notNull(),
	locale: text('locale').notNull(),
	...timestamps,
});

export const platformIdentities = pgTable(
	'platform_identities',
	{
		id: uuid('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		platform: platformCodeEnum('platform').notNull(),
		botScope: text('bot_scope').notNull(),
		externalUserId: text('external_user_id').notNull(),
		externalChatId: text('external_chat_id'),
		username: text('username'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('platform_identities_external_uq').on(
			table.platform,
			table.botScope,
			table.externalUserId,
		),
		index('platform_identities_user_idx').on(table.userId),
	],
);

export const userProgramSubscriptions = pgTable(
	'user_program_subscriptions',
	{
		id: uuid('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		programOfferingId: uuid('program_offering_id')
			.notNull()
			.references(() => programOfferings.id, { onDelete: 'restrict' }),
		mode: subscriptionModeEnum('mode').notNull().default('FOLLOW_PROGRAM'),
		status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
		...timestamps,
	},
	(table) => [
		uniqueIndex('user_program_subscriptions_active_uq')
			.on(table.userId)
			.where(sql`${table.status} = 'ACTIVE'`),
		index('user_program_subscriptions_program_idx').on(table.programOfferingId),
		index('user_program_subscriptions_status_idx').on(table.status),
	],
);

export const userCourseSelections = pgTable(
	'user_course_selections',
	{
		id: uuid('id').primaryKey(),
		subscriptionId: uuid('subscription_id')
			.notNull()
			.references(() => userProgramSubscriptions.id, { onDelete: 'cascade' }),
		courseOfferingId: uuid('course_offering_id')
			.notNull()
			.references(() => courseOfferings.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex('user_course_selections_uq').on(
			table.subscriptionId,
			table.courseOfferingId,
		),
		index('user_course_selections_course_idx').on(table.courseOfferingId),
	],
);

export const notificationPreferences = pgTable(
	'notification_preferences',
	{
		id: uuid('id').primaryKey(),
		subscriptionId: uuid('subscription_id')
			.notNull()
			.references(() => userProgramSubscriptions.id, { onDelete: 'cascade' }),
		dailySummaryEnabled: boolean('daily_summary_enabled').notNull().default(true),
		dailySummaryMinute: smallint('daily_summary_minute').notNull().default(480),
		classReminderEnabled: boolean('class_reminder_enabled')
			.notNull()
			.default(true),
		reminderOffsetMinutes: smallint('reminder_offset_minutes')
			.notNull()
			.default(60),
		notifyOnEmptyDays: boolean('notify_on_empty_days').notNull().default(false),
		...timestamps,
	},
	(table) => [
		uniqueIndex('notification_preferences_subscription_uq').on(
			table.subscriptionId,
		),
		check(
			'notification_preferences_summary_time_chk',
			sql`${table.dailySummaryMinute} >= 0 AND ${table.dailySummaryMinute} <= 1439`,
		),
		check(
			'notification_preferences_offset_chk',
			sql`${table.reminderOffsetMinutes} >= 0 AND ${table.reminderOffsetMinutes} <= 720`,
		),
	],
);

export const notificationJobs = pgTable(
	'notification_jobs',
	{
		id: uuid('id').primaryKey(),
		type: notificationTypeEnum('type').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		subscriptionId: uuid('subscription_id')
			.notNull()
			.references(() => userProgramSubscriptions.id, { onDelete: 'cascade' }),
		occurrenceId: uuid('occurrence_id').references(() => classOccurrences.id, {
			onDelete: 'set null',
		}),
		recipientIdentityId: uuid('recipient_identity_id')
			.notNull()
			.references(() => platformIdentities.id, { onDelete: 'cascade' }),
		dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }).notNull(),
		status: notificationJobStatusEnum('status').notNull().default('PENDING'),
		idempotencyKey: text('idempotency_key').notNull(),
		attempts: integer('attempts').notNull().default(0),
		maxAttempts: integer('max_attempts').notNull().default(5),
		nextAttemptAt: timestamp('next_attempt_at', {
			withTimezone: true,
			mode: 'date',
		}).notNull(),
		lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
		lockedBy: text('locked_by'),
		lastError: text('last_error'),
		payload: jsonb('payload')
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		...timestamps,
	},
	(table) => [
		uniqueIndex('notification_jobs_idempotency_uq').on(table.idempotencyKey),
		index('notification_jobs_due_idx').on(table.status, table.nextAttemptAt),
		index('notification_jobs_lock_idx').on(table.status, table.lockedAt),
		index('notification_jobs_subscription_idx').on(table.subscriptionId),
		index('notification_jobs_occurrence_idx').on(table.occurrenceId),
		index('notification_jobs_user_idx').on(table.userId),
		check(
			'notification_jobs_attempts_chk',
			sql`${table.attempts} >= 0 AND ${table.maxAttempts} >= 1`,
		),
	],
);

export const deliveryAttempts = pgTable(
	'delivery_attempts',
	{
		id: uuid('id').primaryKey(),
		jobId: uuid('job_id')
			.notNull()
			.references(() => notificationJobs.id, { onDelete: 'cascade' }),
		attemptNo: integer('attempt_no').notNull(),
		provider: text('provider').notNull(),
		status: deliveryAttemptStatusEnum('status').notNull(),
		providerMessageId: text('provider_message_id'),
		error: text('error'),
		startedAt: timestamp('started_at', {
			withTimezone: true,
			mode: 'date',
		}).notNull(),
		finishedAt: timestamp('finished_at', {
			withTimezone: true,
			mode: 'date',
		}),
	},
	(table) => [
		uniqueIndex('delivery_attempts_job_attempt_uq').on(
			table.jobId,
			table.attemptNo,
		),
		index('delivery_attempts_job_idx').on(table.jobId),
	],
);

export const syncRuns = pgTable(
	'sync_runs',
	{
		id: uuid('id').primaryKey(),
		sourceKey: text('source_key').notNull(),
		status: syncRunStatusEnum('status').notNull().default('RUNNING'),
		startedAt: timestamp('started_at', {
			withTimezone: true,
			mode: 'date',
		}).notNull(),
		finishedAt: timestamp('finished_at', {
			withTimezone: true,
			mode: 'date',
		}),
		stats: jsonb('stats').$type<Record<string, number>>(),
		errorSummary: text('error_summary'),
	},
	(table) => [
		index('sync_runs_source_started_idx').on(table.sourceKey, table.startedAt),
	],
);

export const externalIdentifiers = pgTable(
	'external_identifiers',
	{
		id: uuid('id').primaryKey(),
		entityType: externalEntityTypeEnum('entity_type').notNull(),
		internalId: uuid('internal_id').notNull(),
		sourceKey: text('source_key').notNull(),
		externalId: text('external_id').notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('external_identifiers_lookup_uq').on(
			table.sourceKey,
			table.entityType,
			table.externalId,
		),
		index('external_identifiers_internal_idx').on(
			table.entityType,
			table.internalId,
		),
	],
);

export const conversationStates = pgTable(
	'conversation_states',
	{
		id: uuid('id').primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		platform: platformCodeEnum('platform').notNull(),
		botScope: text('bot_scope').notNull(),
		step: text('step').notNull(),
		data: jsonb('data').$type<Record<string, string>>().notNull().default({}),
		updatedAt: timestamp('updated_at', {
			withTimezone: true,
			mode: 'date',
		}).notNull(),
		expiresAt: timestamp('expires_at', {
			withTimezone: true,
			mode: 'date',
		}).notNull(),
	},
	(table) => [
		uniqueIndex('conversation_states_scope_uq').on(
			table.userId,
			table.platform,
			table.botScope,
		),
		index('conversation_states_expiry_idx').on(table.expiresAt),
	],
);

export type DatabaseSchema = {
	academicLevels: typeof academicLevels;
	fieldsOfStudy: typeof fieldsOfStudy;
	academicTerms: typeof academicTerms;
	academicPrograms: typeof academicPrograms;
	programOfferings: typeof programOfferings;
	courses: typeof courses;
	instructors: typeof instructors;
	courseOfferings: typeof courseOfferings;
	courseOfferingInstructors: typeof courseOfferingInstructors;
	meetingPatterns: typeof meetingPatterns;
	scheduleExceptions: typeof scheduleExceptions;
	classOccurrences: typeof classOccurrences;
	users: typeof users;
	platformIdentities: typeof platformIdentities;
	userProgramSubscriptions: typeof userProgramSubscriptions;
	userCourseSelections: typeof userCourseSelections;
	notificationPreferences: typeof notificationPreferences;
	notificationJobs: typeof notificationJobs;
	deliveryAttempts: typeof deliveryAttempts;
	syncRuns: typeof syncRuns;
	externalIdentifiers: typeof externalIdentifiers;
	conversationStates: typeof conversationStates;
};
