import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { BrowserExecutor } from './browser-executor';
import { PlanGenerator } from './plan-generator';
import { CacheManager } from './cache-manager';
import { InteractiveBrowserAgent } from './interactive-browser-agent';
import { MonitoringService } from './monitoring-service';
import { ChangeDetector } from './change-detector';
import { executionResults, todo } from '../../next/src/db/schema';
import { 
  TaskInput, 
  TaskInputSchema, 
  ExecutionResult, 
  ExecutionPlan, 
  PlanGenerationError, 
  TaskExecutionError,
  BrowserExecutionError,
  LambdaResponse
} from './types';

// Initialize database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

/**
 * Determine if we should regenerate a plan based on execution results
 */
function shouldRegeneratePlan(executionResult: ExecutionResult): boolean {
  // Check if the failure was due to selector/element issues
  const errorMessage = executionResult.error?.message || '';
  const selectorIssues = [
    'timeout',
    'selector',
    'element not found',
    'not visible',
    'waitForSelector',
    'waitForElement',
    'locator',
    'exceeded'
  ];

  // Check main error message
  const mainErrorMatch = selectorIssues.some(issue => 
    errorMessage.toLowerCase().includes(issue.toLowerCase())
  );

  // Check logs for timeout/selector errors
  const logErrorMatch = executionResult.logs?.some(log => {
    const logMessage = log.message?.toLowerCase() || '';
    return selectorIssues.some(issue => logMessage.includes(issue.toLowerCase()));
  }) || false;

  // Check if error stack contains relevant information
  const stackErrorMatch = (executionResult.error as any)?.stack?.toLowerCase().includes('timeout') || 
                         (executionResult.error as any)?.stack?.toLowerCase().includes('selector') || false;

  const shouldRegenerate = mainErrorMatch || logErrorMatch || stackErrorMatch;
  
  console.log('🔍 Plan regeneration analysis:', {
    mainErrorMatch,
    logErrorMatch,
    stackErrorMatch,
    shouldRegenerate,
    errorMessage: errorMessage.substring(0, 100),
    lastLogMessage: executionResult.logs?.[executionResult.logs.length - 2]?.message?.substring(0, 100)
  });

  return shouldRegenerate;
}

/**
 * Main Lambda handler for task execution
 */
