import { BaseLLM, LLMConfig } from './base-llm';
import { OpenAILLM, OpenAIConfig } from './openai-llm';
import { AnthropicLLM, AnthropicConfig } from './anthropic-llm';

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic';

/**
 * LLM Factory configuration
 */
export interface LLMFactoryConfig {
  provider: LLMProvider;
  config: LLMConfig;
  fallbackProvider?: LLMProvider;
  fallbackConfig?: LLMConfig;
}

/**
 * Factory for creating LLM instances
 */
export class LLMFactory {
  private static instance: LLMFactory;
  private providers: Map<LLMProvider, BaseLLM> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): LLMFactory {
    if (!LLMFactory.instance) {
      LLMFactory.instance = new LLMFactory();
    }
    return LLMFactory.instance;
  }

  /**
   * Create LLM instance from config
   */
  createLLM(config: LLMFactoryConfig): BaseLLM {
    const cacheKey = `${config.provider}-${config.config.model}`;
    
    if (this.providers.has(config.provider)) {
      return this.providers.get(config.provider)!;
    }

    const llm = this.createLLMInstance(config.provider, config.config);
    this.providers.set(config.provider, llm);
    
    return llm;
  }

  /**
   * Create LLM with fallback support
   */
  createLLMWithFallback(config: LLMFactoryConfig): {
    primary: BaseLLM;
    fallback?: BaseLLM;
  } {
    const primary = this.createLLM(config);
    
    let fallback: BaseLLM | undefined;
    if (config.fallbackProvider && config.fallbackConfig) {
      fallback = this.createLLMInstance(config.fallbackProvider, config.fallbackConfig);
    }

    return { primary, fallback };
  }

  /**
   * Create LLM instance based on provider
   */
  private createLLMInstance(provider: LLMProvider, config: LLMConfig): BaseLLM {
    switch (provider) {
      case 'openai':
        return new OpenAILLM(config as OpenAIConfig);
      
      case 'anthropic':
        return new AnthropicLLM(config as AnthropicConfig);
      
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Get LLM from environment variables
   */
  createLLMFromEnv(): BaseLLM {
    const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase() as LLMProvider;
    
    const config = this.getConfigFromEnv(provider);
    
    return this.createLLMInstance(provider, config);
  }

  /**
   * Get configuration from environment variables
   */
  private getConfigFromEnv(provider: LLMProvider): LLMConfig {
    const baseConfig = {
      temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
      maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS) : undefined,
      timeout: process.env.LLM_TIMEOUT ? parseInt(process.env.LLM_TIMEOUT) : undefined,
      baseURL: process.env.LLM_BASE_URL
    };

    switch (provider) {
      case 'openai':
        return {
          ...baseConfig,
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          organization: process.env.OPENAI_ORGANIZATION
        } as OpenAIConfig;
      
      case 'anthropic':
        return {
          ...baseConfig,
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
        } as AnthropicConfig;
      
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Test all configured providers
   */
  async testAllProviders(): Promise<Record<LLMProvider, boolean>> {
    const results: Record<LLMProvider, boolean> = {} as any;
    
    const providers: LLMProvider[] = ['openai', 'anthropic'];
    
    for (const provider of providers) {
      try {
        const config = this.getConfigFromEnv(provider);
        const llm = this.createLLMInstance(provider, config);
        results[provider] = await llm.testConnection();
      } catch (error) {
        console.error(`Failed to test ${provider}:`, error);
        results[provider] = false;
      }
    }
    
    return results;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): LLMProvider[] {
    return ['openai', 'anthropic'];
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(provider: LLMProvider): {
    supportsJsonMode: boolean;
    supportsStreaming: boolean;
    supportsVision: boolean;
    maxTokens: number;
    contextLength: number;
  } {
    // Create a temporary instance to get capabilities
    const config = this.getConfigFromEnv(provider);
    const llm = this.createLLMInstance(provider, config);
    const info = llm.getProviderInfo();
    
    return {
      supportsJsonMode: info.supportsJsonMode,
      supportsStreaming: info.supportsStreaming,
      supportsVision: false, // This would need to be implemented per provider
      maxTokens: info.maxTokens,
      contextLength: 8000 // Default, should be per-model
    };
  }

  /**
   * Clear cached providers
   */
  clearCache(): void {
    this.providers.clear();
  }

  /**
   * Get best provider for task
   */
  getBestProviderForTask(task: {
    requiresJsonMode?: boolean;
    requiresStreaming?: boolean;
    requiresVision?: boolean;
    maxBudget?: number;
    preferredProvider?: LLMProvider;
  }): LLMProvider {
    // If preferred provider is specified and meets requirements, use it
    if (task.preferredProvider && this.meetsRequirements(task.preferredProvider, task)) {
      return task.preferredProvider;
    }

    // Otherwise, select based on requirements and cost
    const providers = this.getAvailableProviders();
    
    for (const provider of providers) {
      if (this.meetsRequirements(provider, task)) {
        return provider;
      }
    }

    // Default to OpenAI if no specific requirements
    return 'openai';
  }

  /**
   * Check if provider meets requirements
   */
  private meetsRequirements(provider: LLMProvider, task: {
    requiresJsonMode?: boolean;
    requiresStreaming?: boolean;
    requiresVision?: boolean;
  }): boolean {
    const capabilities = this.getProviderCapabilities(provider);
    
    if (task.requiresJsonMode && !capabilities.supportsJsonMode) {
      return false;
    }
    
    if (task.requiresStreaming && !capabilities.supportsStreaming) {
      return false;
    }
    
    if (task.requiresVision && !capabilities.supportsVision) {
      return false;
    }
    
    return true;
  }
}

/**
 * Convenience function to create LLM from environment
 */
export function createLLMFromEnv(): BaseLLM {
  return LLMFactory.getInstance().createLLMFromEnv();
}

/**
 * Convenience function to create LLM with specific config
 */
export function createLLM(config: LLMFactoryConfig): BaseLLM {
  return LLMFactory.getInstance().createLLM(config);
}

/**
 * Convenience function to create LLM with fallback
 */
export function createLLMWithFallback(config: LLMFactoryConfig): {
  primary: BaseLLM;
  fallback?: BaseLLM;
} {
  return LLMFactory.getInstance().createLLMWithFallback(config);
} 