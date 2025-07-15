CREATE TABLE "change_detections" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"execution_id" text,
	"changed_fields" jsonb NOT NULL,
	"is_restock" boolean DEFAULT false,
	"change_details" jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_data" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"url" text NOT NULL,
	"extracted_data" jsonb NOT NULL,
	"execution_id" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_detections" ADD CONSTRAINT "change_detections_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_detections" ADD CONSTRAINT "change_detections_execution_id_execution_results_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_data" ADD CONSTRAINT "monitoring_data_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_data" ADD CONSTRAINT "monitoring_data_execution_id_execution_results_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution_results"("id") ON DELETE no action ON UPDATE no action;