export async function handler(event: any): Promise<LambdaResponse> {
  const startTime = Date.now();
  let executionResult: ExecutionResult | null = null;
  let executionPlan: ExecutionPlan | null = null;

  try {
    console.log('🚀 Task execution started', { timestamp: new Date().toISOString() });

    // Parse and validate input
    const taskInput: TaskInput = TaskInputSchema.parse(event);
    console.log('✅ Input validated', { 
      instruction: taskInput.instruction?.substring(0, 100) || 'No instruction', 
      url: taskInput.url,
      planOnly: taskInput.options?.planOnly,
      executionOnly: taskInput.options?.executionOnly,
      planId: taskInput.options?.planId,
      executionMode: taskInput.options?.executionMode
    });

    // Validate mode compatibility
    if (taskInput.options?.planOnly && taskInput.options?.executionOnly) {
      throw new TaskExecutionError('Cannot use both planOnly and executionOnly modes', 'INVALID_OPTIONS');
    }

    // Determine execution mode
    const executionMode = taskInput.options?.executionMode || 'interactive';
    console.log('🎯 Execution mode determined', { executionMode });

    // Initialize components
    const planGenerator = new PlanGenerator();
    const cacheManager = new CacheManager();

    // Check for cached plan first (even for interactive mode)
    let cachedPlan: ExecutionPlan | null = null;
    try {
      // Create task signature for cache lookup (same logic as interactive agent)
      const createTaskSignature = (instruction: string, url: string): string => {
        const normalizedInstruction = instruction.toLowerCase().trim().replace(/\s+/g, '-');
        const normalizedUrl = url.replace(/^https?:\/\//, '').replace(/[^\w.-]/g, '-');
        return `${normalizedUrl}::${normalizedInstruction}`;
      };
      
      const taskSignature = createTaskSignature(taskInput.instruction, taskInput.url);
      console.log('🔍 Checking for cached plan...', { 
        taskSignature,
        instruction: taskInput.instruction.substring(0, 50) + '...',
        url: taskInput.url.substring(0, 50) + '...'
      });
      cachedPlan = await cacheManager.getCachedPlan(taskSignature);
      if (cachedPlan) {
        console.log('📋 Found cached plan, using traditional execution instead of interactive', { planId: cachedPlan.id });
      } else {
        console.log('📋 No cached plan found, proceeding with interactive mode');
      }
    } catch (error) {
      console.log('📋 Cache lookup failed, proceeding with interactive mode', { error: error instanceof Error ? error.message : error });
    }

    // Use cached plan with traditional execution if available
    if (cachedPlan && (executionMode === 'interactive' || executionMode === 'auto')) {
      console.log('🚀 Using cached plan with traditional execution');
      
      // Execute the cached plan directly
      const browserExecutor = new BrowserExecutor({
        headless: true,
        viewport: taskInput.options?.viewport || { width: 1920, height: 1080 },
        timeout: taskInput.options?.timeout || 60000,
        screenshots: taskInput.options?.screenshot ?? true,
        userAgent: taskInput.options?.userAgent
      });

      const result = await browserExecutor.executePlan(cachedPlan);
      
      executionResult = result;
      executionPlan = cachedPlan;
      
      console.log('✅ Cached plan execution finished', { success: result.status === 'success' });
      
      // Store execution result
      let storedExecutionId: string | null = null;
      try {
        storedExecutionId = await storeExecutionResult(
          executionResult, 
          taskInput.taskId, 
          cachedPlan.id
        );
        console.log('💾 Cached plan execution result stored', { executionId: storedExecutionId });
      } catch (storeError) {
        console.warn('Failed to store cached plan execution result:', storeError);
      }

    // INTERACTIVE MODE - Execute task step-by-step with real-time browser state (only if no cached plan)
    } else if (executionMode === 'interactive' || executionMode === 'auto') {
      console.log('🤖 Interactive mode: Step-by-step execution with real-time browser state');
      
      // Initialize browser executor for interactive agent
      const browserExecutor = new BrowserExecutor({
        headless: true, // Always run headless in Lambda
        viewport: taskInput.options?.viewport || { width: 1920, height: 1080 },
        timeout: taskInput.options?.timeout || 60000,
        screenshots: taskInput.options?.screenshot ?? true,
        userAgent: taskInput.options?.userAgent
      });

      // Create interactive agent
      const interactiveAgent = new InteractiveBrowserAgent({
        browserExecutor,
        maxSteps: 10,
        progressThreshold: 0.1,
        stagnationLimit: 3,
        enableScreenshots: taskInput.options?.screenshot ?? true,
        enableDOMCapture: true,
      });

      try {
        // Execute interactively
        const interactiveResult = await interactiveAgent.executeInteractively(taskInput);
        
        console.log('🤖 Interactive execution completed', {
          success: interactiveResult.success,
          steps: interactiveResult.steps.length,
          escalatedToHuman: interactiveResult.escalatedToHuman,
          generatedPlan: !!interactiveResult.generatedPlan,
          llmCalls: interactiveResult.usage?.llmCalls || 0,
          totalTokens: interactiveResult.usage?.totalTokens || 0
        });

        // If interactive execution was successful and generated a plan, cache it
        let planCachedSuccessfully = false;
        let actualPlanId: string | null = null;
        if (interactiveResult.success && interactiveResult.generatedPlan) {
          try {
            const cachedPlanId = await cacheManager.cachePlan(interactiveResult.generatedPlan);
            planCachedSuccessfully = true;
            actualPlanId = cachedPlanId;
            console.log('💾 Interactive plan cached successfully', { 
              planId: actualPlanId 
            });
          } catch (cacheError) {
            console.warn('Failed to cache interactive plan:', cacheError);
          }
        }

        // Convert interactive result to standard ExecutionResult format
        executionResult = {
          planId: interactiveResult.generatedPlan?.id || `interactive-${Date.now()}`,
          status: interactiveResult.success ? 'success' : 'failed',
          extractedData: {
            // Include actual extracted data from interactive execution
            ...(interactiveResult.extractedData || {}),
            // Include metadata about the interactive execution
            _metadata: {
              interactiveSteps: interactiveResult.steps.length,
              progressImprovement: interactiveResult.progressImprovement,
              escalatedToHuman: interactiveResult.escalatedToHuman,
              escalationReason: interactiveResult.escalationReason,
            }
          },
          usage: interactiveResult.usage,
          screenshots: [], // Interactive agent handles screenshots internally
          logs: [],
          error: interactiveResult.escalatedToHuman ? {
            message: interactiveResult.escalationReason || 'Interactive execution escalated to human',
            step: 'interactive_execution'
          } : undefined,
          metrics: {
            executionTime: interactiveResult.totalDuration,
            stepsCompleted: interactiveResult.steps.length,
            stepsTotal: interactiveResult.steps.length,
            retryCount: 0,
          },
          createdAt: new Date(),
        };

        executionPlan = interactiveResult.generatedPlan;

        // If interactive mode failed and we're in 'auto' mode, fallback to traditional planning
        if (!interactiveResult.success && executionMode === 'auto') {
          console.log('🔄 Interactive execution failed, falling back to traditional planning mode');
          // Continue to traditional planning mode below
        } else {
          // Interactive execution completed (success or failure), return result
          console.log('✅ Interactive execution finished', { success: interactiveResult.success });
          
          // Store execution result
          let storedExecutionId: string | null = null;
          try {
            storedExecutionId = await storeExecutionResult(
              executionResult, 
              taskInput.taskId, 
              actualPlanId
            );
            console.log('💾 Interactive execution result stored');
          } catch (error) {
            console.error('Failed to store interactive execution result:', error);
          }

          // Process monitoring if task execution was successful and we have extracted data
          if (interactiveResult.success && executionResult.extractedData && taskInput.taskId && storedExecutionId) {
            try {
              const changeDetector = new ChangeDetector();
              const monitoringService = new MonitoringService(db, changeDetector);

              // Store current execution data for monitoring
              await monitoringService.storeExecutionData({
                taskId: taskInput.taskId,
                url: taskInput.url,
                extractedData: executionResult.extractedData,
                executionId: storedExecutionId
              });
              console.log('📊 Monitoring data stored');

              // Process change detection
              const monitoringResult = await monitoringService.processMonitoring(
                taskInput.taskId,
                executionResult.extractedData,
                storedExecutionId
              );

              if (monitoringResult.hasChanges) {
                console.log('🔍 Changes detected!', {
                  changedFields: monitoringResult.changedFields,
                  isRestock: monitoringResult.isRestock
                });
              } else if (monitoringResult.isFirstExecution) {
                console.log('🎯 First execution - baseline data stored');
              } else {
                console.log('😴 No changes detected');
              }

            } catch (monitoringError) {
              console.warn('⚠️ Monitoring processing failed:', monitoringError);
              // Don't fail the entire execution if monitoring fails
            }
          }

          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            body: JSON.stringify({
              success: interactiveResult.success,
              mode: 'interactive',
              planId: executionResult.planId,
              status: executionResult.status,
              extractedData: executionResult.extractedData,
              interactiveSteps: interactiveResult.steps.map(step => ({
                stepNumber: step.stepNumber,
                action: step.action,
                progressScore: step.progressScore,
                isComplete: step.isComplete,
                reasoning: step.reasoning,
              })),
              metrics: {
                ...executionResult.metrics,
                totalTime: Date.now() - startTime,
                averageProgressScore: interactiveResult.metadata.averageProgressScore,
                maxStepsReached: interactiveResult.metadata.maxStepsReached,
                stagnationDetected: interactiveResult.metadata.stagnationDetected,
              },
              escalation: interactiveResult.escalatedToHuman ? {
                escalated: true,
                reason: interactiveResult.escalationReason,
              } : { escalated: false },
              ...(executionResult.error && {
                error: executionResult.error
              })
            })
          };
        }
      } catch (interactiveError) {
        console.error('❌ Interactive execution error:', interactiveError);
        
        // If we're in auto mode, fallback to traditional planning
        if (executionMode === 'auto') {
          console.log('🔄 Interactive execution error, falling back to traditional planning mode');
          // Continue to traditional planning mode below
        } else {
          // In pure interactive mode, return the error
          throw new TaskExecutionError(
            `Interactive execution failed: ${(interactiveError as Error).message}`,
            'INTERACTIVE_EXECUTION_ERROR',
            { originalError: (interactiveError as Error).message }
          );
        }
      }
    }

    // PLAN ONLY MODE - Generate plan but don't execute
    if (taskInput.options?.planOnly) {
      console.log('🧠 Plan-only mode: Generating plan without execution');
      
      const planResponse = await planGenerator.generatePlan({
        instruction: taskInput.instruction,
        url: taskInput.url,
        viewport: '1280x720'
      });

      if (!planResponse.success || !planResponse.plan) {
        throw new PlanGenerationError(
          planResponse.error || 'Failed to generate execution plan',
          { confidence: planResponse.confidence, reasoning: planResponse.reasoning }
        );
      }

      // Cache the plan
      try {
        await cacheManager.cachePlan(planResponse.plan);
        console.log('💾 Plan cached successfully for future execution', { planId: planResponse.plan.id });
      } catch (cacheError) {
        console.warn('Failed to cache plan:', cacheError);
      }

      // Return plan details without execution
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          mode: 'plan_only',
          planId: planResponse.plan.id,
          taskSignature: planResponse.plan.taskSignature,
          planDetails: {
            steps: planResponse.plan.steps.map(step => ({
              id: step.id,
              type: step.type,
              description: step.description,
              selector: step.selector
            })),
            estimatedDuration: planResponse.plan.metadata.estimatedDuration,
            confidence: planResponse.confidence,
            reasoning: planResponse.reasoning
          },
          executionTime: Date.now() - startTime,
          message: 'Plan generated successfully. Use executionOnly mode with this planId to execute.'
        })
      };
    }

    // EXECUTION ONLY MODE - Execute existing plan without generating new one
    if (taskInput.options?.executionOnly) {
      console.log('🎯 Execution-only mode: Loading and executing existing plan');
      
      let planToExecute: ExecutionPlan | null = null;
      
      // Get plan by ID if provided
      if (taskInput.options?.planId) {
        console.log('🔍 Loading plan by ID:', taskInput.options.planId);
        planToExecute = await cacheManager.getCachedPlanById(taskInput.options.planId);
        
        if (!planToExecute) {
          throw new TaskExecutionError(
            `Plan not found: ${taskInput.options.planId}`,
            'PLAN_NOT_FOUND',
            { planId: taskInput.options.planId }
          );
        }
      } else {
        // Get plan by task signature
        const taskSignature = generateTaskSignature(taskInput.instruction, taskInput.url);
        console.log('🔍 Loading plan by task signature:', taskSignature);
        
        planToExecute = await cacheManager.getCachedPlan(taskSignature);
        
        if (!planToExecute) {
          throw new TaskExecutionError(
            'No cached plan found for this task. Use planOnly mode first to generate a plan.',
            'NO_CACHED_PLAN',
            { taskSignature }
          );
        }
      }

      console.log('✅ Plan loaded successfully', { planId: planToExecute.id });
      executionPlan = planToExecute;

      // Skip plan generation and go straight to execution
    } else {
      // NORMAL MODE - Generate plan (if not cached) and execute
      console.log('🔄 Normal mode: Generate plan and execute');
      
      // Generate task signature for caching
      const taskSignature = generateTaskSignature(taskInput.instruction, taskInput.url);
      console.log('🔍 Task signature created', { taskSignature });

      // Try to get cached plan first (if not forcing new plan)
      if (!taskInput.options?.forceNewPlan) {
        try {
          executionPlan = await cacheManager.getCachedPlan(taskSignature);
          if (executionPlan) {
            console.log('📋 Using cached plan', { planId: executionPlan.id });
          }
        } catch (error) {
          console.error('Error retrieving cached plan:', error);
        }
      }

      // Generate new plan if no cached plan exists
      if (!executionPlan) {
        console.log('🧠 Generating new plan with LLM');
        const planResponse = await planGenerator.generatePlan({
          instruction: taskInput.instruction,
          url: taskInput.url,
          pageContent: undefined
        });

        if (!planResponse.success || !planResponse.plan) {
          throw new PlanGenerationError(
            planResponse.error || 'Failed to generate execution plan',
            { confidence: planResponse.confidence, reasoning: planResponse.reasoning }
          );
        }

        executionPlan = planResponse.plan;
        
        // Validate the generated plan
        const validation = planGenerator.validatePlan(executionPlan);
        if (!validation.valid) {
          console.warn('⚠️ Plan validation issues', { issues: validation.issues });
        }

        // Cache the new plan
        try {
          await cacheManager.cachePlan(executionPlan);
          console.log('💾 Plan cached successfully', { planId: executionPlan.id });
        } catch (cacheError) {
          console.warn('Failed to cache plan, continuing without caching', cacheError);
        }
      }
    }

    // Execute the plan using browser automation
    console.log('🌐 Starting browser execution');
    const browserExecutor = new BrowserExecutor({
      headless: true, // Always run headless in Lambda
      viewport: taskInput.options?.viewport || { width: 1920, height: 1080 },
      timeout: taskInput.options?.timeout || 60000,
      screenshots: taskInput.options?.screenshot ?? true,
      userAgent: taskInput.options?.userAgent
    });

    executionResult = await browserExecutor.executePlan(executionPlan);
    
    // Check if plan failed and should be regenerated
    console.log('🔍 Checking if plan should be regenerated', { 
      status: executionResult.status,
      errorMessage: executionResult.error?.message || 'No error message',
      shouldRegenerate: shouldRegeneratePlan(executionResult)
    });
    
    if ((executionResult.status === 'failed' || executionResult.status === 'error') && 
        shouldRegeneratePlan(executionResult)) {
      
      console.log('🔄 Plan execution failed, attempting to generate new plan with page context');
      
      try {
        // Get page content for better context
        const pageContent = await browserExecutor.getPageContent();
        console.log('📄 Page content retrieved', { 
          contentLength: pageContent?.length || 0,
          preview: pageContent?.substring(0, 200) || 'No content'
        });
        
        // Generate new plan with page context and previous failure info
        const newPlanResponse = await planGenerator.generatePlan({
          instruction: taskInput.instruction,
          url: taskInput.url,
          pageContent: pageContent || undefined
        });

        if (newPlanResponse.success && newPlanResponse.plan) {
          console.log('🆕 Generated new plan, attempting execution');
          
          // Try the new plan
          const newExecutionResult = await browserExecutor.executePlan(newPlanResponse.plan);
          
          if (newExecutionResult.status === 'success') {
            console.log('✅ New plan succeeded!');
            executionResult = newExecutionResult;
            executionPlan = newPlanResponse.plan;
            
            // Cache the successful new plan
            try {
              await cacheManager.cachePlan(newPlanResponse.plan);
              console.log('💾 New successful plan cached');
            } catch (cacheError) {
              console.warn('Failed to cache new plan:', cacheError);
            }
          } else {
            console.log('❌ New plan also failed, using original result');
          }
        } else {
          console.log('❌ Failed to generate new plan', { 
            success: newPlanResponse.success,
            error: newPlanResponse.error 
          });
        }
      } catch (retryError) {
        console.warn('Failed to regenerate plan:', retryError);
      }
    } else {
      console.log('⏭️ Skipping plan regeneration', {
        failedStatus: executionResult.status === 'failed' || executionResult.status === 'error',
        shouldRegenerate: shouldRegeneratePlan(executionResult)
      });
    }

    console.log('✅ Browser execution completed', { 
      status: executionResult.status, 
      stepsCompleted: executionResult.metrics.stepsCompleted,
      executionTime: executionResult.metrics.executionTime 
    });

    // Store execution result
    try {
      const storedExecutionId = await storeExecutionResult(executionResult, taskInput.taskId, executionPlan!.id);
      console.log('💾 Execution result stored');
      
      // TODO: Add monitoring processing here if needed for traditional plan mode
    } catch (error) {
      console.error('Failed to store execution result:', error);
      // Continue anyway
    }

    // Determine final success status
    const isSuccess = executionResult.status === 'success';
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
      },
      body: JSON.stringify({
        success: isSuccess,
        planId: executionPlan.id,
        executionId: executionResult.planId,
        status: executionResult.status,
        extractedData: executionResult.extractedData || {},
        screenshots: executionResult.screenshots?.length || 0,
        metrics: {
          ...executionResult.metrics,
          totalTime: Date.now() - startTime,
          planGenerated: !taskInput.options?.forceNewPlan,
          cacheHit: !!executionPlan
        },
        logs: executionResult.logs || [],
        ...(executionResult.error && {
          error: {
            message: executionResult.error.message,
            step: executionResult.error.step,
            stack: executionResult.error.stack
          }
        })
      })
    };

  } catch (error) {
    console.error('❌ Task execution failed', error);

    const errorResponse = {
      success: false,
      error: {
        type: (error as any).constructor.name,
        message: (error as any).message,
        code: (error as any).code || 'UNKNOWN_ERROR',
        details: (error as any).details || {},
        timestamp: new Date().toISOString()
      },
      metrics: {
        totalTime: Date.now() - startTime,
        failed: true
      },
      executionResult: executionResult ? {
        status: executionResult.status,
        logs: executionResult.logs.slice(-5) // Last 5 logs for debugging
      } : null
    };

    // Store error result if we have enough context
    if (executionResult) {
      try {
        const storedExecutionId = await storeExecutionResult(executionResult, undefined, executionResult.planId);
      } catch (storeError) {
        const storeErrorMessage = storeError instanceof Error ? storeError.message : 'Unknown storage error';
        console.error('Failed to store error result', storeErrorMessage);
      }
    }

    // Return appropriate error status code
    const statusCode = getErrorStatusCode(error);
    return createErrorResponse(errorResponse, statusCode);
  }
}

