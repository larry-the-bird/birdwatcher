import { CacheManager } from '../../cache-manager';
import { ExecutionPlan } from '../../types';

// Mock database dependencies
jest.mock('drizzle-orm/neon-http');
jest.mock('@neondatabase/serverless');
jest.mock('../../../../next/src/db/schema', () => ({
  executionPlans: {
    id: 'id',
    taskSignature: 'taskSignature',
    instruction: 'instruction',
    url: 'url',
    plan: 'plan',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    version: 'version',
    isActive: 'isActive',
  },
  planCache: {
    id: 'id',
    cacheKey: 'cacheKey',
    planId: 'planId',
    hitCount: 'hitCount',
    lastUsed: 'lastUsed',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt',
  },
}));

// Mock the imported modules
const mockDrizzle = jest.fn();
const mockNeon = jest.fn();

jest.doMock('drizzle-orm/neon-http', () => ({
  drizzle: mockDrizzle,
}));

jest.doMock('@neondatabase/serverless', () => ({
  neon: mockNeon,
}));

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockDb: any;

  beforeEach(() => {
    // Reset environment variable
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

    // Create mock database instance
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    };

    // Mock the chain to return empty arrays by default
    mockDb.limit.mockResolvedValue([]);
    mockDb.orderBy.mockResolvedValue([]);

    // Mock the module functions
    mockDrizzle.mockReturnValue(mockDb);
    mockNeon.mockReturnValue(jest.fn());

    // Create cache manager
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should throw error without DATABASE_URL', () => {
      delete process.env.DATABASE_URL;
      
      expect(() => new CacheManager()).toThrow('DATABASE_URL environment variable is required');
      
      // Restore for other tests
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    });
  });

  describe('getCachedPlan', () => {
    it('should return cached plan when found and not expired', async () => {
      const taskSignature = 'test-task-signature';
      const mockCacheEntry = {
        id: 'cache-1',
        cacheKey: 'cache-key-123',
        planId: 'plan-123',
        hitCount: 5,
        lastUsed: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        createdAt: new Date(),
      };

      const mockPlanData = {
        id: 'plan-123',
        taskSignature: taskSignature,
        instruction: 'Test instruction',
        url: 'https://example.com',
        plan: {
          steps: [
            {
              id: 'step-1',
              type: 'navigate',
              description: 'Navigate to page',
              value: 'https://example.com',
            },
          ],
          expectedResults: ['navigation success'],
          errorHandling: {
            retryCount: 3,
            timeoutMs: 30000,
          },
          validation: {
            successCriteria: ['page loaded'],
            failureCriteria: ['404 error'],
          },
          metadata: {
            createdAt: new Date(),
            llmModel: 'gpt-4',
            confidence: 0.9,
            estimatedDuration: 10000,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isActive: true,
      };

      // Mock cache entry lookup
      mockDb.limit.mockResolvedValueOnce([mockCacheEntry]);
      // Mock plan data lookup
      mockDb.limit.mockResolvedValueOnce([mockPlanData]);

      const result = await cacheManager.getCachedPlan(taskSignature);

      expect(result).toBeDefined();
      expect(result!.id).toBe('plan-123');
      expect(result!.taskSignature).toBe(taskSignature);
      expect(result!.instruction).toBe('Test instruction');
      expect(result!.url).toBe('https://example.com');
      expect(result!.steps).toHaveLength(1);
      expect(result!.steps[0].type).toBe('navigate');

      // Verify cache hit was updated
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return null when cache entry is expired', async () => {
      const taskSignature = 'expired-task';

      // Mock expired cache entry (no results returned)
      mockDb.limit.mockResolvedValue([]);

      const result = await cacheManager.getCachedPlan(taskSignature);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const taskSignature = 'error-task';

      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      const result = await cacheManager.getCachedPlan(taskSignature);

      expect(result).toBeNull();
    });
  });

  describe('cachePlan', () => {
    it('should cache a new plan successfully', async () => {
      const plan: ExecutionPlan = {
        id: 'new-plan-123',
        taskSignature: 'new-task-signature',
        instruction: 'New test instruction',
        url: 'https://newexample.com',
        steps: [
          {
            id: 'step-1',
            type: 'navigate',
            description: 'Navigate to new page',
            value: 'https://newexample.com',
          },
        ],
        expectedResults: ['page navigation'],
        errorHandling: {
          retryCount: 3,
          timeoutMs: 30000,
        },
        validation: {
          successCriteria: ['navigation complete'],
          failureCriteria: ['navigation failed'],
        },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.85,
          estimatedDuration: 15000,
        },
      };

      // Mock no existing plan found
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock successful insertions
      mockDb.values.mockResolvedValue([]);

      await cacheManager.cachePlan(plan);

      // Verify plan was inserted
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // Once for plan, once for cache
      expect(mockDb.values).toHaveBeenCalledTimes(2);
    });

    it('should handle cache insertion errors gracefully', async () => {
      const plan: ExecutionPlan = {
        id: 'error-plan',
        taskSignature: 'error-signature',
        instruction: 'Error test',
        url: 'https://error.com',
        steps: [],
        expectedResults: [],
        errorHandling: { retryCount: 3, timeoutMs: 30000 },
        validation: { successCriteria: [], failureCriteria: [] },
        metadata: {
          createdAt: new Date(),
          llmModel: 'gpt-4',
          confidence: 0.8,
          estimatedDuration: 5000,
        },
      };

      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.values.mockRejectedValue(new Error('Database insert failed'));

      // Should not throw, but handle error gracefully
      await expect(cacheManager.cachePlan(plan)).resolves.not.toThrow();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockCacheEntries = [
        { id: '1', hitCount: 10, planId: 'plan-1', lastUsed: new Date(), expiresAt: new Date(Date.now() + 86400000) },
        { id: '2', hitCount: 5, planId: 'plan-2', lastUsed: new Date(), expiresAt: new Date(Date.now() + 86400000) },
        { id: '3', hitCount: 0, planId: 'plan-3', lastUsed: new Date(), expiresAt: new Date(Date.now() + 86400000) },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.orderBy.mockResolvedValue(mockCacheEntries);

      const stats = await cacheManager.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.totalEntries).toBe(3);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.topPlans).toBeDefined();
    });

    it('should handle empty cache', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should handle cache stats errors', async () => {
      mockDb.orderBy.mockRejectedValue(new Error('Stats query failed'));

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache for specific task signature', async () => {
      const taskSignature = 'invalidate-test';
      const mockCacheEntries = [
        { id: 'cache-1', cacheKey: 'key-1' },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockResolvedValue(mockCacheEntries);

      await cacheManager.invalidateCache(taskSignature);

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should handle invalidation when no cache entries exist', async () => {
      const taskSignature = 'no-cache-test';
      
      mockDb.limit.mockResolvedValue([]);

      await cacheManager.invalidateCache(taskSignature);

      // Should not call delete if no entries found
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should handle invalidation errors gracefully', async () => {
      const taskSignature = 'error-invalidate';
      
      mockDb.limit.mockRejectedValue(new Error('Invalidation failed'));

      await expect(cacheManager.invalidateCache(taskSignature)).resolves.not.toThrow();
    });
  });
});