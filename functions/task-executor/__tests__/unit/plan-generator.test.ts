import { PlanGenerator } from '../../plan-generator';
import { BaseLLM } from '../../llm/base-llm';
import { PlanGenerationRequest, ExecutionPlan, PlanGenerationResponse } from '../../types';

// Mock the LLM dependencies
jest.mock('../../llm/llm-factory');
jest.mock('../../prompts/prompt-manager');

describe('PlanGenerator', () => {
  let planGenerator: PlanGenerator;
  let mockLLM: jest.Mocked<BaseLLM>;

  beforeEach(() => {
    // Create mock LLM instance
    mockLLM = {
      generatePlan: jest.fn(),
      generateText: jest.fn(),
      getProviderInfo: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4',
        supportsJsonMode: true,
        supportsStreaming: true,
        maxTokens: 128000,
      }),
    } as any;

    // Create plan generator with mock LLM
    planGenerator = new PlanGenerator({
      llm: mockLLM,
      maxRetries: 3,
      timeoutMs: 30000,
    });

    // Mock prompt manager
    const mockPromptManager = require('../../prompts/prompt-manager');
    mockPromptManager.getPrompts = jest.fn().mockReturnValue({
      systemPrompt: 'You are a web automation expert.',
      userPrompt: 'Generate a plan for: {{instruction}}',
    });
  });

  describe('generatePlan', () => {
    it('should generate a valid execution plan', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Find the price of iPhone 15 on Apple website',
        url: 'https://www.apple.com',
      };

      const mockLLMResponse: PlanGenerationResponse = {
        success: true,
        plan: {
          id: 'plan-123',
          taskSignature: 'apple-iphone-price',
          instruction: request.instruction,
          url: request.url,
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate to Apple website',
              value: request.url,
            },
            {
              id: 'step-2',
              type: 'click',
              description: 'Click on iPhone section',
              selector: '[data-analytics-title="iphone"]',
            },
            {
              id: 'step-3',
              type: 'extract',
              description: 'Extract iPhone 15 price',
              selector: '.rf-pdp-price .nowrap',
            },
          ],
          expectedResults: ['iPhone 15 price'],
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
            estimatedDuration: 15000,
          },
        },
        confidence: 0.92,
        reasoning: 'High confidence plan with specific Apple website selectors',
      };

      mockLLM.generatePlan.mockResolvedValue(mockLLMResponse);

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(true);
      expect(response.plan).toBeDefined();
      expect(response.plan!.steps).toHaveLength(3);
      expect(response.plan!.steps[0].type).toBe('navigate');
      expect(response.plan!.steps[1].type).toBe('click');
      expect(response.plan!.steps[2].type).toBe('extract');
      expect(response.confidence).toBe(0.92);
      expect(response.reasoning).toContain('High confidence');
      expect(mockLLM.generatePlan).toHaveBeenCalledWith(
        request,
        'You are a web automation expert.',
        'Generate a plan for: {{instruction}}'
      );
    });

    it('should handle LLM errors gracefully', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Test instruction',
        url: 'https://example.com',
      };

      mockLLM.generatePlan.mockRejectedValue(new Error('LLM API error'));

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('LLM API error');
      expect(response.confidence).toBe(0);
      expect(response.reasoning).toBe('Failed to generate plan due to error');
    });

    it('should generate plan for complex multi-step task', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Search for laptops under $1000, filter by brand, and get top 3 results',
        url: 'https://electronics.example.com',
      };

      const mockLLMResponse: PlanGenerationResponse = {
        success: true,
        plan: {
          id: 'plan-complex',
          taskSignature: 'laptop-search-filter',
          instruction: request.instruction,
          url: request.url,
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate to electronics store',
              value: request.url,
            },
            {
              id: 'step-2',
              type: 'type',
              description: 'Search for laptops',
              selector: '#search-input',
              value: 'laptops',
            },
            {
              id: 'step-3',
              type: 'click',
              description: 'Click search button',
              selector: '#search-button',
            },
            {
              id: 'step-4',
              type: 'click',
              description: 'Apply price filter',
              selector: '[data-filter="price-under-1000"]',
            },
            {
              id: 'step-5',
              type: 'click',
              description: 'Apply brand filter',
              selector: '[data-filter="brand-dell"]',
            },
            {
              id: 'step-6',
              type: 'extract',
              description: 'Extract top 3 laptop results',
              selector: '.product-item:nth-child(-n+3) .product-name',
            },
          ],
          expectedResults: ['top 3 laptop names'],
          errorHandling: {
            retryCount: 3,
            timeoutMs: 45000,
          },
          validation: {
            successCriteria: ['Search results displayed', 'Filters applied', 'Results extracted'],
            failureCriteria: ['No search results', 'Filter not available', 'Page error'],
          },
          metadata: {
            createdAt: new Date(),
            llmModel: 'gpt-4',
            confidence: 0.78,
            estimatedDuration: 25000,
          },
        },
        confidence: 0.78,
        reasoning: 'Multi-step plan with search and filtering logic',
      };

      mockLLM.generatePlan.mockResolvedValue(mockLLMResponse);

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(true);
      expect(response.plan).toBeDefined();
      expect(response.plan!.steps).toHaveLength(6);
      expect(response.plan!.steps[0].type).toBe('navigate');
      expect(response.plan!.steps[1].type).toBe('type');
      expect(response.plan!.steps[2].type).toBe('click');
      expect(response.plan!.steps[5].type).toBe('extract');
      expect(response.plan!.metadata.estimatedDuration).toBe(25000);
      expect(response.confidence).toBe(0.78);
    });

    it('should handle plan generation with existing plans context', async () => {
      const existingPlan: ExecutionPlan = {
        id: 'existing-plan',
        taskSignature: 'existing-signature',
        instruction: 'Previous similar task',
        url: 'https://example.com',
        steps: [
          {
            id: 'prev-step-1',
            type: 'navigate',
            description: 'Previous navigation',
            value: 'https://example.com',
          },
        ],
        expectedResults: ['previous result'],
        errorHandling: { retryCount: 3, timeoutMs: 30000 },
        validation: { successCriteria: ['success'], failureCriteria: ['failure'] },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.85,
          estimatedDuration: 10000,
        },
      };

      const request: PlanGenerationRequest = {
        instruction: 'Similar task with improvements',
        url: 'https://example.com',
        existingPlans: [existingPlan],
      };

      const mockLLMResponse: PlanGenerationResponse = {
        success: true,
        plan: {
          id: 'improved-plan',
          taskSignature: 'improved-signature',
          instruction: request.instruction,
          url: request.url,
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Improved navigation',
              value: request.url,
            },
            {
              id: 'step-2',
              type: 'extract',
              description: 'Enhanced extraction',
              selector: '.improved-selector',
            },
          ],
          expectedResults: ['improved result'],
          errorHandling: { retryCount: 2, timeoutMs: 25000 },
          validation: { successCriteria: ['enhanced success'], failureCriteria: ['enhanced failure'] },
          metadata: {
            createdAt: new Date(),
            llmModel: 'gpt-4',
            confidence: 0.90,
            estimatedDuration: 8000,
          },
        },
        confidence: 0.90,
        reasoning: 'Improved plan based on existing plan context',
      };

      mockLLM.generatePlan.mockResolvedValue(mockLLMResponse);

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(true);
      expect(response.plan).toBeDefined();
      expect(response.plan!.id).toBe('improved-plan');
      expect(response.confidence).toBe(0.90);
      expect(response.reasoning).toContain('existing plan context');
      expect(mockLLM.generatePlan).toHaveBeenCalledWith(
        expect.objectContaining({ existingPlans: [existingPlan] }),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('error handling and retries', () => {
    it('should handle timeout errors', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Complex task requiring long processing',
        url: 'https://example.com',
      };

      mockLLM.generatePlan.mockRejectedValue(new Error('Request timeout'));

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Request timeout');
      expect(response.confidence).toBe(0);
    });

    it('should handle API quota exceeded errors', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Test instruction',
        url: 'https://example.com',
      };

      mockLLM.generatePlan.mockRejectedValue(new Error('API quota exceeded'));

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('API quota exceeded');
    });

    it('should handle network connectivity issues', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Test network failure',
        url: 'https://example.com',
      };

      mockLLM.generatePlan.mockRejectedValue(new Error('Network error: Connection refused'));

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Network error: Connection refused');
      expect(response.reasoning).toBe('Failed to generate plan due to error');
    });
  });

  describe('provider information', () => {
    it('should include provider information in metadata', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Test instruction',
        url: 'https://example.com',
      };

      const mockLLMResponse: PlanGenerationResponse = {
        success: true,
        plan: {
          id: 'plan-provider',
          taskSignature: 'provider-test',
          instruction: request.instruction,
          url: request.url,
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate to page',
              value: request.url,
            },
          ],
          expectedResults: ['navigation'],
          errorHandling: {
            retryCount: 3,
            timeoutMs: 30000,
          },
          validation: {
            successCriteria: ['success'],
            failureCriteria: ['failure'],
          },
          metadata: {
            createdAt: new Date(),
            llmModel: 'gpt-4',
            confidence: 0.9,
            estimatedDuration: 5000,
          },
        },
        confidence: 0.9,
        reasoning: 'Simple navigation plan',
      };

      mockLLM.generatePlan.mockResolvedValue(mockLLMResponse);

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(true);
      expect(response.plan).toBeDefined();
      expect(response.plan!.metadata).toHaveProperty('llmProvider', 'openai');
      expect(response.plan!.metadata).toHaveProperty('llmModel', 'gpt-4');
      expect(response.plan!.metadata).toHaveProperty('generatedAt');
      expect(response.plan!.metadata).toHaveProperty('duration');
    });

    it('should handle different LLM providers', async () => {
      // Test with Anthropic provider
      mockLLM.getProviderInfo.mockReturnValue({
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        supportsJsonMode: true,
        supportsStreaming: true,
        maxTokens: 100000,
      });

      const request: PlanGenerationRequest = {
        instruction: 'Test with Anthropic',
        url: 'https://example.com',
      };

      const mockLLMResponse: PlanGenerationResponse = {
        success: true,
        plan: {
          id: 'anthropic-plan',
          taskSignature: 'anthropic-test',
          instruction: request.instruction,
          url: request.url,
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate with Claude',
              value: request.url,
            },
          ],
          expectedResults: ['claude navigation'],
          errorHandling: { retryCount: 3, timeoutMs: 30000 },
          validation: { successCriteria: ['success'], failureCriteria: ['failure'] },
          metadata: {
            createdAt: new Date(),
            llmModel: 'claude-3-sonnet',
            confidence: 0.95,
            estimatedDuration: 6000,
          },
        },
        confidence: 0.95,
        reasoning: 'Navigation plan generated by Claude',
      };

      mockLLM.generatePlan.mockResolvedValue(mockLLMResponse);

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(true);
      expect(response.plan!.metadata).toHaveProperty('llmProvider', 'anthropic');
      expect(response.plan!.metadata).toHaveProperty('llmModel', 'claude-3-sonnet');
    });
  });

  describe('plan optimization', () => {
    it('should optimize plan for better performance', async () => {
      const request: PlanGenerationRequest = {
        instruction: 'Extract multiple data points from a page efficiently',
        url: 'https://example.com',
      };

      const mockLLMResponse: PlanGenerationResponse = {
        success: true,
        plan: {
          id: 'plan-optimize',
          taskSignature: 'multi-extract-optimized',
          instruction: request.instruction,
          url: request.url,
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate to page',
              value: request.url,
            },
            {
              id: 'step-2',
              type: 'evaluate',
              description: 'Extract all data in single operation',
              value: `JSON.stringify({
                title: document.querySelector('h1')?.textContent,
                description: document.querySelector('.description')?.textContent,
                price: document.querySelector('.price')?.textContent
              })`,
            },
          ],
          expectedResults: ['all data extracted'],
          errorHandling: {
            retryCount: 3,
            timeoutMs: 20000,
          },
          validation: {
            successCriteria: ['All data extracted efficiently'],
            failureCriteria: ['Missing data'],
          },
          metadata: {
            createdAt: new Date(),
            llmModel: 'gpt-4',
            confidence: 0.88,
            estimatedDuration: 8000, // Faster due to optimization
          },
        },
        confidence: 0.88,
        reasoning: 'Optimized plan using single JavaScript evaluation instead of multiple extractions',
      };

      mockLLM.generatePlan.mockResolvedValue(mockLLMResponse);

      const response = await planGenerator.generatePlan(request);

      expect(response.success).toBe(true);
      expect(response.plan).toBeDefined();
      expect(response.plan!.steps).toHaveLength(2); // Optimized to fewer steps
      expect(response.plan!.steps[1].type).toBe('evaluate'); // Uses evaluate for efficiency
      expect(response.plan!.metadata.estimatedDuration).toBeLessThan(15000); // Faster execution
      expect(response.reasoning).toContain('Optimized');
    });
  });
});