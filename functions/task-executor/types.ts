import { z } from 'zod';

// Change detection interfaces
export interface ChangeResult {
  hasChanged: boolean;
  changedFields: string[];
  isRestock?: boolean;
  timestamp: Date;
}

export interface ChangeDetails {
  changes: FieldChange[];
  timestamp: Date;
}

export interface FieldChange {
  field: string;
  previousValue: any;
  currentValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

// Monitoring interfaces
export interface MonitoringConfig {
  enabled: boolean;
  changeDetection: {
    fields?: string[];
    notifyOnChange: boolean;
    detectRestock?: boolean;
  };
  notifications?: {
    email?: string;
    webhook?: string;
    slack?: string;
  };
}

// Historical data storage
export interface HistoricalData {
  taskId: string;
  url: string;
  extractedData: any;
  timestamp: Date;
  executionId: string;
}

// Base execution step types
export type ExecutionStepType = 
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'waitForSelector'
  | 'waitForElement'
  | 'extract'
  | 'extractText'
  | 'scroll'
  | 'screenshot'
  | 'evaluate'
  | 'select'
  | 'hover'
  | 'keyPress'
  | 'reload'
  | 'goBack'
  | 'goForward';

// Individual execution step interface
export interface ExecutionStep {
  id: string;
  type: ExecutionStepType;
  description: string;
  selector?: string;
  value?: string | number | boolean;
  options?: Record<string, any>;
  waitTime?: number;
  retries?: number;
  optional?: boolean;
  condition?: string; // JavaScript expression to evaluate
}

// Execution plan interface
export interface ExecutionPlan {
  id: string;
  taskSignature: string;
  instruction: string;
  url: string;
  steps: ExecutionStep[];
  expectedResults: string[];
  errorHandling: {
    retryCount: number;
    timeoutMs: number;
    fallbackSteps?: ExecutionStep[];
  };
  validation: {
    successCriteria: string[];
    failureCriteria: string[];
  };
  metadata: {
    createdAt: Date;
    llmModel: string;
    confidence: number;
    estimatedDuration: number;
  };
}

// Task execution result
export interface ExecutionResult {
  taskId?: string;
  planId: string;
  status: 'success' | 'failed' | 'timeout' | 'error';
  extractedData?: Record<string, any>;
  screenshots?: string[]; // Base64 encoded screenshots
  logs: ExecutionLog[];
  error?: {
    message: string;
    stack?: string;
    step?: string;
  };
  metrics: {
    executionTime: number;
    stepsCompleted: number;
    stepsTotal: number;
    retryCount: number;
  };
  createdAt: Date;
}

// Execution log entry
export interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepId?: string;
  data?: Record<string, any>;
}

// Task input interface
export interface TaskInput {
  instruction: string;
  url: string;
  taskId?: string;
  options?: {
    timeout?: number;
    screenshot?: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
    forceNewPlan?: boolean;
    planOnly?: boolean;        // Only generate plan, don't execute
    executionOnly?: boolean;   // Only execute existing plan, don't generate
    planId?: string;          // Plan ID to execute (for executionOnly mode)
    executionMode?: 'plan' | 'interactive' | 'auto'; // Execution mode: plan = traditional, interactive = step-by-step, auto = try interactive first
    headers?: Record<string, string>; // HTTP headers for testing/authentication
  };
}

// Cache entry interface
export interface CacheEntry {
  key: string;
  planId: string;
  hitCount: number;
  lastUsed: Date;
  expiresAt: Date;
}

// LLM plan generation request
export interface PlanGenerationRequest {
  instruction: string;
  url: string;
  viewport?: string;
  pageContent?: string;
}

// LLM plan generation response
export interface PlanGenerationResponse {
  success: boolean;
  plan?: ExecutionPlan;
  error?: string;
  confidence: number;
  reasoning: string;
}

// Browser context configuration
export interface BrowserConfig {
  headless: boolean;
  viewport: {
    width: number;
    height: number;
  };
  userAgent?: string;
  timeout: number;
  screenshots: boolean;
}

// Validation schemas using Zod
export const ExecutionStepSchema = z.object({
  id: z.string(),
  type: z.enum(['navigate', 'click', 'type', 'wait', 'waitForSelector', 'waitForElement', 'extract', 'extractText', 'scroll', 'screenshot', 'evaluate', 'select', 'hover', 'keyPress', 'reload', 'goBack', 'goForward']),
  description: z.string(),
  selector: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.record(z.any()).optional(),
  waitTime: z.number().optional(),
  retries: z.number().default(3),
  optional: z.boolean().default(false),
  condition: z.string().optional(),
});

export const ExecutionPlanSchema = z.object({
  id: z.string(),
  taskSignature: z.string(),
  instruction: z.string(),
  url: z.string().url(),
  steps: z.array(ExecutionStepSchema),
  expectedResults: z.array(z.string()),
  errorHandling: z.object({
    retryCount: z.number().default(3),
    timeoutMs: z.number().default(30000),
    fallbackSteps: z.array(ExecutionStepSchema).optional(),
  }),
  validation: z.object({
    successCriteria: z.array(z.string()),
    failureCriteria: z.array(z.string()),
  }),
  metadata: z.object({
    createdAt: z.date(),
    llmModel: z.string(),
    confidence: z.number().min(0).max(1),
    estimatedDuration: z.number(),
  }),
});

export const TaskInputSchema = z.object({
  taskId: z.string().optional(),
  instruction: z.string().min(1),
  url: z.string().url(),
  options: z.object({
    forceNewPlan: z.boolean().default(false),
    timeout: z.number().default(60000),
    screenshot: z.boolean().default(true),
    viewport: z.object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    }).optional(),
    userAgent: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }).optional(),
});

// Helper type for database operations
export type DatabaseExecutionPlan = {
  id: string;
  taskSignature: string;
  instruction: string;
  url: string;
  plan: ExecutionPlan;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isActive: boolean;
};

export type DatabaseExecutionResult = {
  id: string;
  taskId?: string;
  planId: string;
  status: string;
  result?: Record<string, any>;
  logs: ExecutionLog[];
  errorMessage?: string;
  executionTime: number;
  createdAt: Date;
};

// Lambda function response
export interface LambdaResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
}

// Error types
export class TaskExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TaskExecutionError';
  }
}

export class PlanGenerationError extends Error {
  constructor(
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PlanGenerationError';
  }
}

export class BrowserExecutionError extends Error {
  constructor(
    message: string,
    public stepId?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BrowserExecutionError';
  }
} 