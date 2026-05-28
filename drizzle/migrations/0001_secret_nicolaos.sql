CREATE TABLE "diagnostic_test" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diagnostic_test_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"time_limit_seconds" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_event" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"test_id" text NOT NULL,
	"validator_result" text NOT NULL,
	"selected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_result" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"outcome" text DEFAULT 'in_progress' NOT NULL,
	"is_failed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_classification" (
	"scenario_id" text NOT NULL,
	"test_id" text NOT NULL,
	"classification" text NOT NULL,
	CONSTRAINT "test_classification_scenario_id_test_id_pk" PRIMARY KEY("scenario_id","test_id")
);
--> statement-breakpoint
ALTER TABLE "session_event" ADD CONSTRAINT "session_event_session_id_session_result_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_event" ADD CONSTRAINT "session_event_test_id_diagnostic_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."diagnostic_test"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_result" ADD CONSTRAINT "session_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_result" ADD CONSTRAINT "session_result_scenario_id_scenario_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_classification" ADD CONSTRAINT "test_classification_scenario_id_scenario_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_classification" ADD CONSTRAINT "test_classification_test_id_diagnostic_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."diagnostic_test"("id") ON DELETE cascade ON UPDATE no action;