import { relations } from "drizzle-orm/relations";
import { task, executionResults, executionPlans, planCache } from "./schema";

export const executionResultsRelations = relations(executionResults, ({one}) => ({
	task: one(task, {
		fields: [executionResults.taskId],
		references: [task.id]
	}),
	executionPlan: one(executionPlans, {
		fields: [executionResults.planId],
		references: [executionPlans.id]
	}),
}));

export const taskRelations = relations(task, ({many}) => ({
	executionResults: many(executionResults),
}));

export const executionPlansRelations = relations(executionPlans, ({many}) => ({
	executionResults: many(executionResults),
	planCaches: many(planCache),
}));

export const planCacheRelations = relations(planCache, ({one}) => ({
	executionPlan: one(executionPlans, {
		fields: [planCache.planId],
		references: [executionPlans.id]
	}),
}));