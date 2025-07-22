import { z } from 'zod';

// LiteLLM pricing data structure (flexible to handle strings/numbers)
const ModelPricingSchema = z.object({
  input_cost_per_token: z.union([z.number(), z.string().transform(Number)]).optional(),
  output_cost_per_token: z.union([z.number(), z.string().transform(Number)]).optional(),
  cache_creation_input_token_cost: z.union([z.number(), z.string().transform(Number)]).optional(),
  cache_read_input_token_cost: z.union([z.number(), z.string().transform(Number)]).optional(),
  max_tokens: z.union([z.number(), z.string().transform(Number)]).optional(),
  max_input_tokens: z.union([z.number(), z.string().transform(Number)]).optional(),
  max_output_tokens: z.union([z.number(), z.string().transform(Number)]).optional(),
  input_cost_per_pixel: z.union([z.number(), z.string().transform(Number)]).optional(),
  litellm_provider: z.string().optional(),
  mode: z.string().optional(),
  supports_function_calling: z.boolean().optional(),
  supports_parallel_function_calling: z.boolean().optional(),
  supports_vision: z.boolean().optional(),
}).passthrough(); // Allow additional unknown fields

const PricingDataSchema = z.record(z.string(), ModelPricingSchema);

export type ModelPricing = z.infer<typeof ModelPricingSchema>;
export type PricingData = z.infer<typeof PricingDataSchema>;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheCreationCost: number;
  cacheReadCost: number;
  totalCost: number;
  currency: string;
  modelName: string;
}

export class LLMPricingService {
  private static readonly LITELLM_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  
  private cache: {
    data: PricingData | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0
  };

  private fallbackData: PricingData | null = null;

  constructor() {
    this.initializeFallbackData();
  }

  /**
   * Initialize with basic fallback pricing for common models
   */
  private initializeFallbackData(): void {
    this.fallbackData = {
      // OpenAI GPT-4o models
      'gpt-4o': {
        input_cost_per_token: 0.0000025,
        output_cost_per_token: 0.00001,
        max_tokens: 4096,
        max_input_tokens: 128000,
      },
      'gpt-4o-mini': {
        input_cost_per_token: 0.00000015,
        output_cost_per_token: 0.0000006,
        max_tokens: 16384,
        max_input_tokens: 128000,
      },
      'gpt-4-turbo': {
        input_cost_per_token: 0.00001,
        output_cost_per_token: 0.00003,
        max_tokens: 4096,
        max_input_tokens: 128000,
      },
      // Anthropic Claude models
      'claude-3-5-sonnet-20241022': {
        input_cost_per_token: 0.000003,
        output_cost_per_token: 0.000015,
        max_tokens: 8192,
        max_input_tokens: 200000,
        cache_creation_input_token_cost: 0.00000375,
        cache_read_input_token_cost: 0.0000003,
      },
      'claude-3-5-haiku-20241022': {
        input_cost_per_token: 0.000001,
        output_cost_per_token: 0.000005,
        max_tokens: 8192,
        max_input_tokens: 200000,
        cache_creation_input_token_cost: 0.00000125,
        cache_read_input_token_cost: 0.0000001,
      },
      'claude-3-opus-20240229': {
        input_cost_per_token: 0.000015,
        output_cost_per_token: 0.000075,
        max_tokens: 4096,
        max_input_tokens: 200000,
        cache_creation_input_token_cost: 0.00001875,
        cache_read_input_token_cost: 0.0000015,
      },
    };
  }

