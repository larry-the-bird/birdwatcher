CREATE TABLE "execution_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"task_signature" text NOT NULL,
	"instruction" text NOT NULL,
	"url" text NOT NULL,
	"plan" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "execution_plans_task_signature_unique" UNIQUE("task_signature")
);
--> statement-breakpoint
CREATE TABLE "execution_results" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"plan_id" text,
	"status" text NOT NULL,
	"result" jsonb,
	"logs" jsonb,
	"error_message" text,
	"execution_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"cache_key" text NOT NULL,
	"plan_id" text NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_used" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"name" text NOT NULL,
	"instruction" text NOT NULL,
	"url" text NOT NULL,
	"cron" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "execution_results" ADD CONSTRAINT "execution_results_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_results" ADD CONSTRAINT "execution_results_plan_id_execution_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."execution_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_cache" ADD CONSTRAINT "plan_cache_plan_id_execution_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."execution_plans"("id") ON DELETE no action ON UPDATE no action;