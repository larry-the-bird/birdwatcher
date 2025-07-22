import { pgTable, text, boolean, foreignKey, jsonb, integer, timestamp, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const task = pgTable("task", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	instruction: text().notNull(),
	url: text().notNull(),
	cron: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	creatorId: text("creator_id").notNull(),
});

export const executionResults = pgTable("execution_results", {
	id: text().primaryKey().notNull(),
	taskId: text("task_id"),
	planId: text("plan_id"),
	status: text().notNull(),
	result: jsonb(),
	logs: jsonb(),
	errorMessage: text("error_message"),
	executionTime: integer("execution_time"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "execution_results_task_id_task_id_fk"
		}),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [executionPlans.id],
			name: "execution_results_plan_id_execution_plans_id_fk"
		}),
]);

export const executionPlans = pgTable("execution_plans", {
	id: text().primaryKey().notNull(),
	taskSignature: text("task_signature").notNull(),
	instruction: text().notNull(),
	url: text().notNull(),
	plan: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	version: integer().default(1).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("execution_plans_task_signature_unique").on(table.taskSignature),
]);

export const planCache = pgTable("plan_cache", {
	id: text().primaryKey().notNull(),
	cacheKey: text("cache_key").notNull(),
	planId: text("plan_id").notNull(),
	hitCount: integer("hit_count").default(0).notNull(),
	lastUsed: timestamp("last_used", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.planId],
			foreignColumns: [executionPlans.id],
			name: "plan_cache_plan_id_execution_plans_id_fk"
		}),
	unique("plan_cache_cache_key_unique").on(table.cacheKey),
]);
