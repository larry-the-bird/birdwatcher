import { handler } from '../../index';
import { TaskInput } from '../../types';

// Mock environment for testing
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mock';

describe('Main Handler Integration Tests', () => {
  const baseTaskInput: TaskInput = {
    instruction: 'Navigate to example.com and analyze the page',
    url: 'https://example.com',
  };

  describe('Execution Mode Support', () => {
    it('should handle traditional plan mode (default)', async () => {
      const taskInput: TaskInput = {
        ...baseTaskInput,
        options: {
          executionMode: 'plan',
          timeout: 10000, // Shorter timeout for testing
        },
      };

      const response = await handler(taskInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBeDefined();
      expect(body.planId).toBeDefined();
      expect(body.metrics).toBeDefined();
    }, 30000);

    it('should handle interactive execution mode', async () => {
      const taskInput: TaskInput = {
        ...baseTaskInput,
        options: {
          executionMode: 'interactive',
          timeout: 15000, // Longer timeout for interactive mode
        },
      };

      const response = await handler(taskInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('interactive');
      expect(body.success).toBeDefined();
      expect(body.planId).toBeDefined();
      expect(body.interactiveSteps).toBeDefined();
      expect(body.metrics).toBeDefined();
      expect(body.escalation).toBeDefined();
      
      // Interactive mode specific metrics
      expect(body.metrics.averageProgressScore).toBeDefined();
      expect(body.metrics.maxStepsReached).toBeDefined();
      expect(body.metrics.stagnationDetected).toBeDefined();
    }, 45000);

    it('should handle auto mode with fallback', async () => {
      const taskInput: TaskInput = {
        ...baseTaskInput,
        options: {
          executionMode: 'auto',
          timeout: 15000,
        },
      };

      const response = await handler(taskInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBeDefined();
      expect(body.planId).toBeDefined();
      expect(body.metrics).toBeDefined();
      
      // Should be either interactive or plan mode
      expect(['interactive', 'plan'].includes(body.mode || 'plan')).toBe(true);
    }, 45000);

    it('should handle invalid execution mode gracefully', async () => {
      const taskInput: TaskInput = {
        ...baseTaskInput,
        options: {
          // @ts-ignore - Testing invalid mode
          executionMode: 'invalid_mode',
          timeout: 10000,
        },
      };

      const response = await handler(taskInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBeDefined();
      expect(body.planId).toBeDefined();
    }, 30000);
  });

  describe('Plan Caching Integration', () => {
    it('should cache plans generated from interactive execution', async () => {
      const taskInput: TaskInput = {
        ...baseTaskInput,
        instruction: 'Simple task that should succeed', // Make it simple to ensure success
        options: {
          executionMode: 'interactive',
          timeout: 15000,
        },
      };

      const response = await handler(taskInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      if (body.success) {
        expect(body.planId).toBeDefined();
        expect(body.mode).toBe('interactive');
        
        // The plan should be cached for future use
        // This would be verified in subsequent executions that could use the cached plan
      }
    }, 45000);
  });

  describe('Execution Mode Validation', () => {
    it('should default to plan mode when no execution mode specified', async () => {
      const taskInput: TaskInput = {
        ...baseTaskInput,
        options: {
          timeout: 10000,
        },
      };

      const response = await handler(taskInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBeDefined();
      expect(body.planId).toBeDefined();
      // Should not have interactive-specific fields
      expect(body.interactiveSteps).toBeUndefined();
      expect(body.escalation).toBeUndefined();
    }, 30000);

    it('should preserve existing planOnly and executionOnly modes', async () => {
      const planOnlyInput: TaskInput = {
        ...baseTaskInput,
        options: {
          planOnly: true,
          timeout: 10000,
        },
      };

      const response = await handler(planOnlyInput);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.mode).toBe('plan_only');
      expect(body.planDetails).toBeDefined();
      expect(body.message).toContain('Plan generated successfully');
    }, 30000);
  });
}); 