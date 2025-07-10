/**
 * Abstract base class for LLM providers
 * Enables support for multiple AI services (OpenAI, Anthropic, local models, etc.)
 */

export interface LLMConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model?: string;
  finishReason?: string;
}

export interface LLMStreamResponse extends LLMResponse {
  isComplete: boolean;
  chunk?: string;
}

export interface PlanGenerationRequest {
  instruction: string;
  url: string;
  viewport?: string;
  pageContent?: string;
}

export interface PlanGenerationResponse {
  success: boolean;
  steps?: any[];
  expectedResults?: string[];
  successCriteria?: string[];
  failureCriteria?: string[];
  fallbackSteps?: any[];
  confidence: number;
  reasoning: string;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    cost?: number;
  };
}

/**
 * Abstract base class for LLM providers
 */
export abstract class BaseLLM {
  protected config: LLMConfig;
  protected provider: string;

  constructor(config: LLMConfig, provider: string) {
    this.config = config;
    this.provider = provider;
  }

  /**
   * Generate a completion from messages
   */
  abstract generateCompletion(
    messages: LLMMessage[],
    options?: {
      jsonMode?: boolean;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse>;

  /**
   * Generate a streaming completion
   */
  abstract generateStreamCompletion(
    messages: LLMMessage[],
    options?: {
      jsonMode?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<LLMStreamResponse>;

  /**
   * Generate automation plan using this LLM
   */
  abstract generatePlan(
    request: PlanGenerationRequest,
    systemPrompt: string,
    userPrompt: string
  ): Promise<PlanGenerationResponse>;

  /**
   * Test connection to the LLM service
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Get provider-specific information
   */
  getProviderInfo(): {
    provider: string;
    model: string;
    supportsJsonMode: boolean;
    supportsStreaming: boolean;
    maxTokens: number;
  } {
    return {
      provider: this.provider,
      model: this.config.model,
      supportsJsonMode: this.supportsJsonMode(),
      supportsStreaming: this.supportsStreaming(),
      maxTokens: this.config.maxTokens || 4000
    };
  }

  /**
   * Get estimated cost for a request
   */
  abstract estimateCost(promptTokens: number, completionTokens: number): number;

  /**
   * Whether this provider supports JSON mode
   */
  protected abstract supportsJsonMode(): boolean;

  /**
   * Whether this provider supports streaming
   */
  protected abstract supportsStreaming(): boolean;

  /**
   * Validate the response format
   */
  protected validateResponse(response: any): boolean {
    try {
      return (
        typeof response === 'object' &&
        response !== null &&
        typeof response.success === 'boolean'
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse JSON response safely
   */
  protected parseJsonResponse(content: string): any {
    try {
      const parsed = JSON.parse(content);
      if (!this.validateResponse(parsed)) {
        throw new Error('Invalid response format');
      }
      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create standardized error response
   */
  protected createErrorResponse(error: string, details?: any): PlanGenerationResponse {
    return {
      success: false,
      error,
      confidence: 0,
      reasoning: 'Failed to generate plan',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        cost: 0
      },
      ...details
    };
  }

  /**
   * Log provider-specific metrics
   */
  protected logMetrics(
    request: PlanGenerationRequest,
    response: LLMResponse,
    duration: number
  ): void {
    console.log(`[${this.provider}] Plan generation completed`, {
      provider: this.provider,
      model: this.config.model,
      instruction: request.instruction.substring(0, 100),
      url: request.url,
      duration,
      usage: response.usage,
      contentLength: response.content.length
    });
  }
}

/**
 * LLM Provider Error Classes
 */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}

export class LLMConfigurationError extends LLMProviderError {
  constructor(message: string, provider: string, details?: any) {
    super(message, provider, 'CONFIGURATION_ERROR', details);
    this.name = 'LLMConfigurationError';
  }
}

export class LLMAPIError extends LLMProviderError {
  constructor(
    message: string,
    provider: string,
    public statusCode?: number,
    details?: any
  ) {
    super(message, provider, 'API_ERROR', details);
    this.name = 'LLMAPIError';
  }
}

export class LLMRateLimitError extends LLMProviderError {
  constructor(
    provider: string,
    public retryAfter?: number,
    details?: any
  ) {
    super('Rate limit exceeded', provider, 'RATE_LIMIT', details);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMTimeoutError extends LLMProviderError {
  constructor(provider: string, timeout: number, details?: any) {
    super(`Request timeout after ${timeout}ms`, provider, 'TIMEOUT', details);
    this.name = 'LLMTimeoutError';
  }
} 