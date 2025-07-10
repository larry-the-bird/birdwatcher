import { BrowserExecutor } from '../../browser-executor';
import { ExecutionPlan, ExecutionStep, BrowserConfig, ExecutionResult } from '../../types';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('BrowserExecutor', () => {
  let browserExecutor: BrowserExecutor;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockPage = {
      goto: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      fill: jest.fn(),
      waitForSelector: jest.fn(),
      waitForTimeout: jest.fn(),
      screenshot: jest.fn(),
      evaluate: jest.fn(),
      $: jest.fn(),
      $$: jest.fn(),
      textContent: jest.fn(),
      locator: jest.fn(),
      setViewportSize: jest.fn(),
      setExtraHTTPHeaders: jest.fn(),
      close: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
    } as any;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      setDefaultTimeout: jest.fn(),
    } as any;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
    } as any;

    // Mock chromium.launch
    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    // Create browser executor
    browserExecutor = new BrowserExecutor({
      headless: true,
      viewport: { width: 1920, height: 1080 },
      timeout: 30000,
      screenshots: true,
    });
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const executor = new BrowserExecutor();
      expect(executor).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const config: BrowserConfig = {
        headless: false,
        viewport: { width: 1280, height: 720 },
        userAgent: 'custom-user-agent',
        timeout: 45000,
        screenshots: false,
      };

      const executor = new BrowserExecutor(config);
      expect(executor).toBeDefined();
    });
  });

  describe('Plan Execution', () => {
    it('should execute a complete plan successfully', async () => {
      const plan: ExecutionPlan = {
        id: 'test-plan',
        taskSignature: 'test-signature',
        instruction: 'Test automation plan',
        url: 'https://example.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to homepage',
            value: 'https://example.com',
          },
          {
            id: 'step-2',
            type: 'extract',
            description: 'Extract page title',
            selector: 'h1',
          },
        ],
        expectedResults: ['page title'],
        errorHandling: {
          retryCount: 3,
          timeoutMs: 30000,
        },
        validation: {
          successCriteria: ['Title extracted'],
          failureCriteria: ['Page not found'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.9,
          estimatedDuration: 10000,
        },
      };

      const mockElement = {
        textContent: jest.fn().mockResolvedValue('Example Homepage'),
      };

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.$.mockResolvedValue(mockElement as any);

      const result = await browserExecutor.executePlan(plan);

      expect(result.planId).toBe('test-plan');
      expect(result.metrics.stepsTotal).toBe(2);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
    });

    it('should handle plan execution with navigation failure', async () => {
      const plan: ExecutionPlan = {
        id: 'fail-plan',
        taskSignature: 'fail-signature',
        instruction: 'Plan that will fail',
        url: 'https://nonexistent.example.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to nonexistent site',
            value: 'https://nonexistent.example.com',
          },
        ],
        expectedResults: ['navigation'],
        errorHandling: {
          retryCount: 2,
          timeoutMs: 30000,
        },
        validation: {
          successCriteria: ['Page loaded'],
          failureCriteria: ['Navigation failed'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.7,
          estimatedDuration: 10000,
        },
      };

      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const result = await browserExecutor.executePlan(plan);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.metrics.stepsCompleted).toBeLessThan(result.metrics.stepsTotal);
    });

    it('should handle plan with optional steps', async () => {
      const plan: ExecutionPlan = {
        id: 'optional-plan',
        taskSignature: 'optional-signature',
        instruction: 'Plan with optional step',
        url: 'https://example.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to homepage',
            value: 'https://example.com',
          },
          {
            id: 'step-2',
            type: 'click',
            description: 'Click optional button',
            selector: '#optional-button',
            optional: true,
          },
          {
            id: 'step-3',
            type: 'extract',
            description: 'Extract content',
            selector: '.content',
          },
        ],
        expectedResults: ['content extracted'],
        errorHandling: {
          retryCount: 3,
          timeoutMs: 30000,
        },
        validation: {
          successCriteria: ['Content found'],
          failureCriteria: ['No content'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.85,
          estimatedDuration: 12000,
        },
      };

      const mockElement = {
        textContent: jest.fn().mockResolvedValue('Sample content'),
      };

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.click.mockRejectedValue(new Error('Optional button not found'));
      mockPage.$.mockResolvedValue(mockElement as any);

      const result = await browserExecutor.executePlan(plan);

      expect(result.planId).toBe('optional-plan');
      expect(result.metrics.stepsTotal).toBe(3);
      // Should complete despite optional step failure
    });

    it('should handle timeout during execution', async () => {
      const plan: ExecutionPlan = {
        id: 'timeout-plan',
        taskSignature: 'timeout-signature',
        instruction: 'Plan that will timeout',
        url: 'https://example.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to slow site',
            value: 'https://example.com',
          },
        ],
        expectedResults: ['navigation'],
        errorHandling: {
          retryCount: 1,
          timeoutMs: 1000, // Very short timeout
        },
        validation: {
          successCriteria: ['Page loaded'],
          failureCriteria: ['Timeout'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.8,
          estimatedDuration: 5000,
        },
      };

      // Mock a slow navigation
      mockPage.goto.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Navigation timeout')), 1100)
        )
      );

      const result = await browserExecutor.executePlan(plan);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('timeout');
    });

    it('should execute plan with complex step sequence', async () => {
      const plan: ExecutionPlan = {
        id: 'complex-plan',
        taskSignature: 'complex-signature',
        instruction: 'Complex multi-step automation',
        url: 'https://shop.example.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to shop',
            value: 'https://shop.example.com',
          },
          {
            id: 'step-2',
            type: 'type',
            description: 'Enter search term',
            selector: '#search',
            value: 'laptop',
          },
          {
            id: 'step-3',
            type: 'click',
            description: 'Click search button',
            selector: '#search-btn',
          },
          {
            id: 'step-4',
            type: 'waitForSelector',
            description: 'Wait for results',
            selector: '.search-results',
          },
          {
            id: 'step-5',
            type: 'extract',
            description: 'Extract product names',
            selector: '.product-name',
            options: { multiple: true },
          },
        ],
        expectedResults: ['product names'],
        errorHandling: {
          retryCount: 2,
          timeoutMs: 45000,
        },
        validation: {
          successCriteria: ['Products found'],
          failureCriteria: ['No results'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.92,
          estimatedDuration: 20000,
        },
      };

      const mockElements = [
        { textContent: jest.fn().mockResolvedValue('Laptop 1') },
        { textContent: jest.fn().mockResolvedValue('Laptop 2') },
        { textContent: jest.fn().mockResolvedValue('Laptop 3') },
      ];

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.fill.mockResolvedValue();
      mockPage.click.mockResolvedValue();
      mockPage.waitForSelector.mockResolvedValue(null as any);
      mockPage.$$.mockResolvedValue(mockElements as any);

      const result = await browserExecutor.executePlan(plan);

      expect(result.planId).toBe('complex-plan');
      expect(result.metrics.stepsTotal).toBe(5);
      expect(mockPage.goto).toHaveBeenCalledWith('https://shop.example.com', expect.any(Object));
      expect(mockPage.fill).toHaveBeenCalledWith('#search', 'laptop');
      expect(mockPage.click).toHaveBeenCalledWith('#search-btn', expect.any(Object));
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.search-results', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should handle browser initialization failure', async () => {
      (chromium.launch as jest.Mock).mockRejectedValue(new Error('Browser launch failed'));

      const plan: ExecutionPlan = {
        id: 'browser-fail-plan',
        taskSignature: 'browser-fail',
        instruction: 'Test browser failure',
        url: 'https://example.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to page',
            value: 'https://example.com',
          },
        ],
        expectedResults: ['navigation'],
        errorHandling: { retryCount: 1, timeoutMs: 30000 },
        validation: { successCriteria: ['success'], failureCriteria: ['failure'] },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.8,
          estimatedDuration: 5000,
        },
      };

      const result = await browserExecutor.executePlan(plan);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toContain('Browser launch failed');
    });

    it('should handle step execution errors with retries', async () => {
      const plan: ExecutionPlan = {
        id: 'retry-plan',
        taskSignature: 'retry-test',
        instruction: 'Test retry mechanism',
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
            type: 'click',
            description: 'Click unreliable element',
            selector: '#unreliable',
            retries: 2,
          },
        ],
        expectedResults: ['click success'],
        errorHandling: { retryCount: 3, timeoutMs: 30000 },
        validation: { successCriteria: ['clicked'], failureCriteria: ['not clicked'] },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.75,
          estimatedDuration: 10000,
        },
      };

      mockPage.goto.mockResolvedValue(null as any);
      mockPage.click
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(); // Second attempt succeeds

      const result = await browserExecutor.executePlan(plan);

      expect(result.planId).toBe('retry-plan');
      expect(result.metrics.retryCount).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use custom viewport settings', async () => {
      const customConfig: BrowserConfig = {
        headless: true,
        viewport: { width: 800, height: 600 },
        timeout: 20000,
        screenshots: false,
      };

      const executor = new BrowserExecutor(customConfig);
      expect(executor).toBeDefined();
    });

    it('should handle missing configuration gracefully', async () => {
      const executor = new BrowserExecutor({});
      expect(executor).toBeDefined();
    });
  });
});