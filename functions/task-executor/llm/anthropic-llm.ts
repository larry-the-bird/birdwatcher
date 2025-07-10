// @ts-ignore - Anthropic module may not be available during build
import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends LLMConfig {
  model: 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307' | 'claude-2.1' | 'claude-2.0' | string;
  maxTokens?: number;
}

/**
 * Anthropic pricing per 1M tokens (as of 2024)
 */
const ANTHROPIC_PRICING = {
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'claude-3-sonnet-20240229': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-2.1': { input: 8, output: 24 },
  'claude-2.0': { input: 8, output: 24 }
} as const;

/**
 * Anthropic LLM Provider
 */
export class AnthropicLLM extends BaseLLM {
  private client: Anthropic;
  private anthropicConfig: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    super(config, 'anthropic');
    this.anthropicConfig = config;

    if (!config.apiKey) {
      throw new LLMConfigurationError(
        'Anthropic API key is required',
        'anthropic',
        { config }
      );
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
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
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertMessages(messages);
      
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        messages: anthropicMessages.messages,
        system: anthropicMessages.system,
        stream: options?.stream ?? false
      });

      // Handle non-streaming response
      if ('content' in response && 'usage' in response && 'model' in response) {
        const content = (response as any).content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('');

        if (!content) {
          throw new LLMAPIError(
            'No content in Anthropic response',
            'anthropic',
            undefined,
            { response }
          );
        }

        return {
          content,
          usage: {
            promptTokens: (response as any).usage?.input_tokens,
            completionTokens: (response as any).usage?.output_tokens,
            totalTokens: ((response as any).usage?.input_tokens || 0) + ((response as any).usage?.output_tokens || 0)
          },
          model: (response as any).model,
          finishReason: (response as any).stop_reason || undefined
        };
      }

      throw new LLMAPIError(
        'Unexpected streaming response in non-streaming mode',
        'anthropic'
      );
    } catch (error) {
      throw this.handleAnthropicError(error);
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
      const anthropicMessages = this.convertMessages(messages);
      
      const stream = await this.client.messages.create({
        model: this.config.model,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4000,
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        messages: anthropicMessages.messages,
        system: anthropicMessages.system,
        stream: true
      });

      let fullContent = '';
      let usage = {};

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const chunkContent = chunk.delta.text;
          fullContent += chunkContent;

          yield {
            content: fullContent,
            chunk: chunkContent,
            isComplete: false,
            usage,
            model: this.config.model
          };
        } else if (chunk.type === 'message_stop') {
          yield {
            content: fullContent,
            chunk: '',
            isComplete: true,
            usage,
            model: this.config.model
          };
          break;
        } else if (chunk.type === 'message_delta' && chunk.usage) {
          usage = {
            promptTokens: (chunk.usage as any).input_tokens,
            completionTokens: (chunk.usage as any).output_tokens,
            totalTokens: ((chunk.usage as any).input_tokens || 0) + ((chunk.usage as any).output_tokens || 0)
          };
        }
      }
    } catch (error) {
      throw this.handleAnthropicError(error);
    }
  }

  /**
   * Generate automation plan using Anthropic
   */
  async generatePlan(
    request: PlanGenerationRequest,
    systemPrompt: string,
    userPrompt: string
  ): Promise<PlanGenerationResponse> {
    const startTime = Date.now();

    try {
      // Add JSON instruction to user prompt for Anthropic
      const enhancedUserPrompt = `${userPrompt}

Please respond with a valid JSON object following the exact format specified in the system prompt. Do not include any text outside of the JSON object.`;

      const messages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: enhancedUserPrompt }
      ];

      const response = await this.generateCompletion(messages, {
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
      console.error('[Anthropic] Plan generation failed:', error);
      
      if (error instanceof Error && error.message.includes('Failed to parse')) {
        return this.createErrorResponse(
          'Anthropic returned invalid JSON format',
          { originalError: error.message }
        );
      }

      throw this.handleAnthropicError(error);
    }
  }

  /**
   * Test connection to Anthropic API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Hello' }]
      });

      return response.content.length > 0;
    } catch (error) {
      console.error('[Anthropic] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Estimate cost for Anthropic API usage
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    const modelKey = this.config.model.toLowerCase();
    const pricing = ANTHROPIC_PRICING[modelKey as keyof typeof ANTHROPIC_PRICING] || 
                   ANTHROPIC_PRICING['claude-3-sonnet-20240229']; // Default to Sonnet pricing

    // Anthropic pricing is per 1M tokens
    const inputCost = (promptTokens / 1000000) * pricing.input;
    const outputCost = (completionTokens / 1000000) * pricing.output;

    return Number((inputCost + outputCost).toFixed(8));
  }

  /**
   * Anthropic doesn't support explicit JSON mode, but we can prompt for it
   */
  protected supportsJsonMode(): boolean {
    return false;
  }

  /**
   * Anthropic supports streaming
   */
  protected supportsStreaming(): boolean {
    return true;
  }

  /**
   * Convert generic messages to Anthropic format
   */
  private convertMessages(messages: LLMMessage[]): {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    system?: string;
  } {
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    return {
      messages: conversationMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      system: systemMessages.length > 0 ? systemMessages[0].content : undefined
    };
  }

  /**
   * Handle Anthropic-specific errors
   */
  private handleAnthropicError(error: unknown): Error {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        const retryAfter = error.headers?.['retry-after']
          ? parseInt(error.headers['retry-after'])
          : undefined;
        
        return new LLMRateLimitError('anthropic', retryAfter, {
          originalError: error.message,
          // @ts-expect-error - type property may not be available in all Anthropic versions
          type: error.type
        });
      }

      return new LLMAPIError(
        error.message,
        'anthropic',
        error.status,
        {
          // @ts-expect-error - type property may not be available in all Anthropic versions
          type: error.type
        }
      );
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new LLMTimeoutError('anthropic', this.config.timeout || 30000, {
        originalError: error.message
      });
    }

    // @ts-expect-error - APITimeoutError may not be available in all Anthropic versions
    if (error instanceof Anthropic.APITimeoutError) {
      return new LLMTimeoutError('anthropic', this.config.timeout || 30000, {
        originalError: (error as Error).message
      });
    }

    // Generic error handling
    return new LLMAPIError(
      error instanceof Error ? error.message : 'Unknown Anthropic error',
      'anthropic',
      undefined,
      { originalError: error }
    );
  }

  /**
   * Get Anthropic-specific model information
   */
  getModelInfo(): {
    provider: string;
    model: string;
    contextLength: number;
    supportsJsonMode: boolean;
    supportsStreaming: boolean;
    supportsVision: boolean;
    costPer1mTokens: { input: number; output: number };
  } {
    const modelKey = this.config.model.toLowerCase();
    const pricing = ANTHROPIC_PRICING[modelKey as keyof typeof ANTHROPIC_PRICING] || 
                   ANTHROPIC_PRICING['claude-3-sonnet-20240229'];

    return {
      provider: 'anthropic',
      model: this.config.model,
      contextLength: this.getContextLength(),
      supportsJsonMode: false,
      supportsStreaming: true,
      supportsVision: this.config.model.includes('claude-3'),
      costPer1mTokens: pricing
    };
  }

  /**
   * Get context length for the model
   */
  private getContextLength(): number {
    const model = this.config.model.toLowerCase();
    
    if (model.includes('claude-3')) {
      return 200000; // 200k tokens for Claude 3 models
    }
    
    if (model.includes('claude-2')) {
      return 100000; // 100k tokens for Claude 2 models
    }
    
    return 100000; // Default
  }
} 