import { ExecutionPlan } from './types';

/**
 * Simple in-memory cache for local testing
 * This simulates the database caching without needing a real database
 */
export class LocalMemoryCache {
  private static cache = new Map<string, ExecutionPlan>();
  
  static set(key: string, plan: ExecutionPlan): void {
    console.log('💾 [LocalCache] Storing plan:', key);
    this.cache.set(key, plan);
  }
  
  static get(key: string): ExecutionPlan | null {
    const plan = this.cache.get(key);
    if (plan) {
      console.log('📋 [LocalCache] Found cached plan:', key);
      return plan;
    }
    console.log('❌ [LocalCache] No cached plan found:', key);
    return null;
  }
  
  static getById(planId: string): ExecutionPlan | null {
    // Search through all cached plans to find one with matching ID
    for (const [key, plan] of this.cache) {
      if (plan.id === planId) {
        console.log('📋 [LocalCache] Found cached plan by ID:', planId);
        return plan;
      }
    }
    console.log('❌ [LocalCache] No cached plan found with ID:', planId);
    return null;
  }
  
  static delete(key: string): void {
    console.log('🗑️ [LocalCache] Deleting plan:', key);
    this.cache.delete(key);
  }
  
  static clear(): void {
    console.log('🧹 [LocalCache] Clearing all cached plans');
    this.cache.clear();
  }
  
  static size(): number {
    return this.cache.size;
  }
  
  static keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  static cleanupExpired(): number {
    // For local memory cache, we don't track expiration
    // In a real implementation, we would store expiration times
    console.log('🧹 [LocalCache] Cleanup expired (no-op for memory cache)');
    return 0;
  }
  
  static getStats(): {
    totalEntries: number;
    expiredEntries: number;
    hitRate: number;
    topPlans: Array<{ planId: string; hitCount: number; lastUsed: Date }>;
  } {
    console.log('📊 [LocalCache] Getting stats');
    return {
      totalEntries: this.cache.size,
      expiredEntries: 0,
      hitRate: 0.85, // Mock hit rate for local cache
      topPlans: []
    };
  }
  
  static performMaintenance(): {
    expiredCleaned: number;
    orphanedPlans: number;
    totalCacheSize: number;
  } {
    console.log('🔧 [LocalCache] Performing maintenance');
    return {
      expiredCleaned: 0,
      orphanedPlans: 0,
      totalCacheSize: this.cache.size
    };
  }
} 