CREATE TYPE "public"."class_occurrence_status" AS ENUM('SCHEDULED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."delivery_attempt_status" AS ENUM('DELIVERED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."external_entity_type" AS ENUM('ACADEMIC_LEVEL', 'FIELD_OF_STUDY', 'ACADEMIC_TERM', 'ACADEMIC_PROGRAM', 'PROGRAM_OFFERING', 'COURSE', 'INSTRUCTOR', 'COURSE_OFFERING', 'MEETING_PATTERN', 'SCHEDULE_EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."notification_job_status" AS ENUM('PENDING', 'CLAIMED', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('DAILY_SUMMARY', 'CLASS_REMINDER');--> statement-breakpoint
CREATE TYPE "public"."platform_code" AS ENUM('TELEGRAM', 'BALE');--> statement-breakpoint
CREATE TYPE "public"."schedule_exception_type" AS ENUM('CANCELLED', 'RESCHEDULED', 'TIME_CHANGED', 'LOCATION_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."subscription_mode" AS ENUM('FOLLOW_PROGRAM', 'CUSTOMIZED');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'UNSUBSCRIBED');--> statement-breakpoint
CREATE TYPE "public"."sync_run_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "academic_levels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_programs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"level_id" uuid NOT NULL,
	"field_of_study_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_terms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_code" text NOT NULL,
	"title" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_terms_date_range_chk" CHECK ("academic_terms"."starts_on" IS NULL OR "academic_terms"."ends_on" IS NULL OR "academic_terms"."starts_on" <= "academic_terms"."ends_on")
);
--> statement-breakpoint
CREATE TABLE "class_occurrences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"meeting_pattern_id" uuid,
	"occurrence_date" date NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"location" text,
	"status" "class_occurrence_status" DEFAULT 'SCHEDULED' NOT NULL,
	"exception_id" uuid,
	"generated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_occurrences_time_chk" CHECK ("class_occurrences"."start_minute" >= 0 AND "class_occurrences"."end_minute" <= 1439 AND "class_occurrences"."start_minute" < "class_occurrences"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "conversation_states" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform_code" NOT NULL,
	"bot_scope" text NOT NULL,
	"step" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_offering_instructors" (
	"course_offering_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	CONSTRAINT "course_offering_instructors_pk" PRIMARY KEY("course_offering_id","instructor_id")
);
--> statement-breakpoint
CREATE TABLE "course_offerings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"program_offering_id" uuid,
	"section_code" text,
	"location" text,
	"external_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"units" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_units_chk" CHECK ("courses"."units" IS NULL OR ("courses"."units" >= 0 AND "courses"."units" <= 30))
);
--> statement-breakpoint
CREATE TABLE "delivery_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"provider" text NOT NULL,
	"status" "delivery_attempt_status" NOT NULL,
	"provider_message_id" text,
	"error" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "external_identifiers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" "external_entity_type" NOT NULL,
	"internal_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields_of_study" (
	"id" uuid PRIMARY KEY NOT NULL,
	"level_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"external_key" text NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_patterns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"location" text,
	"effective_from" date DEFAULT '1970-01-01' NOT NULL,
	"effective_to" date DEFAULT '9999-12-31' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_patterns_weekday_chk" CHECK ("meeting_patterns"."weekday" >= 0 AND "meeting_patterns"."weekday" <= 6),
	CONSTRAINT "meeting_patterns_time_chk" CHECK ("meeting_patterns"."start_minute" >= 0 AND "meeting_patterns"."end_minute" <= 1439 AND "meeting_patterns"."start_minute" < "meeting_patterns"."end_minute"),
	CONSTRAINT "meeting_patterns_date_range_chk" CHECK ("meeting_patterns"."effective_from" <= "meeting_patterns"."effective_to")
);
--> statement-breakpoint
CREATE TABLE "notification_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" "notification_type" NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"recipient_identity_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "notification_job_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_jobs_attempts_chk" CHECK ("notification_jobs"."attempts" >= 0 AND "notification_jobs"."max_attempts" >= 1)
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subscription_id" uuid NOT NULL,
	"daily_summary_enabled" boolean DEFAULT true NOT NULL,
	"daily_summary_minute" smallint DEFAULT 480 NOT NULL,
	"class_reminder_enabled" boolean DEFAULT true NOT NULL,
	"reminder_offset_minutes" smallint DEFAULT 60 NOT NULL,
	"notify_on_empty_days" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_summary_time_chk" CHECK ("notification_preferences"."daily_summary_minute" >= 0 AND "notification_preferences"."daily_summary_minute" <= 1439),
	CONSTRAINT "notification_preferences_offset_chk" CHECK ("notification_preferences"."reminder_offset_minutes" >= 0 AND "notification_preferences"."reminder_offset_minutes" <= 720)
);
--> statement-breakpoint
CREATE TABLE "platform_identities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform_code" NOT NULL,
	"bot_scope" text NOT NULL,
	"external_user_id" text NOT NULL,
	"external_chat_id" text,
	"username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_offerings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"external_key" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"natural_key" text NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"meeting_pattern_id" uuid,
	"exception_date" date NOT NULL,
	"type" "schedule_exception_type" NOT NULL,
	"new_start_minute" smallint,
	"new_end_minute" smallint,
	"new_location" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_exceptions_times_chk" CHECK (("schedule_exceptions"."new_start_minute" IS NULL AND "schedule_exceptions"."new_end_minute" IS NULL) OR ("schedule_exceptions"."new_start_minute" >= 0 AND "schedule_exceptions"."new_end_minute" <= 1439 AND "schedule_exceptions"."new_start_minute" < "schedule_exceptions"."new_end_minute"))
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"status" "sync_run_status" DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "user_course_selections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subscription_id" uuid NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_program_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"program_offering_id" uuid NOT NULL,
	"mode" "subscription_mode" DEFAULT 'FOLLOW_PROGRAM' NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"time_zone" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_programs" ADD CONSTRAINT "academic_programs_level_id_academic_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."academic_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_programs" ADD CONSTRAINT "academic_programs_field_of_study_id_fields_of_study_id_fk" FOREIGN KEY ("field_of_study_id") REFERENCES "public"."fields_of_study"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_meeting_pattern_id_meeting_patterns_id_fk" FOREIGN KEY ("meeting_pattern_id") REFERENCES "public"."meeting_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_exception_id_schedule_exceptions_id_fk" FOREIGN KEY ("exception_id") REFERENCES "public"."schedule_exceptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offering_instructors" ADD CONSTRAINT "course_offering_instructors_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offering_instructors" ADD CONSTRAINT "course_offering_instructors_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_program_offering_id_program_offerings_id_fk" FOREIGN KEY ("program_offering_id") REFERENCES "public"."program_offerings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_job_id_notification_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."notification_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields_of_study" ADD CONSTRAINT "fields_of_study_level_id_academic_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."academic_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_patterns" ADD CONSTRAINT "meeting_patterns_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_subscription_id_user_program_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_program_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_occurrence_id_class_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "public"."class_occurrences"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_recipient_identity_id_platform_identities_id_fk" FOREIGN KEY ("recipient_identity_id") REFERENCES "public"."platform_identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_subscription_id_user_program_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_program_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_identities" ADD CONSTRAINT "platform_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_program_id_academic_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."academic_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_offerings" ADD CONSTRAINT "program_offerings_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."academic_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_meeting_pattern_id_meeting_patterns_id_fk" FOREIGN KEY ("meeting_pattern_id") REFERENCES "public"."meeting_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_selections" ADD CONSTRAINT "user_course_selections_subscription_id_user_program_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."user_program_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_selections" ADD CONSTRAINT "user_course_selections_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_subscriptions" ADD CONSTRAINT "user_program_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_program_subscriptions" ADD CONSTRAINT "user_program_subscriptions_program_offering_id_program_offerings_id_fk" FOREIGN KEY ("program_offering_id") REFERENCES "public"."program_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academic_levels_code_uq" ON "academic_levels" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_programs_natural_uq" ON "academic_programs" USING btree ("level_id","field_of_study_id","code");--> statement-breakpoint
