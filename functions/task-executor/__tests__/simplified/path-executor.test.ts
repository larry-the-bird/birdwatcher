import { PathExecutor } from '../../src/core/path-executor';
import { BrowserExecutor } from '../../src/utils/browser-executor';
import { ExecutionPath, Step } from '../../types';

describe('PathExecutor', () => {
  let mockBrowser: jest.Mocked<BrowserExecutor>;
  let executor: PathExecutor;

  beforeEach(() => {
    mockBrowser = {
      navigate: jest.fn(),
      click: jest.fn(),
      type: jest.fn(),
      extract: jest.fn(),
      waitForSelector: jest.fn(),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
    } as any;

    executor = new PathExecutor(mockBrowser);
  });

  describe('executePath', () => {
    it('should execute a simple path successfully', async () => {
      const path: ExecutionPath = {
        taskId: 'test-1',
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'click', selector: 'button.submit' },
          { action: 'extract', selector: '.result' }
        ],
        lastSuccessful: new Date()
      };

      mockBrowser.navigate.mockResolvedValueOnce(undefined);
      mockBrowser.click.mockResolvedValueOnce(undefined);
      mockBrowser.extract.mockResolvedValueOnce({ data: 'Success!' });

      const result = await executor.executePath(path);

      expect(result.success).toBe(true);
      expect(result.extractedData).toEqual({ data: 'Success!' });
      expect(mockBrowser.navigate).toHaveBeenCalledWith('https://example.com');
      expect(mockBrowser.click).toHaveBeenCalledWith('button.submit');
      expect(mockBrowser.extract).toHaveBeenCalledWith('.result');
    });

    it('should handle type actions correctly', async () => {
      const path: ExecutionPath = {
        taskId: 'test-2',
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'type', selector: 'input.search', value: 'test query' },
          { action: 'click', selector: 'button.search' }
        ],
        lastSuccessful: new Date()
      };

      mockBrowser.navigate.mockResolvedValueOnce(undefined);
      mockBrowser.type.mockResolvedValueOnce(undefined);
      mockBrowser.click.mockResolvedValueOnce(undefined);

      const result = await executor.executePath(path);

      expect(result.success).toBe(true);
      expect(mockBrowser.type).toHaveBeenCalledWith('input.search', 'test query');
    });

    it('should fail when a step throws an error', async () => {
      const path: ExecutionPath = {
        taskId: 'test-3',
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'click', selector: '.non-existent' }
        ],
        lastSuccessful: new Date()
      };

      mockBrowser.navigate.mockResolvedValueOnce(undefined);
      mockBrowser.click.mockRejectedValueOnce(new Error('Element not found'));

      const result = await executor.executePath(path);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Element not found');
      expect(result.failedAtStep).toBe(1);
    });

    it('should collect all extracted data from multiple extract steps', async () => {
      const path: ExecutionPath = {
        taskId: 'test-4',
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'extract', selector: '.title' },
          { action: 'extract', selector: '.price' },
          { action: 'extract', selector: '.description' }
        ],
        lastSuccessful: new Date()
      };

      mockBrowser.navigate.mockResolvedValueOnce(undefined);
      mockBrowser.extract
        .mockResolvedValueOnce({ title: 'Product Name' })
        .mockResolvedValueOnce({ price: '$99.99' })
        .mockResolvedValueOnce({ description: 'Great product' });

      const result = await executor.executePath(path);

      expect(result.success).toBe(true);
      expect(result.extractedData).toEqual({
        title: 'Product Name',
        price: '$99.99',
        description: 'Great product'
      });
    });

    it('should wait for selectors when waitBeforeAction is specified', async () => {
      const path: ExecutionPath = {
        taskId: 'test-5',
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'click', selector: '.dynamic-button', waitBeforeAction: true }
        ],
        lastSuccessful: new Date()
      };

      mockBrowser.navigate.mockResolvedValueOnce(undefined);
      mockBrowser.waitForSelector.mockResolvedValueOnce(undefined);
      mockBrowser.click.mockResolvedValueOnce(undefined);

      const result = await executor.executePath(path);

      expect(result.success).toBe(true);
      expect(mockBrowser.waitForSelector).toHaveBeenCalledWith('.dynamic-button', { timeout: 30000 });
      expect(mockBrowser.click).toHaveBeenCalledWith('.dynamic-button');
    });

    it('should return empty path execution for empty steps', async () => {
      const path: ExecutionPath = {
        taskId: 'test-6',
        steps: [],
        lastSuccessful: new Date()
      };

      const result = await executor.executePath(path);

      expect(result.success).toBe(true);
      expect(result.extractedData).toEqual({});
    });
  });
});