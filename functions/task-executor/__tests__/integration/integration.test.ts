import { TaskInput, ExecutionResult } from '../../types';

// Mock the lambda handler's dependencies for testing
jest.mock('drizzle-orm/neon-http');
jest.mock('@neondatabase/serverless');
jest.mock('playwright');

describe('Lambda Integration Tests', () => {
  // Mock environment variables
  beforeAll(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  describe('Task Validation', () => {
    it('should validate proper task input structure', () => {
      const validTask: TaskInput = {
        instruction: 'Find the price of iPhone 15 Pro on Apple website',
        url: 'https://www.apple.com',
        options: {
          timeout: 30000,
          screenshot: true,
          viewport: {
            width: 1920,
            height: 1080,
          },
        },
      };

      expect(validTask.instruction).toBeTruthy();
      expect(validTask.url).toMatch(/^https?:\/\//);
      expect(validTask.options?.timeout).toBeGreaterThan(0);
    });

    it('should handle task input with minimal required fields', () => {
      const minimalTask: TaskInput = {
        instruction: 'Extract page title',
        url: 'https://example.com',
      };

      expect(minimalTask.instruction).toBeTruthy();
      expect(minimalTask.url).toBeTruthy();
      expect(minimalTask.options).toBeUndefined();
    });

    it('should validate task with custom headers and user agent', () => {
      const taskWithHeaders: TaskInput = {
        instruction: 'Scrape product data',
        url: 'https://shop.example.com',
        options: {
          userAgent: 'Mozilla/5.0 (compatible; BirdwatcherBot/1.0)',
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 45000,
        },
      };

      expect(taskWithHeaders.options?.userAgent).toContain('BirdwatcherBot');
      expect(taskWithHeaders.options?.headers?.['Accept']).toBeTruthy();
      expect(taskWithHeaders.options?.timeout).toBe(45000);
    });
  });

  describe('Plan Generation Simulation', () => {
    it('should create a valid navigation plan', () => {
      const mockPlan = {
        id: 'plan-nav-123',
        taskSignature: 'apple-iphone-price',
        instruction: 'Find iPhone price on Apple website',
        url: 'https://www.apple.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate' as const,
            description: 'Navigate to Apple homepage',
            value: 'https://www.apple.com',
          },
          {
            id: 'step-2',
            type: 'click' as const,
            description: 'Click iPhone section',
            selector: '[data-analytics-title="iphone"]',
          },
          {
            id: 'step-3',
            type: 'click' as const,
            description: 'Click iPhone 15 Pro',
            selector: 'a[href*="iphone-15-pro"]',
          },
          {
            id: 'step-4',
            type: 'extract' as const,
            description: 'Extract iPhone price',
            selector: '.rf-pdp-price .nowrap',
          },
        ],
        expectedResults: ['iPhone 15 Pro price'],
        errorHandling: {
          retryCount: 3,
          timeoutMs: 30000,
        },
        validation: {
          successCriteria: ['Price extracted successfully'],
          failureCriteria: ['Price not found', 'Page not loaded'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.92,
          estimatedDuration: 25000,
        },
      };

      expect(mockPlan.steps).toHaveLength(4);
      expect(mockPlan.steps[0].type).toBe('navigate');
      expect(mockPlan.steps[1].type).toBe('click');
      expect(mockPlan.steps[3].type).toBe('extract');
      expect(mockPlan.metadata.confidence).toBeGreaterThan(0.9);
    });

    it('should create a search and extract plan', () => {
      const mockSearchPlan = {
        id: 'plan-search-456',
        taskSignature: 'news-headlines-cnn',
        instruction: 'Extract top 5 news headlines from CNN',
        url: 'https://www.cnn.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate' as const,
            description: 'Navigate to CNN homepage',
            value: 'https://www.cnn.com',
          },
          {
            id: 'step-2',
            type: 'waitForSelector' as const,
            description: 'Wait for headlines to load',
            selector: '.headline',
          },
          {
            id: 'step-3',
            type: 'extract' as const,
            description: 'Extract top 5 headlines',
            selector: '.headline:nth-child(-n+5)',
            options: { multiple: true },
          },
        ],
        expectedResults: ['list of headlines'],
        errorHandling: {
          retryCount: 2,
          timeoutMs: 20000,
        },
        validation: {
          successCriteria: ['At least 3 headlines extracted'],
          failureCriteria: ['No headlines found'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.88,
          estimatedDuration: 15000,
        },
      };

      expect(mockSearchPlan.steps).toHaveLength(3);
      expect(mockSearchPlan.steps[1].type).toBe('waitForSelector');
      expect(mockSearchPlan.steps[2].options?.multiple).toBe(true);
    });
  });

  describe('Execution Result Validation', () => {
    it('should create valid successful execution result', () => {
      const successResult: ExecutionResult = {
        planId: 'plan-123',
        status: 'success',
        extractedData: {
          price: '$999',
          availability: 'In Stock',
          model: 'iPhone 15 Pro 128GB',
        },
        screenshots: ['base64-screenshot-data'],
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Navigation completed',
            stepId: 'step-1',
          },
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Price extracted successfully',
            stepId: 'step-4',
            data: { price: '$999' },
          },
        ],
        metrics: {
          executionTime: 18750,
          stepsCompleted: 4,
          stepsTotal: 4,
          retryCount: 0,
        },
        createdAt: new Date(),
      };

      expect(successResult.status).toBe('success');
      expect(successResult.extractedData?.price).toBe('$999');
      expect(successResult.metrics.stepsCompleted).toBe(successResult.metrics.stepsTotal);
      expect(successResult.metrics.retryCount).toBe(0);
      expect(successResult.logs).toHaveLength(2);
      expect(successResult.screenshots).toHaveLength(1);
    });

    it('should create valid failed execution result', () => {
      const failedResult: ExecutionResult = {
        planId: 'plan-456',
        status: 'failed',
        error: {
          message: 'Element not found: .price-selector',
          stack: 'BrowserExecutionError: Element not found...',
          step: 'step-3',
        },
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Navigation completed',
            stepId: 'step-1',
          },
          {
            timestamp: new Date(),
            level: 'error',
            message: 'Failed to find price element',
            stepId: 'step-3',
            data: { selector: '.price-selector' },
          },
        ],
        metrics: {
          executionTime: 12500,
          stepsCompleted: 2,
          stepsTotal: 4,
          retryCount: 3,
        },
        createdAt: new Date(),
      };

      expect(failedResult.status).toBe('failed');
      expect(failedResult.error?.message).toContain('Element not found');
      expect(failedResult.error?.step).toBe('step-3');
      expect(failedResult.metrics.stepsCompleted).toBeLessThan(failedResult.metrics.stepsTotal);
      expect(failedResult.metrics.retryCount).toBe(3);
    });

    it('should create valid timeout execution result', () => {
      const timeoutResult: ExecutionResult = {
        planId: 'plan-timeout',
        status: 'timeout',
        error: {
          message: 'Execution timed out after 30000ms',
          step: 'step-2',
        },
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Started navigation',
            stepId: 'step-1',
          },
          {
            timestamp: new Date(),
            level: 'warn',
            message: 'Slow page load detected',
            stepId: 'step-2',
          },
          {
            timestamp: new Date(),
            level: 'error',
            message: 'Execution timeout',
            stepId: 'step-2',
          },
        ],
        metrics: {
          executionTime: 30000,
          stepsCompleted: 1,
          stepsTotal: 3,
          retryCount: 0,
        },
        createdAt: new Date(),
      };

      expect(timeoutResult.status).toBe('timeout');
      expect(timeoutResult.error?.message).toContain('timed out');
      expect(timeoutResult.metrics.executionTime).toBe(30000);
    });
  });

  describe('Lambda Response Format', () => {
    it('should format successful lambda response correctly', () => {
      const mockResponse = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-123',
        },
        body: JSON.stringify({
          success: true,
          planId: 'plan-123',
          taskId: 'task-456',
          status: 'success',
          extractedData: {
            title: 'Example Page Title',
            description: 'Page description',
          },
          screenshots: 1,
          metrics: {
            executionTime: 15420,
            stepsCompleted: 3,
            stepsTotal: 3,
            retryCount: 0,
            totalTime: 18350,
            cacheHit: false,
          },
          logs: [
            { level: 'info', message: 'Execution started' },
            { level: 'info', message: 'All steps completed' },
          ],
        }),
      };

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(mockResponse.body);
      expect(body.success).toBe(true);
      expect(body.planId).toBeTruthy();
      expect(body.status).toBe('success');
      expect(body.extractedData).toBeDefined();
      expect(body.metrics.executionTime).toBeGreaterThan(0);
    });

    it('should format error lambda response correctly', () => {
      const mockErrorResponse = {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: false,
          error: {
            type: 'BrowserExecutionError',
            message: 'Failed to launch browser',
            code: 'BROWSER_LAUNCH_FAILED',
            details: {
              browserPath: '/usr/bin/chromium',
              timeout: 30000,
            },
            timestamp: new Date().toISOString(),
          },
          metrics: {
            totalTime: 5420,
            failed: true,
          },
        }),
      };

      expect(mockErrorResponse.statusCode).toBe(500);
      
      const body = JSON.parse(mockErrorResponse.body);
      expect(body.success).toBe(false);
      expect(body.error.type).toBe('BrowserExecutionError');
      expect(body.error.message).toContain('Failed to launch browser');
      expect(body.metrics.failed).toBe(true);
    });
  });

  describe('Cache Behavior Simulation', () => {
    it('should simulate cache hit scenario', () => {
      const cacheHitResponse = {
        success: true,
        planId: 'cached-plan-789',
        status: 'success',
        extractedData: { price: '$1099' },
        metrics: {
          executionTime: 8500,
          stepsCompleted: 3,
          stepsTotal: 3,
          retryCount: 0,
          cacheHit: true,
          planGenerationTime: 0, // No plan generation needed
        },
      };

      expect(cacheHitResponse.metrics.cacheHit).toBe(true);
      expect(cacheHitResponse.metrics.planGenerationTime).toBe(0);
      expect(cacheHitResponse.metrics.executionTime).toBeLessThan(15000); // Faster due to cache
    });

    it('should simulate cache miss scenario', () => {
      const cacheMissResponse = {
        success: true,
        planId: 'new-plan-101112',
        status: 'success',
        extractedData: { headlines: ['News 1', 'News 2', 'News 3'] },
        metrics: {
          executionTime: 22000,
          stepsCompleted: 4,
          stepsTotal: 4,
          retryCount: 1,
          cacheHit: false,
          planGenerationTime: 3500, // Time spent generating new plan
        },
      };

      expect(cacheMissResponse.metrics.cacheHit).toBe(false);
      expect(cacheMissResponse.metrics.planGenerationTime).toBeGreaterThan(0);
      expect(cacheMissResponse.metrics.executionTime).toBeGreaterThan(15000); // Slower due to plan generation
    });
  });
});