  /**
   * Fetch pricing data from LiteLLM with caching and fallback
   */
  async fetchPricingData(): Promise<PricingData> {
    // Check if cached data is still valid
    const now = Date.now();
    if (this.cache.data && (now - this.cache.timestamp) < LLMPricingService.CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      console.log('🔄 Fetching latest LLM pricing data from LiteLLM...');
      
      const response = await fetch(LLMPricingService.LITELLM_PRICING_URL, {
        headers: {
          'User-Agent': 'BirdWatcher-TaskExecutor/1.0',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 seconds
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      const pricingData = PricingDataSchema.parse(rawData);

      // Update cache
      this.cache = {
        data: pricingData,
        timestamp: now
      };

      console.log(`✅ Successfully fetched pricing for ${Object.keys(pricingData).length} models`);
      return pricingData;

    } catch (error) {
      console.warn('⚠️ Failed to fetch LiteLLM pricing data, using fallback:', error);
      
      // Return cached data if available, otherwise fallback
      if (this.cache.data) {
        console.log('📦 Using cached pricing data');
        return this.cache.data;
      }
      
      if (this.fallbackData) {
        console.log('📋 Using fallback pricing data');
        return this.fallbackData;
      }

      throw new Error('No pricing data available (fetch failed, no cache, no fallback)');
    }
  }

  /**
   * Get pricing for a specific model with smart matching
   */
  async getModelPricing(modelName: string): Promise<ModelPricing | null> {
    const pricingData = await this.fetchPricingData();
    
    // Try exact match first
    if (pricingData[modelName]) {
      return pricingData[modelName];
    }

    // Try with common provider prefixes
    const prefixVariations = [
      `openai/${modelName}`,
      `anthropic/${modelName}`,
      `claude/${modelName}`,
      `gpt/${modelName}`,
    ];

    for (const variation of prefixVariations) {
      if (pricingData[variation]) {
        return pricingData[variation];
      }
    }

    // Try partial matching (substring)
    const partialMatches = Object.keys(pricingData).filter(key => 
      key.toLowerCase().includes(modelName.toLowerCase()) ||
      modelName.toLowerCase().includes(key.toLowerCase())
    );

    if (partialMatches.length > 0) {
      console.log(`📝 Found partial match for '${modelName}': ${partialMatches[0]}`);
      return pricingData[partialMatches[0]];
    }

    console.warn(`⚠️ No pricing found for model: ${modelName}`);
    return null;
  }

  /**
   * Calculate cost for token usage
   */
  async calculateCost(modelName: string, usage: TokenUsage): Promise<CostBreakdown> {
    const pricing = await this.getModelPricing(modelName);
    
    if (!pricing) {
      return {
        inputCost: 0,
        outputCost: 0,
        cacheCreationCost: 0,
        cacheReadCost: 0,
        totalCost: 0,
        currency: 'USD',
        modelName,
      };
    }

    const inputCost = usage.inputTokens * (pricing.input_cost_per_token || 0);
    const outputCost = usage.outputTokens * (pricing.output_cost_per_token || 0);
    const cacheCreationCost = (usage.cacheCreationTokens || 0) * (pricing.cache_creation_input_token_cost || 0);
    const cacheReadCost = (usage.cacheReadTokens || 0) * (pricing.cache_read_input_token_cost || 0);

    const totalCost = inputCost + outputCost + cacheCreationCost + cacheReadCost;

    return {
      inputCost,
      outputCost,
      cacheCreationCost,
      cacheReadCost,
      totalCost,
      currency: 'USD',
      modelName,
    };
  }

  /**
   * Format cost breakdown for display
   */
  formatCostBreakdown(cost: CostBreakdown): string {
    const parts = [
      `Input: $${cost.inputCost.toFixed(6)}`,
      `Output: $${cost.outputCost.toFixed(6)}`,
    ];

    if (cost.cacheCreationCost > 0) {
      parts.push(`Cache Creation: $${cost.cacheCreationCost.toFixed(6)}`);
    }

    if (cost.cacheReadCost > 0) {
      parts.push(`Cache Read: $${cost.cacheReadCost.toFixed(6)}`);
    }

    return `${cost.modelName}: ${parts.join(', ')} | Total: $${cost.totalCost.toFixed(6)}`;
  }

  /**
   * Get available models (useful for debugging)
   */
  async getAvailableModels(): Promise<string[]> {
    const pricingData = await this.fetchPricingData();
    return Object.keys(pricingData).sort();
  }

  /**
   * Pre-fetch and cache pricing data (for build-time optimization)
   */
  async prewarmCache(): Promise<void> {
    try {
      await this.fetchPricingData();
      console.log('✅ LLM pricing cache prewarmed');
    } catch (error) {
      console.warn('⚠️ Failed to prewarm LLM pricing cache:', error);
    }
  }
}