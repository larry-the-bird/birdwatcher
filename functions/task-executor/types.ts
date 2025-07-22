// Simplified types for ReAct-based task executor
// This contains only the types needed for the new simplified implementation

// Core task and execution interfaces
export interface Task {
  id: string;
  url: string;
  instruction: string;
}

export interface Step {
  action: 'navigate' | 'click' | 'type' | 'extract';
  selector?: string;
  url?: string;
  value?: string;
  waitBeforeAction?: boolean;
}

export interface ExecutionPath {
  taskId: string;
  steps: Step[];
  lastSuccessful: Date;
}

export interface PathExecutionResult {
  success: boolean;
  extractedData?: any;
  error?: Error;
  failedAtStep?: number;
}

export interface ExplorationResult {
  success: boolean;
  path: Step[];
  extractedData?: any;
  error?: Error;
}

// Lambda function response
export interface LambdaResponse {
  statusCode: number;
  body: string;
}

// Keep minimal browser config that's actually used
export interface BrowserConfig {
  headless: boolean;
  viewport: {
    width: number;
    height: number;
  };
  timeout: number;
  screenshots: boolean;
  userAgent?: string;
}

// Keep minimal execution log for BrowserExecutor compatibility
export interface ExecutionLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepId?: string;
  data?: Record<string, any>;
}

// Keep minimal types that BrowserExecutor uses
export type ExecutionStepType = 
  | 'navigate'
  | 'click'
  | 'type'
  | 'extract'
  | 'extractText'
  | 'screenshot'
  | 'evaluate'
  | 'wait'
  | 'waitForSelector'
  | 'waitForElement'
  | 'scroll'
  | 'select'
  | 'hover'
  | 'keyPress'
  | 'reload'
  | 'goBack'
  | 'goForward';

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
  condition?: string;
}

// Keep minimal error types
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

// Keep minimal types that the old BrowserExecutor expects
export interface ExecutionResult {
  planId: string;
  status: 'success' | 'failed' | 'error';
  extractedData?: Record<string, any>;
  screenshots?: string[];
  logs: ExecutionLog[];
  error?: {
    message: string;
    step?: string;
    stack?: string;
  };
  metrics?: {
    executionTime?: number;
    stepsCompleted?: number;
    stepsTotal?: number;
    retryCount?: number;
  };
  createdAt?: Date;
}

export interface ExecutionPlan {
  id: string;
  url: string;
  steps: ExecutionStep[];
  validation: {
    successCriteria: string[];
    failureCriteria: string[];
  };
}