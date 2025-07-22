import { PathStorage } from '../../src/storage/path-storage';
import { ExecutionPath } from '../../types';

describe('PathStorage', () => {
  let storage: PathStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = `./test-storage-${Date.now()}-${Math.random()}`;
    storage = new PathStorage(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      const { rm } = await import('fs/promises');
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('savePath', () => {
    it('should save a successful execution path', async () => {
      const path: ExecutionPath = {
        taskId: 'test-task-1',
        steps: [
          { action: 'navigate', url: 'https://example.com' },
          { action: 'click', selector: 'button.login' },
          { action: 'extract', selector: '.data' }
        ],
        lastSuccessful: new Date()
      };

      await storage.savePath(path);

      const retrieved = await storage.getPath('test-task-1');
      expect(retrieved).toEqual(path);
    });

    it('should overwrite existing path for same task', async () => {
      const oldPath: ExecutionPath = {
        taskId: 'test-task-1',
        steps: [{ action: 'navigate', url: 'https://old.com' }],
        lastSuccessful: new Date('2024-01-01')
      };

      const newPath: ExecutionPath = {
        taskId: 'test-task-1',
        steps: [{ action: 'navigate', url: 'https://new.com' }],
        lastSuccessful: new Date()
      };

      await storage.savePath(oldPath);
      await storage.savePath(newPath);

      const retrieved = await storage.getPath('test-task-1');
      expect(retrieved?.steps[0].url).toBe('https://new.com');
    });
  });

  describe('getPath', () => {
    it('should return null for non-existent task', async () => {
      const path = await storage.getPath('non-existent');
      expect(path).toBeNull();
    });

    it('should retrieve saved path by task ID', async () => {
      const path: ExecutionPath = {
        taskId: 'test-task-2',
        steps: [
          { action: 'type', selector: 'input.search', value: 'test query' }
        ],
        lastSuccessful: new Date()
      };

      await storage.savePath(path);
      const retrieved = await storage.getPath('test-task-2');

      expect(retrieved).toBeDefined();
      expect(retrieved?.taskId).toBe('test-task-2');
      expect(retrieved?.steps).toHaveLength(1);
      expect(retrieved?.steps[0].value).toBe('test query');
    });
  });

  describe('deletePath', () => {
    it('should delete existing path', async () => {
      const path: ExecutionPath = {
        taskId: 'test-task-3',
        steps: [{ action: 'click', selector: '.button' }],
        lastSuccessful: new Date()
      };

      await storage.savePath(path);
      expect(await storage.getPath('test-task-3')).toBeDefined();

      await storage.deletePath('test-task-3');
      expect(await storage.getPath('test-task-3')).toBeNull();
    });

    it('should handle deletion of non-existent path gracefully', async () => {
      await expect(storage.deletePath('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getAllPaths', () => {
    it('should return all stored paths', async () => {
      const path1: ExecutionPath = {
        taskId: 'task-1',
        steps: [{ action: 'navigate', url: 'https://site1.com' }],
        lastSuccessful: new Date()
      };

      const path2: ExecutionPath = {
        taskId: 'task-2',
        steps: [{ action: 'navigate', url: 'https://site2.com' }],
        lastSuccessful: new Date()
      };

      await storage.savePath(path1);
      await storage.savePath(path2);

      const allPaths = await storage.getAllPaths();
      expect(allPaths).toHaveLength(2);
      expect(allPaths.map(p => p.taskId).sort()).toEqual(['task-1', 'task-2']);
    });

    it('should return empty array when no paths stored', async () => {
      const allPaths = await storage.getAllPaths();
      expect(allPaths).toEqual([]);
    });
  });
});