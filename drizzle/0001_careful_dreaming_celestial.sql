ALTER TYPE "public"."external_entity_type" ADD VALUE 'STUDY_FIELD';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'EXAM_REMINDER';--> statement-breakpoint
CREATE TABLE "student_academic_selections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"academic_level_id" uuid,
	"study_field_id" uuid,
	"academic_term_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_selected_offerings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"selection_id" uuid NOT NULL,
	"course_offering_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_field_offering_mappings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"study_field_id" uuid NOT NULL,
	"course_offering_external_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"academic_level_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD CONSTRAINT "student_academic_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD CONSTRAINT "student_academic_selections_academic_level_id_academic_levels_id_fk" FOREIGN KEY ("academic_level_id") REFERENCES "public"."academic_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD CONSTRAINT "student_academic_selections_study_field_id_study_fields_id_fk" FOREIGN KEY ("study_field_id") REFERENCES "public"."study_fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_academic_selections" ADD CONSTRAINT "student_academic_selections_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "public"."academic_terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_selected_offerings" ADD CONSTRAINT "student_selected_offerings_selection_id_student_academic_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."student_academic_selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_selected_offerings" ADD CONSTRAINT "student_selected_offerings_course_offering_id_course_offerings_id_fk" FOREIGN KEY ("course_offering_id") REFERENCES "public"."course_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_field_offering_mappings" ADD CONSTRAINT "study_field_offering_mappings_study_field_id_study_fields_id_fk" FOREIGN KEY ("study_field_id") REFERENCES "public"."study_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_fields" ADD CONSTRAINT "study_fields_academic_level_id_academic_levels_id_fk" FOREIGN KEY ("academic_level_id") REFERENCES "public"."academic_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_academic_selections_active_uq" ON "student_academic_selections" USING btree ("user_id") WHERE "student_academic_selections"."is_active" = true;--> statement-breakpoint
CREATE INDEX "student_academic_selections_user_idx" ON "student_academic_selections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_selected_offerings_uq" ON "student_selected_offerings" USING btree ("selection_id","course_offering_id");--> statement-breakpoint
CREATE INDEX "student_selected_offerings_selection_idx" ON "student_selected_offerings" USING btree ("selection_id");--> statement-breakpoint
CREATE INDEX "student_selected_offerings_offering_idx" ON "student_selected_offerings" USING btree ("course_offering_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_field_offering_mappings_uq" ON "study_field_offering_mappings" USING btree ("study_field_id","course_offering_external_key");--> statement-breakpoint
CREATE INDEX "study_field_offering_mappings_field_idx" ON "study_field_offering_mappings" USING btree ("study_field_id");--> statement-breakpoint
CREATE INDEX "study_field_offering_mappings_offering_idx" ON "study_field_offering_mappings" USING btree ("course_offering_external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "study_fields_code_uq" ON "study_fields" USING btree ("code");--> statement-breakpoint
CREATE INDEX "study_fields_level_idx" ON "study_fields" USING btree ("academic_level_id");--> statement-breakpoint
CREATE INDEX "study_fields_active_idx" ON "study_fields" USING btree ("is_active");