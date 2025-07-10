import { 
  ExecutionStep, 
  ExecutionPlan, 
  TaskInput, 
  ExecutionResult,
  ExecutionStepSchema,
  TaskInputSchema 
} from '../../types';

describe('Types Validation', () => {
  it('should validate ExecutionStep schema', () => {
    const validStep: ExecutionStep = {
      id: 'step-1',
      type: 'navigate',
      description: 'Navigate to homepage',
      value: 'https://example.com',
    };

    const result = ExecutionStepSchema.safeParse(validStep);
    expect(result.success).toBe(true);
  });

  it('should reject invalid ExecutionStep', () => {
    const invalidStep = {
      id: 'step-1',
      type: 'invalid-type', // Invalid type
      description: 'Invalid step',
    };

    const result = ExecutionStepSchema.safeParse(invalidStep);
    expect(result.success).toBe(false);
  });

  it('should validate TaskInput schema', () => {
    const validTask: TaskInput = {
      instruction: 'Find the price of iPhone',
      url: 'https://apple.com',
      options: {
        timeout: 30000,
        screenshot: true,
      },
    };

    const result = TaskInputSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('should reject TaskInput with invalid URL', () => {
    const invalidTask = {
      instruction: 'Test task',
      url: 'not-a-url',
    };

    const result = TaskInputSchema.safeParse(invalidTask);
    expect(result.success).toBe(false);
  });

  it('should handle optional fields in TaskInput', () => {
    const minimalTask: TaskInput = {
      instruction: 'Simple task',
      url: 'https://example.com',
    };

    const result = TaskInputSchema.safeParse(minimalTask);
    expect(result.success).toBe(true);
    
    if (result.success) {
      // Options is optional, so it may be undefined for minimal input
      expect(result.data.instruction).toBe('Simple task');
      expect(result.data.url).toBe('https://example.com');
    }
  });

  it('should create valid ExecutionPlan structure', () => {
    const plan: ExecutionPlan = {
      id: 'plan-123',
      taskSignature: 'test-signature',
      instruction: 'Test instruction',
      url: 'https://example.com',
      steps: [
        {
          id: 'step-1',
          type: 'navigate',
          description: 'Navigate to page',
          value: 'https://example.com',
        },
        {
          id: 'step-2',
          type: 'extract',
          description: 'Extract title',
          selector: 'h1',
        },
      ],
      expectedResults: ['page title'],
      errorHandling: {
        retryCount: 3,
        timeoutMs: 30000,
      },
      validation: {
        successCriteria: ['title extracted'],
        failureCriteria: ['page not found'],
      },
      metadata: {
        createdAt: new Date(),
        llmModel: 'gpt-4',
        confidence: 0.9,
        estimatedDuration: 15000,
      },
    };

    expect(plan.id).toBe('plan-123');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].type).toBe('navigate');
    expect(plan.steps[1].type).toBe('extract');
    expect(plan.metadata.confidence).toBe(0.9);
  });

  it('should create valid ExecutionResult structure', () => {
    const result: ExecutionResult = {
      planId: 'plan-123',
      status: 'success',
      extractedData: {
        title: 'Test Page',
        price: '$99.99',
      },
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'Step completed',
          stepId: 'step-1',
        },
      ],
      metrics: {
        executionTime: 15000,
        stepsCompleted: 2,
        stepsTotal: 2,
        retryCount: 0,
      },
      createdAt: new Date(),
    };

    expect(result.planId).toBe('plan-123');
    expect(result.status).toBe('success');
    expect(result.extractedData?.title).toBe('Test Page');
    expect(result.metrics.stepsCompleted).toBe(2);
    expect(result.logs).toHaveLength(1);
  });

  it('should handle all ExecutionStep types', () => {
    const stepTypes = [
      'navigate', 'click', 'type', 'wait', 'waitForSelector', 
      'extract', 'scroll', 'screenshot', 'evaluate', 'select', 
      'hover', 'keyPress', 'reload', 'goBack', 'goForward'
    ];

    stepTypes.forEach(type => {
      const step = {
        id: `step-${type}`,
        type: type,
        description: `Test ${type} step`,
      };

      const result = ExecutionStepSchema.safeParse(step);
      expect(result.success).toBe(true);
    });
  });

  it('should handle error types correctly', () => {
    const result: ExecutionResult = {
      planId: 'error-plan',
      status: 'failed',
      error: {
        message: 'Step failed',
        stack: 'Error stack trace',
        step: 'step-2',
      },
      logs: [],
      metrics: {
        executionTime: 5000,
        stepsCompleted: 1,
        stepsTotal: 2,
        retryCount: 2,
      },
      createdAt: new Date(),
    };

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('Step failed');
    expect(result.error?.step).toBe('step-2');
    expect(result.metrics.retryCount).toBe(2);
  });
});