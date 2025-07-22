import { BrowserExecutor } from '../utils/browser-executor';
import { ReactAgent } from '../core/react-agent';
import { PathStorage } from '../storage/path-storage';
import { PathExecutor } from '../core/path-executor';
import { createLLMFromEnv } from '../../llm/llm-factory';
import { DatabaseService } from '../services/database-service';
import { NotificationService, NotificationConfig } from '../services/notification-service';
import { Task, ExecutionPath } from '../../types';

interface SimplifiedResult {
  success: boolean;
  extractedData?: any;
  error?: string;
  usedSavedPath: boolean;
  pathId?: string;
  executionId?: string;
  changesDetected?: boolean;
  changeDetails?: any;
}

export class SimplifiedTaskHandler {
  private pathStorage: PathStorage;
  private db: DatabaseService;
  private notifications: NotificationService;
  
  constructor(storageDir?: string, notificationConfig?: NotificationConfig) {
    this.pathStorage = new PathStorage(storageDir);
    this.db = new DatabaseService();
    this.notifications = notificationConfig 
      ? new NotificationService(notificationConfig)
      : NotificationService.consoleOnly();
  }

  async executeTask(task: Task): Promise<SimplifiedResult> {
    const startTime = Date.now();
    console.log(`\n🎯 Executing task: ${task.id}`);
    console.log(`📋 Instruction: ${task.instruction}`);
    console.log(`🌐 URL: ${task.url}\n`);

    // Ensure task exists in database before execution
    await this.db.ensureTaskExists(task);

    let result: SimplifiedResult;

    // Step 1: Check if we have a saved path for this task
    const savedPath = await this.pathStorage.getPath(task.id);
    
    if (savedPath) {
      console.log('📂 Found saved execution path, attempting to reuse...\n');
      result = await this.executeWithSavedPath(task, savedPath);
    } else {
      console.log('🔍 No saved path found, starting AI exploration...\n');
      result = await this.exploreAndExecute(task);
    }

    // Step 2: Save execution result to database
    const executionTime = Date.now() - startTime;
    const executionId = await this.db.saveExecutionResult({
      taskId: task.id,
      status: result.success ? 'success' : 'failed',
      result: result.extractedData,
      errorMessage: result.error,
      executionTime
    });

    result.executionId = executionId;

    // Step 3: Save monitoring data and check for changes if successful
    if (result.success && result.extractedData) {
      try {
        const changeResult = await this.handleMonitoringAndChangeDetection(task, result.extractedData, executionId);
        result.changesDetected = changeResult.changesDetected;
        result.changeDetails = changeResult.changeDetails;
      } catch (error) {
        console.log('⚠️ Monitoring tables not available, skipping change detection');
        console.log('   (This is normal if database migrations haven\'t been run yet)');
        result.changesDetected = false;
      }
    }

    return result;
  }

  private async executeWithSavedPath(task: Task, savedPath: ExecutionPath): Promise<SimplifiedResult> {
    const browser = new BrowserExecutor();
    
    try {
      // Initialize browser first
      await browser.initializeBrowser();
      
      // Navigate to the task URL
      await browser.navigate(task.url);
      
      const executor = new PathExecutor(browser);
      
      // Execute the saved path
      const result = await executor.executePath(savedPath);
      
      if (result.success) {
        console.log('✅ Successfully executed saved path\n');
        return {
          success: true,
          extractedData: result.extractedData,
          usedSavedPath: true,
          pathId: task.id
        };
      } else {
        // Path execution failed, delete it and try AI exploration
        console.log('❌ Saved path execution failed, deleting and retrying with AI...\n');
        await this.pathStorage.deletePath(task.id);
        return await this.exploreAndExecute(task);
      }
    } finally {
      await browser.close();
    }
  }

  private async exploreAndExecute(task: Task): Promise<SimplifiedResult> {
    const browser = new BrowserExecutor();
    const llm = createLLMFromEnv();
    const agent = new ReactAgent(browser, llm);
    
    try {
      // Use AI to explore and find a working path
      const explorationResult = await agent.explorePath(task);
      
      if (explorationResult.success && explorationResult.path.length > 0) {
        // Save the successful path for future use
        const executionPath: ExecutionPath = {
          taskId: task.id,
          steps: explorationResult.path,
          lastSuccessful: new Date()
        };
        
        await this.pathStorage.savePath(executionPath);
        console.log('💾 Saved successful execution path for future use\n');
        
        return {
          success: true,
          extractedData: explorationResult.extractedData,
          usedSavedPath: false,
          pathId: task.id
        };
      } else {
        return {
          success: false,
          error: explorationResult.error?.message || 'Failed to find working path',
          usedSavedPath: false
        };
      }
    } finally {
      await browser.close();
    }
  }

  async clearPath(taskId: string): Promise<void> {
    await this.pathStorage.deletePath(taskId);
    console.log(`🗑️ Cleared saved path for task: ${taskId}`);
  }

  async listSavedPaths(): Promise<string[]> {
    const paths = await this.pathStorage.getAllPaths();
    return paths.map(p => p.taskId);
  }

  private async handleMonitoringAndChangeDetection(
    task: Task, 
    extractedData: any, 
    executionId: string
  ): Promise<{ changesDetected: boolean; changeDetails?: any }> {
    console.log('💾 Saving monitoring data...');
    
    // Save current monitoring data
    await this.db.saveMonitoringData({
      taskId: task.id,
      url: task.url,
      extractedData,
      executionId
    });

    // Check for changes compared to previous execution
    const changeDetection = await this.db.detectChanges(task.id, extractedData);
    
    if (changeDetection) {
      changeDetection.executionId = executionId;
      await this.db.saveChangeDetection(changeDetection);
      
      console.log('🔍 Changes detected:', changeDetection.changedFields);
      if (changeDetection.isRestock) {
        console.log('🎉 RESTOCK DETECTED! Item appears to be back in stock!');
      }
      
      // Send notification for the changes
      await this.notifications.sendChangeNotification({
        taskId: task.id,
        url: task.url,
        changedFields: changeDetection.changedFields,
        changeDetails: changeDetection.changeDetails,
        isRestock: changeDetection.isRestock || false,
        timestamp: new Date()
      });
      
      return {
        changesDetected: true,
        changeDetails: changeDetection.changeDetails
      };
    } else {
      console.log('✅ No changes detected from previous execution');
      return { changesDetected: false };
    }
  }
}