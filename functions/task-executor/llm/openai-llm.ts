// @ts-ignore - OpenAI module may not be available during build
import OpenAI from 'openai';
import {
  BaseLLM,
  LLMConfig,
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  PlanGenerationRequest,
  PlanGenerationResponse,
  LLMAPIError,
  LLMRateLimitError,
  LLMTimeoutError,
  LLMConfigurationError
} from './base-llm';

/**
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends LLMConfig {
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-4o' | 'gpt-3.5-turbo' | string;
  organization?: string;
  dangerouslyAllowBrowser?: boolean;
}

/**
 * OpenAI pricing per 1K tokens (as of 2024)
 */
const OPENAI_PRICING = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
} as const;

/**
 * OpenAI LLM Provider
 */
export class OpenAILLM extends BaseLLM {
  private client: OpenAI;
  private openaiConfig: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    super(config, 'openai');
    this.openaiConfig = config;

    if (!config.apiKey) {
      throw new LLMConfigurationError(
        'OpenAI API key is required',
        'openai',
        { config }
      );
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      dangerouslyAllowBrowser: config.dangerouslyAllowBrowser || false,
      timeout: config.timeout || 30000
    });
  }

  /**
   * Generate a completion from messages
   */
  async generateCompletion(
    messages: LLMMessage[],
    options?: {
      jsonMode?: boolean;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
        response_format: (options?.jsonMode && this.supportsJsonMode()) ? { type: 'json_object' } : undefined,
        stream: options?.stream ?? false
      });

      // Type guard to ensure we have a non-streaming response
      if ('choices' in response && 'usage' in response && 'model' in response) {
        const choice = response.choices[0];
        if (!choice?.message?.content) {
          throw new LLMAPIError(
            'No content in OpenAI response',
            'openai',
            undefined,
            { response }
          );
        }

        return {
          content: choice.message.content,
          usage: {
            promptTokens: response.usage?.prompt_tokens,
            completionTokens: response.usage?.completion_tokens,
            totalTokens: response.usage?.total_tokens
          },
          model: response.model,
          finishReason: choice.finish_reason || undefined
        };
      } else {
        throw new LLMAPIError(
          'Received streaming response when expecting non-streaming',
          'openai',
          undefined,
          { response }
        );
      }
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Generate a streaming completion
   */
  async *generateStreamCompletion(
    messages: LLMMessage[],
    options?: {
      jsonMode?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<LLMStreamResponse> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
        response_format: (options?.jsonMode && this.supportsJsonMode()) ? { type: 'json_object' } : undefined,
        stream: true
      });

      let fullContent = '';
      let usage = {};

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const chunkContent = choice?.delta?.content || '';
        
        if (chunkContent) {
          fullContent += chunkContent;
        }

        const isComplete = choice?.finish_reason !== null;
        
        if (isComplete && chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens
          };
        }

        yield {
          content: fullContent,
          chunk: chunkContent,
          isComplete,
          usage,
          model: chunk.model,
          finishReason: choice?.finish_reason || undefined
        };

        if (isComplete) {
          break;
        }
      }
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Generate automation plan using OpenAI
   */
  async generatePlan(
    request: PlanGenerationRequest,
    systemPrompt: string,
    userPrompt: string
  ): Promise<PlanGenerationResponse> {
    const startTime = Date.now();

    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      // For models that don't support JSON mode, add explicit JSON instruction
      if (!this.supportsJsonMode()) {
        messages[0].content += '\n\nIMPORTANT: You must respond with valid JSON only. Do not include any text before or after the JSON response.';
      }

      const response = await this.generateCompletion(messages, {
        jsonMode: true,
        temperature: 0.1 // Lower temperature for more consistent JSON output
      });

      const duration = Date.now() - startTime;
      this.logMetrics(request, response, duration);

      const parsedResponse = this.parseJsonResponse(response.content);
      
      return {
        ...parsedResponse,
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
          cost: this.estimateCost(
            response.usage?.promptTokens || 0,
            response.usage?.completionTokens || 0
          )
        }
      };
    } catch (error) {
      console.error('[OpenAI] Plan generation failed:', error);
      
      if (error instanceof Error && error.message.includes('Failed to parse')) {
        return this.createErrorResponse(
          'OpenAI returned invalid JSON format',
          { originalError: error.message }
        );
      }

      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
        stream: false
      });

      return 'choices' in response && response.choices.length > 0;
    } catch (error) {
      console.error('[OpenAI] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Estimate cost for OpenAI API usage
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    const modelKey = this.config.model.toLowerCase();
    const pricing = OPENAI_PRICING[modelKey as keyof typeof OPENAI_PRICING] || 
                   OPENAI_PRICING['gpt-4']; // Default to GPT-4 pricing

    const inputCost = (promptTokens / 1000) * pricing.input;
    const outputCost = (completionTokens / 1000) * pricing.output;

    return Number((inputCost + outputCost).toFixed(6));
  }

  /**
   * OpenAI supports JSON mode (only for certain models)
   */
  protected supportsJsonMode(): boolean {
    const model = this.config.model.toLowerCase();
    // JSON mode is only supported by gpt-4-turbo, gpt-4o, and gpt-3.5-turbo
    return model.includes('gpt-4-turbo') || 
           model.includes('gpt-4o') || 
           model.includes('gpt-3.5-turbo');
  }

  /**
   * OpenAI supports streaming
   */
  protected supportsStreaming(): boolean {
    return true;
  }

  /**
   * Handle OpenAI-specific errors
   */
  private handleOpenAIError(error: unknown): Error {
    // Check if it's an OpenAI error by duck typing instead of instanceof
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as any;
      
      // Rate limiting error
      if (apiError.status === 429) {
        const retryAfter = apiError.headers?.['retry-after'] 
          ? parseInt(apiError.headers['retry-after']) 
          : undefined;
        
        return new LLMRateLimitError('openai', retryAfter, {
          originalError: apiError.message,
          type: apiError.type,
          code: apiError.code
        });
      }

      // API error
      return new LLMAPIError(
        apiError.message || 'OpenAI API error',
        'openai',
        apiError.status,
        {
          type: apiError.type,
          code: apiError.code,
          param: apiError.param
        }
      );
    }

    // Connection or timeout errors
    if (error && typeof error === 'object' && 'message' in error) {
      const errorObj = error as any;
      
      // Check for connection errors
      if (errorObj.code === 'ECONNRESET' || errorObj.code === 'ENOTFOUND' || 
          errorObj.message?.includes('connection') || errorObj.message?.includes('timeout')) {
        return new LLMTimeoutError('openai', this.config.timeout || 30000, {
          originalError: errorObj.message,
          cause: errorObj.cause
        });
      }
    }

    // Generic error handling
    return new LLMAPIError(
      error instanceof Error ? error.message : 'Unknown OpenAI error',
      'openai',
      undefined,
      { originalError: error }
    );
  }

  /**
   * Get OpenAI-specific model information
   */
  getModelInfo(): {
    provider: string;
    model: string;
    contextLength: number;
    supportsJsonMode: boolean;
    supportsStreaming: boolean;
    supportsVision: boolean;
    costPer1kTokens: { input: number; output: number };
  } {
    const modelKey = this.config.model.toLowerCase();
    const pricing = OPENAI_PRICING[modelKey as keyof typeof OPENAI_PRICING] || 
                   OPENAI_PRICING['gpt-4'];

    return {
      provider: 'openai',
      model: this.config.model,
      contextLength: this.getContextLength(),
      supportsJsonMode: this.supportsJsonMode(),
      supportsStreaming: true,
      supportsVision: this.config.model.includes('vision') || this.config.model.includes('4o'),
      costPer1kTokens: pricing
    };
  }

  /**
   * Get context length for the model
   */
  private getContextLength(): number {
    const model = this.config.model.toLowerCase();
    
    if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
      return 128000;
    }
    
    if (model.includes('gpt-4')) {
      return 8000;
    }
    
    if (model.includes('gpt-3.5-turbo')) {
      return 16000;
    }
    
    return 8000; // Default
  }
} 