-- Create database tables for birdwatcher task executor

-- Tasks table (main tasks)
CREATE TABLE IF NOT EXISTS task (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    creator_id TEXT NOT NULL,
    name TEXT NOT NULL,
    instruction TEXT NOT NULL,
    url TEXT NOT NULL,
    cron TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Execution plans table (generated automation plans)
CREATE TABLE IF NOT EXISTS execution_plans (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_signature TEXT NOT NULL UNIQUE,
    instruction TEXT NOT NULL,
    url TEXT NOT NULL,
    plan JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Execution results table (results from plan executions)
CREATE TABLE IF NOT EXISTS execution_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    task_id TEXT REFERENCES task(id),
    plan_id TEXT REFERENCES execution_plans(id),
    status TEXT NOT NULL,
    result JSONB,
    logs JSONB,
    error_message TEXT,
    execution_time INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Plan cache table (for caching execution plans)
CREATE TABLE IF NOT EXISTS plan_cache (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    cache_key TEXT NOT NULL UNIQUE,
    plan_id TEXT REFERENCES execution_plans(id) NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_used TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_creator_id ON task(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_active ON task(is_active);
CREATE INDEX IF NOT EXISTS idx_execution_plans_signature ON execution_plans(task_signature);
CREATE INDEX IF NOT EXISTS idx_execution_plans_active ON execution_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_execution_results_task_id ON execution_results(task_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_plan_id ON execution_results(plan_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_status ON execution_results(status);
CREATE INDEX IF NOT EXISTS idx_plan_cache_key ON plan_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_plan_cache_expires ON plan_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_plan_cache_plan_id ON plan_cache(plan_id); 