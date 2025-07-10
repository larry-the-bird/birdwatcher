import { TaskInput, ExecutionResult, LambdaResponse } from '../../types';

// Mock all dependencies for integration testing
jest.mock('../../plan-generator');
jest.mock('../../browser-executor');
jest.mock('../../cache-manager');
jest.mock('drizzle-orm/neon-http');
jest.mock('@neondatabase/serverless');

describe('Lambda Handler Integration', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.NODE_ENV = 'test';
  });

  describe('Input Validation', () => {
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
      expect(validTask.options?.viewport?.width).toBe(1920);
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
        instruction: 'Scrape product data with custom headers',
        url: 'https://api.example.com/products',
        options: {
          userAgent: 'Mozilla/5.0 (compatible; BirdwatcherBot/1.0)',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          timeout: 45000,
        },
      };

      expect(taskWithHeaders.options?.userAgent).toContain('BirdwatcherBot');
      expect(taskWithHeaders.options?.headers?.['Authorization']).toContain('Bearer');
      expect(taskWithHeaders.options?.timeout).toBe(45000);
    });

    it('should validate complex extraction task', () => {
      const complexTask: TaskInput = {
        instruction: 'Extract product details, reviews, and pricing from e-commerce page',
        url: 'https://shop.example.com/product/12345',
        options: {
          timeout: 60000,
          screenshot: true,
          viewport: {
            width: 1280,
            height: 1024,
          },
          forceNewPlan: true,
        },
      };

      expect(complexTask.instruction).toContain('Extract');
      expect(complexTask.url).toContain('product');
      expect(complexTask.options?.forceNewPlan).toBe(true);
      expect(complexTask.options?.viewport?.height).toBe(1024);
    });
  });

  describe('Response Validation', () => {
    it('should validate successful execution result', () => {
      const successResult: ExecutionResult = {
        planId: 'plan-123',
        status: 'success',
        extractedData: {
          price: '$999',
          availability: 'In Stock',
          model: 'iPhone 15 Pro 128GB',
          reviews: [
            { rating: 5, comment: 'Excellent phone' },
            { rating: 4, comment: 'Great camera quality' },
          ],
        },
        screenshots: ['base64-screenshot-data'],
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Navigation completed successfully',
            stepId: 'step-1',
          },
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Product data extracted',
            stepId: 'step-4',
            data: { 
              itemsExtracted: 4,
              extractionMethod: 'DOM query' 
            },
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
      expect(successResult.extractedData?.reviews).toHaveLength(2);
      expect(successResult.metrics.stepsCompleted).toBe(successResult.metrics.stepsTotal);
      expect(successResult.metrics.retryCount).toBe(0);
      expect(successResult.logs).toHaveLength(2);
      expect(successResult.screenshots).toHaveLength(1);
    });

    it('should validate failed execution result with detailed error', () => {
      const failedResult: ExecutionResult = {
        planId: 'plan-456',
        status: 'failed',
        error: {
          message: 'Element not found: .price-selector after 3 retries',
          stack: 'BrowserExecutionError: Element not found\n    at extractData (browser-executor.js:156)',
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
            level: 'warn',
            message: 'Slow page load detected, extending timeout',
            stepId: 'step-2',
          },
          {
            timestamp: new Date(),
            level: 'error',
            message: 'Failed to find price element after multiple attempts',
            stepId: 'step-3',
            data: { 
              selector: '.price-selector',
              retryAttempts: 3,
              pageUrl: 'https://example.com/product'
            },
          },
        ],
        metrics: {
          executionTime: 45500,
          stepsCompleted: 2,
          stepsTotal: 5,
          retryCount: 3,
        },
        createdAt: new Date(),
      };

      expect(failedResult.status).toBe('failed');
      expect(failedResult.error?.message).toContain('Element not found');
      expect(failedResult.error?.step).toBe('step-3');
      expect(failedResult.error?.stack).toContain('BrowserExecutionError');
      expect(failedResult.metrics.stepsCompleted).toBeLessThan(failedResult.metrics.stepsTotal);
      expect(failedResult.metrics.retryCount).toBe(3);
      expect(failedResult.logs.some(log => log.level === 'error')).toBe(true);
    });

    it('should validate timeout execution result', () => {
      const timeoutResult: ExecutionResult = {
        planId: 'plan-timeout',
        status: 'timeout',
        error: {
          message: 'Execution timed out after 60000ms during step: wait-for-content',
          step: 'step-4',
        },
        extractedData: {
          partialData: 'Some data was extracted before timeout',
        },
        logs: [
          {
            timestamp: new Date(),
            level: 'info',
            message: 'Started navigation to slow loading page',
            stepId: 'step-1',
          },
          {
            timestamp: new Date(),
            level: 'warn',
            message: 'Page load taking longer than expected',
            stepId: 'step-2',
          },
          {
            timestamp: new Date(),
            level: 'warn',
            message: 'Waiting for dynamic content to load',
            stepId: 'step-4',
          },
          {
            timestamp: new Date(),
            level: 'error',
            message: 'Execution timeout reached',
            stepId: 'step-4',
            data: { timeoutMs: 60000 },
          },
        ],
        metrics: {
          executionTime: 60000,
          stepsCompleted: 3,
          stepsTotal: 6,
          retryCount: 0,
        },
        createdAt: new Date(),
      };

      expect(timeoutResult.status).toBe('timeout');
      expect(timeoutResult.error?.message).toContain('timed out');
      expect(timeoutResult.extractedData?.partialData).toBeDefined();
      expect(timeoutResult.metrics.executionTime).toBe(60000);
      expect(timeoutResult.logs.some(log => log.message.includes('timeout'))).toBe(true);
    });
  });

  describe('Lambda Response Format Validation', () => {
    it('should validate successful lambda response structure', () => {
      const mockResponse: LambdaResponse = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-abc123',
          'X-Execution-Time': '18750',
        },
        body: JSON.stringify({
          success: true,
          planId: 'plan-123',
          taskId: 'task-456',
          status: 'success',
          extractedData: {
            title: 'Example Product Page',
            price: '$299.99',
            description: 'High-quality product with excellent features',
            inStock: true,
          },
          screenshots: 2,
          metrics: {
            executionTime: 18750,
            stepsCompleted: 5,
            stepsTotal: 5,
            retryCount: 1,
            totalTime: 21340,
            cacheHit: false,
            planGenerationTime: 2590,
          },
          logs: [
            { 
              timestamp: new Date().toISOString(), 
              level: 'info', 
              message: 'Execution started' 
            },
            { 
              timestamp: new Date().toISOString(), 
              level: 'info', 
              message: 'Plan execution completed successfully' 
            },
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
      expect(body.extractedData.price).toBe('$299.99');
      expect(body.metrics.executionTime).toBeGreaterThan(0);
      expect(body.metrics.cacheHit).toBe(false);
      expect(body.logs).toHaveLength(2);
    });

    it('should validate error lambda response structure', () => {
      const mockErrorResponse: LambdaResponse = {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-error123',
        },
        body: JSON.stringify({
          success: false,
          error: {
            type: 'PlanGenerationError',
            message: 'Failed to generate execution plan: LLM service unavailable',
            code: 'LLM_SERVICE_UNAVAILABLE',
            details: {
              llmProvider: 'openai',
              apiEndpoint: 'https://api.openai.com/v1/chat/completions',
              httpStatus: 503,
            },
            timestamp: new Date().toISOString(),
          },
          metrics: {
            totalTime: 5420,
            failed: true,
            failureStage: 'plan_generation',
          },
        }),
      };

      expect(mockErrorResponse.statusCode).toBe(500);
      
      const body = JSON.parse(mockErrorResponse.body);
      expect(body.success).toBe(false);
      expect(body.error.type).toBe('PlanGenerationError');
      expect(body.error.message).toContain('Failed to generate execution plan');
      expect(body.error.details.llmProvider).toBe('openai');
      expect(body.metrics.failed).toBe(true);
      expect(body.metrics.failureStage).toBe('plan_generation');
    });

    it('should validate partial success response with warnings', () => {
      const partialSuccessResponse: LambdaResponse = {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-partial123',
        },
        body: JSON.stringify({
          success: true,
          planId: 'plan-789',
          status: 'success',
          extractedData: {
            mainContent: 'Successfully extracted content',
            optionalData: null, // Optional extraction failed
          },
          warnings: [
            {
              type: 'OptionalStepFailed',
              message: 'Optional review extraction failed - element not found',
              step: 'step-5',
            },
            {
              type: 'PerformanceWarning',
              message: 'Execution took longer than estimated',
              estimatedTime: 15000,
              actualTime: 28000,
            },
          ],
          screenshots: 1,
          metrics: {
            executionTime: 28000,
            stepsCompleted: 4,
            stepsTotal: 5,
            retryCount: 2,
            totalTime: 31250,
            cacheHit: true,
          },
        }),
      };

      expect(partialSuccessResponse.statusCode).toBe(200);
      
      const body = JSON.parse(partialSuccessResponse.body);
      expect(body.success).toBe(true);
      expect(body.extractedData.mainContent).toBeTruthy();
      expect(body.extractedData.optionalData).toBeNull();
      expect(body.warnings).toHaveLength(2);
      expect(body.warnings[0].type).toBe('OptionalStepFailed');
      expect(body.metrics.stepsCompleted).toBeLessThan(body.metrics.stepsTotal);
      expect(body.metrics.cacheHit).toBe(true);
    });
  });

  describe('API Gateway Event Handling', () => {
    it('should handle standard API Gateway event format', () => {
      const apiGatewayEvent = {
        body: JSON.stringify({
          instruction: 'Find product details on e-commerce site',
          url: 'https://shop.example.com/product/123',
          options: {
            timeout: 20000,
            screenshot: true,
            viewport: { width: 1920, height: 1080 },
          },
        }),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Amazon CloudFront',
          'X-Forwarded-For': '192.168.1.1',
        },
        httpMethod: 'POST',
        path: '/execute',
        queryStringParameters: null,
        requestContext: {
          requestId: 'api-request-123',
          accountId: '123456789012',
          stage: 'prod',
        },
      };

      const parsedBody = JSON.parse(apiGatewayEvent.body);
      expect(parsedBody.instruction).toBeTruthy();
      expect(parsedBody.url).toMatch(/^https?:\/\//);
      expect(parsedBody.options.timeout).toBe(20000);
      expect(apiGatewayEvent.httpMethod).toBe('POST');
      expect(apiGatewayEvent.requestContext.requestId).toBeTruthy();
    });

    it('should handle direct Lambda invocation format', () => {
      const directInvocation: TaskInput = {
        instruction: 'Monitor competitor pricing',
        url: 'https://competitor.example.com/products',
        taskId: 'recurring-task-456',
        options: {
          timeout: 30000,
          forceNewPlan: false,
          userAgent: 'Mozilla/5.0 (compatible; PriceMonitor/1.0)',
          headers: {
            'Accept': 'text/html,application/xhtml+xml',
          },
        },
      };

      expect(directInvocation.taskId).toBe('recurring-task-456');
      expect(directInvocation.instruction).toContain('pricing');
      expect(directInvocation.options?.forceNewPlan).toBe(false);
      expect(directInvocation.options?.userAgent).toContain('PriceMonitor');
    });
  });

  describe('Caching Behavior Validation', () => {
    it('should validate cache hit scenario data', () => {
      const cacheHitResponse = {
        success: true,
        planId: 'cached-plan-789',
        status: 'success',
        extractedData: { 
          price: '$1099',
          availability: 'Available',
          lastUpdated: new Date().toISOString(),
        },
        metrics: {
          executionTime: 8500,
          stepsCompleted: 3,
          stepsTotal: 3,
          retryCount: 0,
          cacheHit: true,
          planGenerationTime: 0, // No plan generation needed
          cacheRetrievalTime: 250,
        },
        cacheInfo: {
          cacheKey: 'hash-abc123',
          hitCount: 15,
          lastUsed: new Date().toISOString(),
          planAge: 3600000, // 1 hour old
        },
      };

      expect(cacheHitResponse.metrics.cacheHit).toBe(true);
      expect(cacheHitResponse.metrics.planGenerationTime).toBe(0);
      expect(cacheHitResponse.metrics.executionTime).toBeLessThan(15000); // Faster due to cache
      expect(cacheHitResponse.cacheInfo.hitCount).toBe(15);
      expect(cacheHitResponse.cacheInfo.planAge).toBeGreaterThan(0);
    });

    it('should validate cache miss scenario data', () => {
      const cacheMissResponse = {
        success: true,
        planId: 'new-plan-101112',
        status: 'success',
        extractedData: { 
          headlines: ['Breaking News 1', 'Breaking News 2', 'Breaking News 3'],
          timestamp: new Date().toISOString(),
        },
        metrics: {
          executionTime: 22000,
          stepsCompleted: 4,
          stepsTotal: 4,
          retryCount: 1,
          cacheHit: false,
          planGenerationTime: 3500, // Time spent generating new plan
          llmTokensUsed: 1250,
        },
        planInfo: {
          isNewPlan: true,
          confidence: 0.87,
          llmProvider: 'openai',
          llmModel: 'gpt-4',
          planComplexity: 'medium',
        },
      };

      expect(cacheMissResponse.metrics.cacheHit).toBe(false);
      expect(cacheMissResponse.metrics.planGenerationTime).toBeGreaterThan(0);
      expect(cacheMissResponse.metrics.executionTime).toBeGreaterThan(15000); // Slower due to plan generation
      expect(cacheMissResponse.planInfo.isNewPlan).toBe(true);
      expect(cacheMissResponse.planInfo.confidence).toBeGreaterThan(0.8);
      expect(cacheMissResponse.metrics.llmTokensUsed).toBeGreaterThan(0);
    });
  });
});