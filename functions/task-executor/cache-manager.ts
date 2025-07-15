import { createHash } from 'crypto';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, lt, desc, sql, gt } from 'drizzle-orm';
import { executionPlans, planCache } from '../../next/src/db/schema';
import { ExecutionPlan, CacheEntry } from './types';
import { LocalMemoryCache } from './local-memory-cache';

export class CacheManager {
  private db: ReturnType<typeof drizzle> | null = null;
  private defaultTTL: number = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private useLocalCache: boolean = false;

  constructor() {
    try {
      if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
        const sql_client = neon(process.env.DATABASE_URL);
        this.db = drizzle(sql_client);
        console.log('📝 [CacheManager] Connected to database');
      } else {
        console.log('📝 [CacheManager] No DATABASE_URL found, using local memory cache');
        this.useLocalCache = true;
      }
    } catch (error) {
      console.log('📝 [CacheManager] Database connection failed, falling back to local memory cache');
      this.useLocalCache = true;
    }
  }

  /**
   * Retrieve cached execution plan by task signature
   */
  async getCachedPlan(taskSignature: string): Promise<ExecutionPlan | null> {
    if (this.useLocalCache) {
      return LocalMemoryCache.get(taskSignature);
    }

    try {
      const cacheKey = this.generateCacheKey(taskSignature);
      
      const cachedEntry = await this.db!
        .select()
        .from(planCache)
        .innerJoin(executionPlans, eq(planCache.planId, executionPlans.id))
        .where(and(
          eq(planCache.cacheKey, cacheKey),
          gt(planCache.expiresAt, new Date())
        ))
        .limit(1);

      if (cachedEntry.length === 0) {
        return null;
      }

      // Update hit count and last used timestamp
      await this.db!
        .update(planCache)
        .set({
          hitCount: sql`${planCache.hitCount} + 1`,
          lastUsed: new Date()
        })
        .where(eq(planCache.cacheKey, cacheKey));

      return cachedEntry[0].execution_plans.plan as ExecutionPlan;
    } catch (error) {
      console.error('Error retrieving cached plan:', error);
      return null;
    }
  }

  /**
   * Retrieve cached execution plan by plan ID
   */
  async getCachedPlanById(planId: string): Promise<ExecutionPlan | null> {
    if (this.useLocalCache) {
      // For local cache, we need to search through all cached plans
      return LocalMemoryCache.getById(planId);
    }

    try {
      const cachedEntry = await this.db!
        .select()
        .from(executionPlans)
        .leftJoin(planCache, eq(planCache.planId, executionPlans.id))
        .where(and(
          eq(executionPlans.id, planId),
          eq(executionPlans.isActive, true)
        ))
        .limit(1);

      if (cachedEntry.length === 0) {
        return null;
      }

      // Update hit count if cache entry exists
      if (cachedEntry[0].plan_cache) {
        await this.db!
          .update(planCache)
          .set({
            hitCount: sql`${planCache.hitCount} + 1`,
            lastUsed: new Date()
          })
          .where(eq(planCache.planId, planId));
      }

      return cachedEntry[0].execution_plans.plan as ExecutionPlan;
    } catch (error) {
      console.error('Error retrieving cached plan by ID:', error);
      return null;
    }
  }

  /**
   * Cache a new execution plan
   */
  async cachePlan(plan: ExecutionPlan, ttl?: number): Promise<string> {
    if (this.useLocalCache) {
      LocalMemoryCache.set(plan.taskSignature, plan);
      return plan.id;
    }

    try {
      const cacheKey = this.generateCacheKey(plan.taskSignature);
      const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL));

      // First, store the plan in execution_plans table
      await this.db!
        .insert(executionPlans)
        .values({
          id: plan.id,
          taskSignature: plan.taskSignature,
          instruction: plan.instruction,
          url: plan.url,
          plan: plan as any, // Store the entire plan as JSON
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isActive: true
        })
        .onConflictDoUpdate({
          target: executionPlans.taskSignature,
          set: {
            plan: plan as any,
            updatedAt: new Date(),
            version: sql`${executionPlans.version} + 1`
          }
        });

      // Get the actual plan ID after upsert (in case of conflict, we need the existing ID)
      const actualPlan = await this.db!
        .select({ id: executionPlans.id })
        .from(executionPlans)
        .where(eq(executionPlans.taskSignature, plan.taskSignature))
        .limit(1);

      const actualPlanId = actualPlan[0]?.id;
      if (!actualPlanId) {
        throw new Error('Failed to retrieve plan ID after upsert');
      }

      // Then create or update the cache entry
      await this.db!
        .insert(planCache)
        .values({
          cacheKey,
          planId: actualPlanId,
          hitCount: 0,
          lastUsed: new Date(),
          expiresAt,
          createdAt: new Date()
        })
        .onConflictDoUpdate({
          target: planCache.cacheKey,
          set: {
            planId: actualPlanId,
            expiresAt,
            lastUsed: new Date()
          }
        });

      console.log(`Plan cached successfully: ${actualPlanId}`);
      return actualPlanId;
    } catch (error) {
      console.error('Error caching plan:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidateCache(taskSignature: string): Promise<void> {
    if (this.useLocalCache) {
      LocalMemoryCache.delete(taskSignature);
      return;
    }

    try {
      const cacheKey = this.generateCacheKey(taskSignature);
      
      await this.db!
        .delete(planCache)
        .where(eq(planCache.cacheKey, cacheKey));
      
      console.log(`Cache invalidated for task signature: ${taskSignature}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      throw error;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache(): Promise<number> {
    if (this.useLocalCache) {
      return LocalMemoryCache.cleanupExpired();
    }

    try {
      const expiredEntries = await this.db!
        .select()
        .from(planCache)
        .where(lt(planCache.expiresAt, new Date()));

      if (expiredEntries.length === 0) {
        return 0;
      }

      // Delete expired cache entries
      await this.db!
        .delete(planCache)
        .where(lt(planCache.expiresAt, new Date()));

      console.log(`Cleaned up ${expiredEntries.length} expired cache entries`);
      return expiredEntries.length;
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    hitRate: number;
    topPlans: Array<{ planId: string; hitCount: number; lastUsed: Date }>;
  }> {
    if (this.useLocalCache) {
      return LocalMemoryCache.getStats();
    }

    try {
      const [totalResult, expiredResult, topPlansResult] = await Promise.all([
        this.db!
          .select({ count: sql<number>`count(*)` })
          .from(planCache),
        this.db!
          .select({ count: sql<number>`count(*)` })
          .from(planCache)
          .where(lt(planCache.expiresAt, new Date())),
        this.db!
          .select({
            planId: planCache.planId,
            hitCount: planCache.hitCount,
            lastUsed: planCache.lastUsed
          })
          .from(planCache)
          .orderBy(desc(planCache.hitCount))
          .limit(10)
      ]);

      const totalEntries = totalResult[0]?.count || 0;
      const expiredEntries = expiredResult[0]?.count || 0;
      const totalHits = topPlansResult.reduce((sum, plan) => sum + plan.hitCount, 0);
      const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;

      return {
        totalEntries,
        expiredEntries,
        hitRate,
        topPlans: topPlansResult
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        expiredEntries: 0,
        hitRate: 0,
        topPlans: []
      };
    }
  }

  /**
   * Check if a plan should be regenerated based on failure rate
   */
  async shouldRegeneratePlan(planId: string, failureThreshold: number = 0.7): Promise<boolean> {
    if (this.useLocalCache) {
      return false; // Local memory cache doesn't track failure rates
    }

    try {
      // This would require tracking execution results
      // For now, we'll implement a simple time-based approach
      const plan = await this.db!
        .select()
        .from(executionPlans)
        .where(eq(executionPlans.id, planId))
        .limit(1);

      if (plan.length === 0) {
        return true; // Plan doesn't exist, should regenerate
      }

      const planAge = Date.now() - plan[0].createdAt.getTime();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      return planAge > maxAge;
    } catch (error) {
      console.error('Error checking plan regeneration:', error);
      return false;
    }
  }

  /**
   * Generate cache key from task signature
   */
  private generateCacheKey(taskSignature: string): string {
    return createHash('sha256')
      .update(`cache_${taskSignature}`)
      .digest('hex');
  }

  /**
   * Get cache key for debugging
   */
  getCacheKeyForTask(instruction: string, url: string): string {
    const urlDomain = new URL(url).hostname;
    const combined = `${instruction.toLowerCase().trim()}_${urlDomain}`;
    const taskSignature = createHash('md5').update(combined).digest('hex');
    return this.generateCacheKey(taskSignature);
  }

  /**
   * Force refresh cache entry
   */
  async refreshCache(taskSignature: string, newPlan: ExecutionPlan): Promise<string> {
    if (this.useLocalCache) {
      LocalMemoryCache.set(taskSignature, newPlan);
      return newPlan.id;
    }

    try {
      // Invalidate old cache
      await this.invalidateCache(taskSignature);
      
      // Cache new plan
      const actualPlanId = await this.cachePlan(newPlan);
      
      console.log(`Cache refreshed for task signature: ${taskSignature}`);
      return actualPlanId;
    } catch (error) {
      console.error('Error refreshing cache:', error);
      throw error;
    }
  }

  /**
   * Bulk cleanup operations
   */
  async performMaintenance(): Promise<{
    expiredCleaned: number;
    orphanedPlans: number;
    totalCacheSize: number;
  }> {
    if (this.useLocalCache) {
      return LocalMemoryCache.performMaintenance();
    }

    try {
      // Clean expired cache entries
      const expiredCleaned = await this.cleanupExpiredCache();

      // Get current cache size
      const cacheStats = await this.getCacheStats();

      return {
        expiredCleaned,
        orphanedPlans: 0, // TODO: Implement orphaned plan cleanup when needed
        totalCacheSize: cacheStats.totalEntries
      };
    } catch (error) {
      console.error('Error performing maintenance:', error);
      return {
        expiredCleaned: 0,
        orphanedPlans: 0,
        totalCacheSize: 0
      };
    }
  }
} 