/**
 * Store execution result in database
 */
async function storeExecutionResult(
  result: ExecutionResult, 
  taskId: string | undefined,
  planId: string | null
): Promise<string> {
  try {
    const executionId = randomUUID();
    await db.insert(executionResults).values({
      id: executionId,
      taskId: taskId || null,
      planId,
      status: result.status,
      result: result.extractedData || null,
      logs: result.logs,
      errorMessage: result.error?.message,
      executionTime: result.metrics.executionTime,
      createdAt: new Date()
    });
    return executionId;
  } catch (error) {
    console.error('Database storage failed:', error);
    throw error;
  }
}

/**
 * Create task signature for caching
 */
function generateTaskSignature(instruction: string, url: string): string {
  const { createHash } = require('crypto');
  const urlDomain = new URL(url).hostname;
  const combined = `${instruction.toLowerCase().trim()}_${urlDomain}`;
  return createHash('md5').update(combined).digest('hex');
}

/**
 * Get appropriate HTTP status code for error
 */
function getErrorStatusCode(error: any): number {
  if (error instanceof TaskExecutionError) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
      case 'INVALID_INPUT':
        return 400;
      case 'TASK_NOT_FOUND':
        return 404;
      case 'TIMEOUT':
        return 408;
      default:
        return 500;
    }
  }
  
  if (error instanceof PlanGenerationError) {
    return 422; // Unprocessable Entity
  }
  
  if (error instanceof BrowserExecutionError) {
    return 500;
  }
  
  return 500; // Internal Server Error
}

