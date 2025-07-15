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

// Monitoring data storage for change detection
export const monitoringData = pgTable("monitoring_data", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => todo.id).notNull(),
  url: text("url").notNull(),
  extractedData: jsonb("extracted_data").notNull(), // The data extracted from the page
  executionId: text("execution_id").references(() => executionResults.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Change detection results
export const changeDetections = pgTable("change_detections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => todo.id).notNull(),
  executionId: text("execution_id").references(() => executionResults.id),
  changedFields: jsonb("changed_fields").notNull(), // Array of field names that changed
  isRestock: boolean("is_restock").default(false), // Specific flag for restock detection
  changeDetails: jsonb("change_details"), // Detailed change information
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
});

// Define relations
export const todoRelations = relations(todo, ({ many }) => ({
  executionResults: many(executionResults),
  monitoringData: many(monitoringData),
  changeDetections: many(changeDetections),
}));

export const executionPlansRelations = relations(executionPlans, ({ many }) => ({
  executionResults: many(executionResults),
  planCache: many(planCache),
}));

export const executionResultsRelations = relations(executionResults, ({ one, many }) => ({
  task: one(todo, {
    fields: [executionResults.taskId],
    references: [todo.id],
  }),
  plan: one(executionPlans, {
    fields: [executionResults.planId],
    references: [executionPlans.id],
  }),
  monitoringData: many(monitoringData),
  changeDetections: many(changeDetections),
}));

export const planCacheRelations = relations(planCache, ({ one }) => ({
  plan: one(executionPlans, {
    fields: [planCache.planId],
    references: [executionPlans.id],
  }),
}));

export const monitoringDataRelations = relations(monitoringData, ({ one }) => ({
  task: one(todo, {
    fields: [monitoringData.taskId],
    references: [todo.id],
  }),
  execution: one(executionResults, {
    fields: [monitoringData.executionId],
    references: [executionResults.id],
  }),
}));

export const changeDetectionsRelations = relations(changeDetections, ({ one }) => ({
  task: one(todo, {
    fields: [changeDetections.taskId],
    references: [todo.id],
  }),
  execution: one(executionResults, {
    fields: [changeDetections.executionId],
    references: [executionResults.id],
  }),
}));
