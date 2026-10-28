CREATE TYPE "public"."examination_status" AS ENUM('SCHEDULED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "course_examinations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"exam_date" date NOT NULL,
	"start_minute" smallint,
	"end_minute" smallint,
	"location" text,
	"source_identifier" text,
	"status" "examination_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_examinations_time_chk" CHECK (("course_examinations"."start_minute" IS NULL AND "course_examinations"."end_minute" IS NULL) OR ("course_examinations"."start_minute" IS NOT NULL AND "course_examinations"."end_minute" IS NOT NULL AND "course_examinations"."start_minute" >= 0 AND "course_examinations"."end_minute" <= 1439 AND "course_examinations"."start_minute" < "course_examinations"."end_minute"))
);
--> statement-breakpoint
ALTER TABLE "notification_jobs" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD COLUMN "selection_id" uuid;--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD COLUMN "class_reminder_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD COLUMN "reminder_offset_minutes" smallint DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "course_examinations" ADD CONSTRAINT "course_examinations_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_examinations_natural_uq" ON "course_examinations" USING btree ("course_offering_id","exam_date","source_identifier");--> statement-breakpoint
CREATE INDEX "course_examinations_offering_idx" ON "course_examinations" USING btree ("course_offering_id");--> statement-breakpoint
CREATE INDEX "course_examinations_date_idx" ON "course_examinations" USING btree ("exam_date");--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_selection_id_student_academic_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."student_academic_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_jobs_selection_idx" ON "notification_jobs" USING btree ("selection_id");--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_owner_chk" CHECK (("notification_jobs"."subscription_id" IS NULL) <> ("notification_jobs"."selection_id" IS NULL));--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD CONSTRAINT "student_academic_selections_reminder_offset_chk" CHECK ("student_academic_selections"."reminder_offset_minutes" >= 0 AND "student_academic_selections"."reminder_offset_minutes" <= 720);