/**
 * Create successful response
 */
function createSuccessResponse(data: any): LambdaResponse {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    },
    body: JSON.stringify(data)
  };
}

/**
 * Create error response
 */
function createErrorResponse(error: any, statusCode: number = 500): LambdaResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    },
    body: JSON.stringify(error)
  };
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<LambdaResponse> {
  try {
    // Perform basic health checks
    const checks = {
      database: false,
      openai: false,
      cache: false
    };

    // Check database connection
    try {
      await db.execute('SELECT 1');
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Check OpenAI API key
    checks.openai = !!process.env.OPENAI_API_KEY;

    // Check cache manager
    try {
      const cacheManager = new CacheManager();
      const cacheStats = await cacheManager.getCacheStats();
      checks.cache = true;
    } catch (error) {
      console.error('Cache health check failed:', error);
    }

    const isHealthy = Object.values(checks).every(check => check);

    return createSuccessResponse({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      version: '1.0.0'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse({
      status: 'unhealthy',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, 503);
  }
}

// Export for different deployment scenarios
export { handler as default };

// For direct testing
if (require.main === module) {
  // Example usage for testing
  const testEvent = {
    instruction: "Find the price of the latest iPhone on Apple's website",
    url: "https://www.apple.com",
    options: {
      screenshot: true,
      timeout: 60000
    }
  };

  handler(testEvent)
    .then(result => {
      console.log('Test result:', JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Test failed:', error);
    });
} 