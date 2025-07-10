import { integer, text, boolean, pgTable, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const todo = pgTable("task", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  creatorId: text("creator_id").notNull(),
  name: text("name").notNull(),
  instruction: text("instruction").notNull(),
  url: text("url").notNull(),
  cron: text("cron").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// Stores generated execution plans for tasks
export const executionPlans = pgTable("execution_plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskSignature: text("task_signature").notNull().unique(), // Hash of instruction + url domain
  instruction: text("instruction").notNull(),
  url: text("url").notNull(),
  plan: jsonb("plan").notNull(), // JSON array of execution steps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
});

// Stores execution results and logs
export const executionResults = pgTable("execution_results", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => todo.id),
  planId: text("plan_id").references(() => executionPlans.id),
  status: text("status").notNull(), // 'success', 'failed', 'timeout', 'error'
  result: jsonb("result"), // Extracted data/results
  logs: jsonb("logs"), // Detailed execution logs
  errorMessage: text("error_message"),
  executionTime: integer("execution_time"), // Duration in milliseconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Cache for plan reuse with TTL
export const planCache = pgTable("plan_cache", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  cacheKey: text("cache_key").notNull().unique(), // Hash for cache lookup
  planId: text("plan_id").references(() => executionPlans.id).notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  lastUsed: timestamp("last_used").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Define relations
export const todoRelations = relations(todo, ({ many }) => ({
  executionResults: many(executionResults),
}));

export const executionPlansRelations = relations(executionPlans, ({ many }) => ({
  executionResults: many(executionResults),
  planCache: many(planCache),
}));

export const executionResultsRelations = relations(executionResults, ({ one }) => ({
  task: one(todo, {
    fields: [executionResults.taskId],
    references: [todo.id],
  }),
  plan: one(executionPlans, {
    fields: [executionResults.planId],
    references: [executionPlans.id],
  }),
}));

export const planCacheRelations = relations(planCache, ({ one }) => ({
  plan: one(executionPlans, {
    fields: [planCache.planId],
    references: [executionPlans.id],
  }),
}));
