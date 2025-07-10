import { InteractiveBrowserAgent } from '../../interactive-browser-agent';
import { BrowserExecutor } from '../../browser-executor';
import { BaseLLM } from '../../llm/base-llm';
import { 
  TaskInput, 
  ExecutionPlan, 
  ExecutionStep 
} from '../../types';

// Mock dependencies
jest.mock('../../browser-executor');
jest.mock('../../llm/base-llm');

describe('InteractiveBrowserAgent', () => {
  let agent: InteractiveBrowserAgent;
  let mockBrowserExecutor: jest.Mocked<BrowserExecutor>;
  let mockLLM: jest.Mocked<BaseLLM>;

  beforeEach(() => {
    // Create mocks
    mockBrowserExecutor = {
      executePlan: jest.fn(),
      getPageContent: jest.fn(),
      takeScreenshot: jest.fn(),
      getDOM: jest.fn(),
      getCurrentUrl: jest.fn(),
      getViewport: jest.fn(),
      executeStep: jest.fn(),
      initializeBrowser: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    mockLLM = {
      generatePlan: jest.fn(),
      generateText: jest.fn(),
      generateCompletion: jest.fn(),
      getProviderInfo: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'gpt-4',
        supportsJsonMode: true,
        supportsStreaming: true,
        maxTokens: 128000,
      }),
    } as any;

    // Create agent with mocked dependencies
    agent = new InteractiveBrowserAgent({
      browserExecutor: mockBrowserExecutor,
      llm: mockLLM,
      maxSteps: 10,
      progressThreshold: 0.1,
      stagnationLimit: 3,
    });
  });

  describe('Browser State Capture', () => {
    it('should capture browser state with screenshot and DOM', async () => {
      // Arrange
      const mockScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSU...';
      const mockDOM = '<html><body><h1>Test Page</h1><button id="test-btn">Click Me</button></body></html>';
      const mockUrl = 'https://example.com';

      mockBrowserExecutor.takeScreenshot.mockResolvedValue(mockScreenshot);
      mockBrowserExecutor.getDOM.mockResolvedValue(mockDOM);
      mockBrowserExecutor.getCurrentUrl.mockReturnValue(mockUrl);
      mockBrowserExecutor.getViewport.mockReturnValue({ width: 1920, height: 1080 });

      // Act
      const browserState = await agent.captureBrowserState();

      // Assert
      expect(browserState).toEqual({
        screenshot: mockScreenshot,
        dom: mockDOM,
        url: mockUrl,
        timestamp: expect.any(Date),
        viewport: expect.any(Object),
      });
      expect(mockBrowserExecutor.takeScreenshot).toHaveBeenCalledTimes(1);
      expect(mockBrowserExecutor.getDOM).toHaveBeenCalledTimes(1);
    });

    it('should handle browser state capture errors gracefully', async () => {
      // Arrange
      mockBrowserExecutor.takeScreenshot.mockRejectedValue(new Error('Screenshot failed'));
      mockBrowserExecutor.getDOM.mockResolvedValue('<html></html>');
      mockBrowserExecutor.getCurrentUrl.mockReturnValue('https://example.com');
      mockBrowserExecutor.getViewport.mockReturnValue({ width: 1920, height: 1080 });

      // Act
      const browserState = await agent.captureBrowserState();

      // Assert
      expect(browserState.screenshot).toBeNull();
      expect(browserState.dom).toBe('<html></html>');
      expect(browserState.error).toBeDefined();
    });
  });

  describe('Step-by-Step Interaction', () => {
    it('should execute a simple task step by step', async () => {
      // Arrange
      const taskInput: TaskInput = {
        instruction: 'Click the submit button',
        url: 'https://example.com',
      };

      const mockInitialState = {
        screenshot: 'initial-screenshot',
        dom: '<html><body><button id="submit">Submit</button></body></html>',
        url: 'https://example.com',
        timestamp: new Date(),
        viewport: { width: 1920, height: 1080 },
      };

      const mockFinalState = {
        screenshot: 'final-screenshot',
        dom: '<html><body><button id="submit" class="clicked">Submit</button></body></html>',
        url: 'https://example.com',
        timestamp: new Date(),
        viewport: { width: 1920, height: 1080 },
      };

      const mockLLMResponse = {
        action: {
          type: 'click' as const,
          selector: '#submit',
          reasoning: 'Found submit button, clicking it to complete the task',
        },
        progressEvaluation: {
          score: 1.0,
          reasoning: 'Task completed successfully - submit button was clicked',
          isComplete: true,
        },
      };

      // Mock browser state capture
      agent.captureBrowserState = jest.fn()
        .mockResolvedValueOnce(mockInitialState)
        .mockResolvedValueOnce(mockFinalState);

      // Mock LLM decision making
      mockLLM.generateCompletion.mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      // Mock browser action execution
      mockBrowserExecutor.executePlan.mockResolvedValue({
        planId: 'test-plan',
        status: 'success',
        extractedData: { clicked: true },
        screenshots: [],
        logs: [],
        metrics: { executionTime: 1000, stepsCompleted: 1, stepsTotal: 1, retryCount: 0 },
        createdAt: new Date(),
      });

      // Act
      const result = await agent.executeInteractively(taskInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].action.type).toBe('click');
      expect(result.steps[0].action.selector).toBe('#submit');
      expect(result.steps[0].progressScore).toBe(1.0);
      expect(result.steps[0].isComplete).toBe(true);
      expect(result.generatedPlan).toBeDefined();
      expect(result.generatedPlan?.steps).toHaveLength(1);
    });

    it('should handle multi-step tasks with progress evaluation', async () => {
      // Arrange
      const taskInput: TaskInput = {
        instruction: 'Fill out the form with name "John Doe" and click submit',
        url: 'https://example.com/form',
      };

      const mockStates = [
        {
          screenshot: 'state1-screenshot',
          dom: '<html><body><input id="name" placeholder="Name"><button id="submit">Submit</button></body></html>',
          url: 'https://example.com/form',
          timestamp: new Date(),
          viewport: { width: 1920, height: 1080 },
        },
        {
          screenshot: 'state2-screenshot',
          dom: '<html><body><input id="name" value="John Doe"><button id="submit">Submit</button></body></html>',
          url: 'https://example.com/form',
          timestamp: new Date(),
          viewport: { width: 1920, height: 1080 },
        },
        {
          screenshot: 'state3-screenshot',
          dom: '<html><body><input id="name" value="John Doe"><button id="submit" class="clicked">Submit</button></body></html>',
          url: 'https://example.com/form',
          timestamp: new Date(),
          viewport: { width: 1920, height: 1080 },
        },
      ];

      const mockLLMResponses = [
        {
          action: {
            type: 'type' as const,
            selector: '#name',
            value: 'John Doe',
            reasoning: 'Need to fill the name field first',
          },
          progressEvaluation: {
            score: 0.5,
            reasoning: 'Filled name field, still need to click submit',
            isComplete: false,
          },
        },
        {
          action: {
            type: 'click' as const,
            selector: '#submit',
            reasoning: 'Name is filled, now clicking submit to complete the form',
          },
          progressEvaluation: {
            score: 1.0,
            reasoning: 'Form submitted successfully, task complete',
            isComplete: true,
          },
        },
      ];

      // Mock browser state capture
      agent.captureBrowserState = jest.fn()
        .mockResolvedValueOnce(mockStates[0])
        .mockResolvedValueOnce(mockStates[1])
        .mockResolvedValueOnce(mockStates[2]);

      // Mock LLM decision making
      mockLLM.generateCompletion
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[0]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[1]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });

      // Mock browser action execution
      mockBrowserExecutor.executePlan.mockResolvedValue({
        planId: 'test-plan',
        status: 'success',
        extractedData: { success: true },
        screenshots: [],
        logs: [],
        metrics: { executionTime: 1000, stepsCompleted: 1, stepsTotal: 1, retryCount: 0 },
        createdAt: new Date(),
      });

      // Act
      const result = await agent.executeInteractively(taskInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      
      // First step - type
      expect(result.steps[0].action.type).toBe('type');
      expect(result.steps[0].action.selector).toBe('#name');
      expect(result.steps[0].action.value).toBe('John Doe');
      expect(result.steps[0].progressScore).toBe(0.5);
      expect(result.steps[0].isComplete).toBe(false);
      
      // Second step - click
      expect(result.steps[1].action.type).toBe('click');
      expect(result.steps[1].action.selector).toBe('#submit');
      expect(result.steps[1].progressScore).toBe(1.0);
      expect(result.steps[1].isComplete).toBe(true);
      
      // Generated plan
      expect(result.generatedPlan).toBeDefined();
      expect(result.generatedPlan?.steps).toHaveLength(2);
    });
  });

  describe('Gradient Descent-like Progress Evaluation', () => {
    it('should improve actions based on progress scores', async () => {
      // Arrange
      const taskInput: TaskInput = {
        instruction: 'Find and click the "Buy Now" button',
        url: 'https://shop.example.com',
      };

      const mockStates = [
        {
          screenshot: 'state1',
          dom: '<html><body><button class="btn-primary">Add to Cart</button><button class="btn-secondary">Buy Now</button></body></html>',
          url: 'https://shop.example.com',
          timestamp: new Date(),
          viewport: { width: 1920, height: 1080 },
        },
        {
          screenshot: 'state2',
          dom: '<html><body><button class="btn-primary clicked">Add to Cart</button><button class="btn-secondary">Buy Now</button></body></html>',
          url: 'https://shop.example.com',
          timestamp: new Date(),
          viewport: { width: 1920, height: 1080 },
        },
        {
          screenshot: 'state3',
          dom: '<html><body><button class="btn-primary">Add to Cart</button><button class="btn-secondary clicked">Buy Now</button></body></html>',
          url: 'https://shop.example.com',
          timestamp: new Date(),
          viewport: { width: 1920, height: 1080 },
        },
      ];

      const mockLLMResponses = [
        {
          action: {
            type: 'click' as const,
            selector: '.btn-primary',
            reasoning: 'Trying the primary button first',
          },
          progressEvaluation: {
            score: 0.2,
            reasoning: 'Clicked wrong button, but learned page structure',
            isComplete: false,
          },
        },
        {
          action: {
            type: 'click' as const,
            selector: '.btn-secondary',
            reasoning: 'Previous attempt had low score, trying secondary button which might be "Buy Now"',
          },
          progressEvaluation: {
            score: 1.0,
            reasoning: 'Successfully clicked the Buy Now button',
            isComplete: true,
          },
        },
      ];

      // Mock browser state capture
      agent.captureBrowserState = jest.fn()
        .mockResolvedValueOnce(mockStates[0])
        .mockResolvedValueOnce(mockStates[1])
        .mockResolvedValueOnce(mockStates[2]);

      // Mock LLM decision making
      mockLLM.generateCompletion
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[0]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[1]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });

      // Mock browser action execution
      mockBrowserExecutor.executePlan.mockResolvedValue({
        planId: 'test-plan',
        status: 'success',
        extractedData: { success: true },
        screenshots: [],
        logs: [],
        metrics: { executionTime: 1000, stepsCompleted: 1, stepsTotal: 1, retryCount: 0 },
        createdAt: new Date(),
      });

      // Act
      const result = await agent.executeInteractively(taskInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      
      // Should show progress improvement
      expect(result.steps[0].progressScore).toBe(0.2);
      expect(result.steps[1].progressScore).toBe(1.0);
      
      // Should show learning from previous steps
      expect(result.steps[1].action.reasoning).toContain('Previous attempt had low score');
      expect(result.progressImprovement).toBe(0.8); // 1.0 - 0.2
    });

    it('should detect stagnation and escalate to human', async () => {
      // Arrange
      const taskInput: TaskInput = {
        instruction: 'Find the hidden login form',
        url: 'https://complex.example.com',
      };

      const mockState = {
        screenshot: 'complex-page',
        dom: '<html><body><div class="content">No obvious login form</div></body></html>',
        url: 'https://complex.example.com',
        timestamp: new Date(),
        viewport: { width: 1920, height: 1080 },
      };

      const mockLLMResponses = [
        {
          action: {
            type: 'click' as const,
            selector: '.content',
            reasoning: 'Trying to click content area',
          },
          progressEvaluation: {
            score: 0.1,
            reasoning: 'No progress made, login form not found',
            isComplete: false,
          },
        },
        {
          action: {
            type: 'scroll' as const,
            value: 'down',
            reasoning: 'Scrolling to look for login form',
          },
          progressEvaluation: {
            score: 0.1,
            reasoning: 'Still no login form visible',
            isComplete: false,
          },
        },
        {
          action: {
            type: 'wait' as const,
            waitTime: 2000,
            reasoning: 'Waiting for dynamic content',
          },
          progressEvaluation: {
            score: 0.1,
            reasoning: 'No new content appeared',
            isComplete: false,
          },
        },
      ];

      // Mock browser state capture (same state, no progress)
      agent.captureBrowserState = jest.fn().mockResolvedValue(mockState);

      // Mock LLM decision making
      mockLLM.generateCompletion
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[0]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[1]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(mockLLMResponses[2]),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        });

      // Mock browser action execution
      mockBrowserExecutor.executePlan.mockResolvedValue({
        planId: 'test-plan',
        status: 'success',
        extractedData: { success: true },
        screenshots: [],
        logs: [],
        metrics: { executionTime: 1000, stepsCompleted: 1, stepsTotal: 1, retryCount: 0 },
        createdAt: new Date(),
      });

      // Act
      const result = await agent.executeInteractively(taskInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.escalatedToHuman).toBe(true);
      expect(result.escalationReason).toContain('stagnation');
      expect(result.steps).toHaveLength(3);
      expect(result.steps.every(step => step.progressScore <= 0.1)).toBe(true);
    });
  });

  describe('Plan Generation and Caching', () => {
    it('should generate and cache successful execution plans', async () => {
      // Arrange
      const taskInput: TaskInput = {
        instruction: 'Click the login button',
        url: 'https://example.com',
      };

      const mockBrowserState = {
        screenshot: 'login-page',
        dom: '<html><body><button id="login-btn">Login</button></body></html>',
        url: 'https://example.com',
        timestamp: new Date(),
        viewport: { width: 1920, height: 1080 },
      };

      const mockLLMResponse = {
        action: {
          type: 'click' as const,
          selector: '#login-btn',
          reasoning: 'Found login button, clicking it',
        },
        progressEvaluation: {
          score: 1.0,
          reasoning: 'Login button clicked successfully',
          isComplete: true,
        },
      };

      // Mock browser state capture
      agent.captureBrowserState = jest.fn().mockResolvedValue(mockBrowserState);

      // Mock LLM decision making
      mockLLM.generateCompletion.mockResolvedValue({
        content: JSON.stringify(mockLLMResponse),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      // Mock browser action execution
      mockBrowserExecutor.executePlan.mockResolvedValue({
        planId: 'test-plan',
        status: 'success',
        extractedData: { clicked: true },
        screenshots: [],
        logs: [],
        metrics: { executionTime: 1000, stepsCompleted: 1, stepsTotal: 1, retryCount: 0 },
        createdAt: new Date(),
      });

      // Act
      const result = await agent.executeInteractively(taskInput);

      // Assert
      expect(result.success).toBe(true);
      expect(result.generatedPlan).toBeDefined();
      expect(result.generatedPlan?.steps).toHaveLength(1);
      expect(result.generatedPlan?.steps[0].type).toBe('click');
      expect(result.generatedPlan?.steps[0].selector).toBe('#login-btn');
      expect(result.generatedPlan?.taskSignature).toBeDefined();
      expect(result.generatedPlan?.metadata.confidence).toBe(1.0);
    });

    it('should not cache failed execution attempts', async () => {
      // Arrange
      const taskInput: TaskInput = {
        instruction: 'Click the non-existent button',
        url: 'https://example.com',
      };

      const mockBrowserState = {
        screenshot: 'empty-page',
        dom: '<html><body><p>No buttons here</p></body></html>',
        url: 'https://example.com',
        timestamp: new Date(),
        viewport: { width: 1920, height: 1080 },
      };

      // Mock browser state capture
      agent.captureBrowserState = jest.fn().mockResolvedValue(mockBrowserState);

      // Mock LLM decision making (will fail to find button)
      mockLLM.generateCompletion.mockResolvedValue({
        content: JSON.stringify({
          action: {
            type: 'click' as const,
            selector: '#non-existent',
            reasoning: 'Trying to find a button',
          },
          progressEvaluation: {
            score: 0.0,
            reasoning: 'No button found',
            isComplete: false,
          },
        }),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      // Mock browser action execution (will fail)
      mockBrowserExecutor.executePlan.mockResolvedValue({
        planId: 'test-plan',
        status: 'failed',
        extractedData: {},
        screenshots: [],
        logs: [],
        metrics: { executionTime: 1000, stepsCompleted: 0, stepsTotal: 1, retryCount: 0 },
        error: { message: 'Element not found', step: 'step-1' },
        createdAt: new Date(),
      });

      // Act
      const result = await agent.executeInteractively(taskInput);

      // Assert
      expect(result.success).toBe(false);
      expect(result.generatedPlan).toBeNull();
      expect(result.escalatedToHuman).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should accept configuration options', () => {
      const config = {
        maxSteps: 20,
        progressThreshold: 0.05,
        stagnationLimit: 5,
        enableScreenshots: true,
        enableDOMCapture: true,
      };

      const configuredAgent = new InteractiveBrowserAgent(config);

      expect(configuredAgent.getConfiguration()).toEqual(
        expect.objectContaining(config)
      );
    });

    it('should use default configuration when not provided', () => {
      const defaultAgent = new InteractiveBrowserAgent();

      const config = defaultAgent.getConfiguration();
      expect(config.maxSteps).toBe(10);
      expect(config.progressThreshold).toBe(0.1);
      expect(config.stagnationLimit).toBe(3);
      expect(config.enableScreenshots).toBe(true);
      expect(config.enableDOMCapture).toBe(true);
    });
  });
}); 