CREATE INDEX "academic_programs_level_idx" ON "academic_programs" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "academic_programs_field_idx" ON "academic_programs" USING btree ("field_of_study_id");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_terms_external_code_uq" ON "academic_terms" USING btree ("external_code");--> statement-breakpoint
CREATE UNIQUE INDEX "class_occurrences_natural_uq" ON "class_occurrences" USING btree ("course_offering_id","occurrence_date","start_minute");--> statement-breakpoint
CREATE INDEX "class_occurrences_date_idx" ON "class_occurrences" USING btree ("occurrence_date");--> statement-breakpoint
CREATE INDEX "class_occurrences_course_date_idx" ON "class_occurrences" USING btree ("course_offering_id","occurrence_date");--> statement-breakpoint
CREATE INDEX "class_occurrences_status_idx" ON "class_occurrences" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_states_scope_uq" ON "conversation_states" USING btree ("user_id","platform","bot_scope");--> statement-breakpoint
CREATE INDEX "conversation_states_expiry_idx" ON "conversation_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "course_offering_instructors_instructor_idx" ON "course_offering_instructors" USING btree ("instructor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_offerings_term_external_uq" ON "course_offerings" USING btree ("term_id","external_key");--> statement-breakpoint
CREATE INDEX "course_offerings_term_idx" ON "course_offerings" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "course_offerings_course_idx" ON "course_offerings" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_offerings_program_idx" ON "course_offerings" USING btree ("program_offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_code_uq" ON "courses" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_job_attempt_uq" ON "delivery_attempts" USING btree ("job_id","attempt_no");--> statement-breakpoint
CREATE INDEX "delivery_attempts_job_idx" ON "delivery_attempts" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_identifiers_lookup_uq" ON "external_identifiers" USING btree ("source_key","entity_type","external_id");--> statement-breakpoint
CREATE INDEX "external_identifiers_internal_idx" ON "external_identifiers" USING btree ("entity_type","internal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fields_of_study_level_code_uq" ON "fields_of_study" USING btree ("level_id","code");--> statement-breakpoint
CREATE INDEX "fields_of_study_level_idx" ON "fields_of_study" USING btree ("level_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instructors_external_key_uq" ON "instructors" USING btree ("external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_patterns_natural_uq" ON "meeting_patterns" USING btree ("course_offering_id","weekday","start_minute","end_minute","effective_from","effective_to");--> statement-breakpoint
CREATE INDEX "meeting_patterns_course_offering_idx" ON "meeting_patterns" USING btree ("course_offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_jobs_idempotency_uq" ON "notification_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_jobs_due_idx" ON "notification_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_jobs_lock_idx" ON "notification_jobs" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "notification_jobs_subscription_idx" ON "notification_jobs" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "notification_jobs_occurrence_idx" ON "notification_jobs" USING btree ("occurrence_id");--> statement-breakpoint
CREATE INDEX "notification_jobs_user_idx" ON "notification_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_subscription_uq" ON "notification_preferences" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_identities_external_uq" ON "platform_identities" USING btree ("platform","bot_scope","external_user_id");--> statement-breakpoint
CREATE INDEX "platform_identities_user_idx" ON "platform_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_offerings_term_external_uq" ON "program_offerings" USING btree ("term_id","external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "program_offerings_program_term_uq" ON "program_offerings" USING btree ("program_id","term_id");--> statement-breakpoint
CREATE INDEX "program_offerings_term_idx" ON "program_offerings" USING btree ("term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_exceptions_natural_uq" ON "schedule_exceptions" USING btree ("natural_key");--> statement-breakpoint
CREATE INDEX "schedule_exceptions_course_date_idx" ON "schedule_exceptions" USING btree ("course_offering_id","exception_date");--> statement-breakpoint
CREATE INDEX "sync_runs_source_started_idx" ON "sync_runs" USING btree ("source_key","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_course_selections_uq" ON "user_course_selections" USING btree ("subscription_id","course_offering_id");--> statement-breakpoint
CREATE INDEX "user_course_selections_course_idx" ON "user_course_selections" USING btree ("course_offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_program_subscriptions_active_uq" ON "user_program_subscriptions" USING btree ("user_id") WHERE "user_program_subscriptions"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "user_program_subscriptions_program_idx" ON "user_program_subscriptions" USING btree ("program_offering_id");--> statement-breakpoint
CREATE INDEX "user_program_subscriptions_status_idx" ON "user_program_subscriptions" USING btree ("status");