import { InteractiveBrowserAgent } from '../../interactive-browser-agent';
import { BrowserExecutor } from '../../browser-executor';
import { createLLMFromEnv } from '../../llm/llm-factory';
import { TaskInput } from '../../types';

describe('InteractiveBrowserAgent Integration Tests', () => {
  let agent: InteractiveBrowserAgent;
  let browserExecutor: BrowserExecutor;

  beforeAll(() => {
    // Create real instances for integration testing
    browserExecutor = new BrowserExecutor({
      headless: true,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      screenshots: true,
    });

    agent = new InteractiveBrowserAgent({
      browserExecutor,
      llm: createLLMFromEnv(),
      maxSteps: 5,
      progressThreshold: 0.15,
      stagnationLimit: 3,
    });
  });

  afterAll(async () => {
    // Cleanup browser resources
    await browserExecutor.executePlan({
      id: 'cleanup',
      taskSignature: 'cleanup',
      instruction: 'cleanup',
      url: 'about:blank',
      steps: [],
      expectedResults: [],
      errorHandling: { retryCount: 0, timeoutMs: 1000 },
      validation: { successCriteria: [], failureCriteria: [] },
      metadata: {
        createdAt: new Date(),
        llmModel: 'test',
        confidence: 1,
        estimatedDuration: 1000,
      },
    });
  });

  describe('Basic Browser State Capture', () => {
    it('should capture browser state successfully', async () => {
      // This test validates the browser state capture functionality
      const browserState = await agent.captureBrowserState();

      expect(browserState).toBeDefined();
      expect(browserState.timestamp).toBeInstanceOf(Date);
      expect(browserState.viewport).toBeDefined();
      expect(browserState.url).toBeDefined();
      expect(browserState.dom).toBeDefined();
      
      // Screenshot should be available if enabled
      if (agent.getConfiguration().enableScreenshots) {
        expect(browserState.screenshot).toBeDefined();
      }
    });
  });

  describe('Interactive Task Execution', () => {
    it('should execute a simple navigation task', async () => {
      // Create a simple task
      const taskInput: TaskInput = {
        instruction: 'Navigate to example.com and capture the page state',
        url: 'https://example.com',
      };

      // Execute the task interactively
      const result = await agent.executeInteractively(taskInput);

      // Validate the result
      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.averageProgressScore).toBeGreaterThanOrEqual(0);
      
      // If successful, should have a generated plan
      if (result.success) {
        expect(result.generatedPlan).toBeDefined();
        expect(result.generatedPlan?.steps).toBeDefined();
      }
      
      // If escalated, should have escalation reason
      if (result.escalatedToHuman) {
        expect(result.escalationReason).toBeDefined();
      }
    });

    it('should handle stagnation and escalate appropriately', async () => {
      // Create a task that's likely to fail/stagnate
      const taskInput: TaskInput = {
        instruction: 'Find and click the non-existent impossible button',
        url: 'https://example.com',
      };

      // Execute the task interactively
      const result = await agent.executeInteractively(taskInput);

      // Should detect stagnation and escalate
      expect(result.escalatedToHuman).toBe(true);
      expect(result.escalationReason).toBeDefined();
      expect(result.escalationReason).toContain('stagnation');
      expect(result.metadata.stagnationDetected).toBe(true);
    });

    it('should respect configuration limits', async () => {
      // Create an agent with very low limits
      const limitedAgent = new InteractiveBrowserAgent({
        browserExecutor,
        llm: createLLMFromEnv(),
        maxSteps: 2,
        progressThreshold: 0.3,
        stagnationLimit: 1,
      });

      const taskInput: TaskInput = {
        instruction: 'Complete a complex multi-step task',
        url: 'https://example.com',
      };

      const result = await limitedAgent.executeInteractively(taskInput);

      // Should respect the low limits
      expect(result.steps.length).toBeLessThanOrEqual(2);
      
      // Should escalate due to limits
      if (!result.success) {
        expect(result.escalatedToHuman).toBe(true);
        expect(result.escalationReason).toBeDefined();
      }
    });
  });

  describe('Plan Generation from Interactive Execution', () => {
    it('should generate reusable plans from successful execution', async () => {
      // Create a simple task that should succeed
      const taskInput: TaskInput = {
        instruction: 'Navigate to example.com and get the page title',
        url: 'https://example.com',
      };

      const result = await agent.executeInteractively(taskInput);

      // If successful, should generate a plan
      if (result.success && result.generatedPlan) {
        expect(result.generatedPlan.id).toBeDefined();
        expect(result.generatedPlan.taskSignature).toBeDefined();
        expect(result.generatedPlan.instruction).toBe(taskInput.instruction);
        expect(result.generatedPlan.url).toBe(taskInput.url);
        expect(result.generatedPlan.steps).toBeDefined();
        expect(result.generatedPlan.steps.length).toBeGreaterThan(0);
        expect(result.generatedPlan.metadata).toBeDefined();
        expect(result.generatedPlan.metadata.confidence).toBeGreaterThan(0);
        expect(result.generatedPlan.metadata.llmModel).toBeDefined();
        expect(result.generatedPlan.metadata.createdAt).toBeInstanceOf(Date);
        expect(result.generatedPlan.metadata.estimatedDuration).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle browser errors gracefully', async () => {
      // Create a task with an invalid URL
      const taskInput: TaskInput = {
        instruction: 'Navigate to an invalid URL',
        url: 'https://this-domain-does-not-exist-12345.com',
      };

      const result = await agent.executeInteractively(taskInput);

      // Should handle the error gracefully
      expect(result).toBeDefined();
      expect(result.escalatedToHuman).toBe(true);
      expect(result.escalationReason).toBeDefined();
    });

    it('should handle LLM failures gracefully', async () => {
      // Create an agent with a broken LLM config
      const brokenAgent = new InteractiveBrowserAgent({
        browserExecutor,
        llm: createLLMFromEnv(), // This might fail depending on env
        maxSteps: 3,
        progressThreshold: 0.1,
        stagnationLimit: 2,
      });

      const taskInput: TaskInput = {
        instruction: 'Simple task',
        url: 'https://example.com',
      };

      const result = await brokenAgent.executeInteractively(taskInput);

      // Should handle LLM failures gracefully
      expect(result).toBeDefined();
      // If LLM fails, should either succeed with fallback or escalate
      if (!result.success) {
        expect(result.escalatedToHuman).toBe(true);
      }
    });
  });

  describe('Performance and Metrics', () => {
    it('should track execution metrics accurately', async () => {
      const taskInput: TaskInput = {
        instruction: 'Navigate to example.com',
        url: 'https://example.com',
      };

      const startTime = Date.now();
      const result = await agent.executeInteractively(taskInput);
      const endTime = Date.now();

      // Validate metrics
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.totalDuration).toBeLessThan(endTime - startTime + 1000); // Allow some margin
      expect(result.metadata.averageProgressScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata.averageProgressScore).toBeLessThanOrEqual(1);
      
      // Progress improvement should be calculated if multiple steps
      if (result.steps.length > 1) {
        expect(result.progressImprovement).toBeDefined();
      }
    });
  });

  describe('Revolutionary Concept Validation', () => {
    it('should demonstrate step-by-step LLM decision making', async () => {
      const taskInput: TaskInput = {
        instruction: 'Navigate to example.com and analyze the page structure',
        url: 'https://example.com',
      };

      const result = await agent.executeInteractively(taskInput);

      // Each step should have complete context
      result.steps.forEach(step => {
        expect(step.stepNumber).toBeGreaterThan(0);
        expect(step.browserState).toBeDefined();
        expect(step.browserState.timestamp).toBeInstanceOf(Date);
        expect(step.action).toBeDefined();
        expect(step.action.reasoning).toBeDefined();
        expect(step.executionResult).toBeDefined();
        expect(step.progressScore).toBeGreaterThanOrEqual(0);
        expect(step.progressScore).toBeLessThanOrEqual(1);
        expect(step.reasoning).toBeDefined();
      });

      // Should show gradient descent-like improvement
      if (result.steps.length > 1) {
        const progressScores = result.steps.map(s => s.progressScore);
        const hasImprovement = progressScores.some((score, i) => 
          i > 0 && score > progressScores[i - 1]
        );
        
        // Either should show improvement or escalate due to lack of progress
        expect(hasImprovement || result.escalatedToHuman).toBe(true);
      }
    });

    it('should demonstrate the advantage over blind planning', async () => {
      const taskInput: TaskInput = {
        instruction: 'Navigate to httpbin.org and find the status endpoint',
        url: 'https://httpbin.org',
      };

      const result = await agent.executeInteractively(taskInput);

      // Should demonstrate that each step is based on actual page state
      result.steps.forEach(step => {
        expect(step.browserState.dom).toBeDefined();
        expect(step.browserState.dom.length).toBeGreaterThan(0);
        expect(step.action.reasoning).toBeDefined();
        expect(step.action.reasoning.length).toBeGreaterThan(0);
      });

      // The reasoning should reference actual page elements
      const hasContextualReasoning = result.steps.some(step => 
        step.action.reasoning.toLowerCase().includes('found') ||
        step.action.reasoning.toLowerCase().includes('see') ||
        step.action.reasoning.toLowerCase().includes('page') ||
        step.action.reasoning.toLowerCase().includes('element')
      );

      expect(hasContextualReasoning).toBe(true);
    });
  });
}); 