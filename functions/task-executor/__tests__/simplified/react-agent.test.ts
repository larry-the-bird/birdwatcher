import { ReactAgent } from '../../src/core/react-agent';
import { BrowserExecutor } from '../../src/utils/browser-executor';
import { BaseLLM } from '../../llm/base-llm';

describe('ReactAgent', () => {
  let mockBrowser: jest.Mocked<BrowserExecutor>;
  let mockLLM: jest.Mocked<BaseLLM>;
  let agent: ReactAgent;

  beforeEach(() => {
    mockBrowser = {
      navigate: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      extract: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
    } as any;

    mockLLM = {
      generateCompletion: jest.fn(),
      generateStructuredOutput: jest.fn(),
    } as any;

    agent = new ReactAgent(mockBrowser, mockLLM);
  });

  describe('explorePath', () => {
    it('should explore and find a working path for a simple task', async () => {
      const task = {
        id: 'test-1',
        url: 'https://example.com',
        instruction: 'Click the login button and extract the welcome message'
      };

      // Mock LLM responses for ReAct steps
      mockLLM.generateStructuredOutput
        .mockResolvedValueOnce({
          thought: 'I need to navigate to the page first',
          action: { type: 'navigate', url: 'https://example.com' },
          expectation: 'Page should load successfully'
        })
        .mockResolvedValueOnce({
          thought: 'Now I need to click the login button',
          action: { type: 'click', selector: 'button.login' },
          expectation: 'Login form or welcome page should appear'
        })
        .mockResolvedValueOnce({
          thought: 'I can see the welcome message, let me extract it',
          action: { type: 'extract', selector: '.welcome-message' },
          expectation: 'Should extract the welcome text'
        })
        .mockResolvedValueOnce({
          thought: 'Task completed successfully',
          action: { type: 'complete' },
          expectation: 'All data extracted'
        });

      // Mock browser responses
      mockBrowser.navigate.mockResolvedValueOnce(undefined);
      mockBrowser.click.mockResolvedValueOnce(undefined);
      mockBrowser.extract.mockResolvedValueOnce({ text: 'Welcome, User!' });
      mockBrowser.evaluate.mockResolvedValue('<html><body>Current page state</body></html>');
      mockBrowser.screenshot.mockResolvedValue('base64-screenshot');

      const result = await agent.explorePath(task);

      expect(result.success).toBe(true);
      expect(result.path).toHaveLength(3);
      expect(result.path[0]).toEqual({
        action: 'navigate',
        url: 'https://example.com'
      });
      expect(result.path[1]).toEqual({
        action: 'click',
        selector: 'button.login'
      });
      expect(result.path[2]).toEqual({
        action: 'extract',
        selector: '.welcome-message'
      });
      expect(result.extractedData).toEqual({ text: 'Welcome, User!' });
    });

    it('should handle exploration failures and retry with different approach', async () => {
      const task = {
        id: 'test-2',
        url: 'https://example.com',
        instruction: 'Find and click submit button'
      };

      // First attempt fails
      mockLLM.generateStructuredOutput
        .mockResolvedValueOnce({
          thought: 'Looking for submit button',
          action: { type: 'click', selector: 'button[type="submit"]' },
          expectation: 'Form should submit'
        });

      mockBrowser.click.mockRejectedValueOnce(new Error('Element not found'));

      // Second attempt with different selector
      mockLLM.generateStructuredOutput
        .mockResolvedValueOnce({
          thought: 'Previous selector failed, trying alternative',
          action: { type: 'click', selector: '.submit-btn' },
          expectation: 'Form should submit'
        })
        .mockResolvedValueOnce({
          thought: 'Successfully clicked submit',
          action: { type: 'complete' },
          expectation: 'Task done'
        });

      mockBrowser.click.mockResolvedValueOnce(undefined);
      mockBrowser.evaluate.mockResolvedValue('<html><body>Page</body></html>');
      mockBrowser.screenshot.mockResolvedValue('base64-screenshot');

      const result = await agent.explorePath(task);

      expect(result.success).toBe(true);
      expect(result.path).toHaveLength(1);
      expect(result.path[0]).toEqual({
        action: 'click',
        selector: '.submit-btn'
      });
    });

    it('should fail after maximum retries', async () => {
      const task = {
        id: 'test-3',
        url: 'https://example.com',
        instruction: 'Find non-existent element'
      };

      // Mock all attempts to fail
      mockLLM.generateStructuredOutput.mockResolvedValue({
        thought: 'Trying to find element',
        action: { type: 'click', selector: '.not-found' },
        expectation: 'Should click'
      });

      mockBrowser.click.mockRejectedValue(new Error('Element not found'));
      mockBrowser.evaluate.mockResolvedValue('<html><body>Empty</body></html>');
      mockBrowser.screenshot.mockResolvedValue('base64-screenshot');

      const result = await agent.explorePath(task, { maxSteps: 3 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.path).toHaveLength(0);
    });
  });
});