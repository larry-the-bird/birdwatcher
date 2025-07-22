import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../../../next/src/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { Task } from '../../types';

interface ExecutionResult {
  taskId: string;
  planId?: string;
  status: 'success' | 'failed' | 'timeout' | 'error';
  result?: any;
  logs?: any;
  errorMessage?: string;
  executionTime?: number;
}

interface MonitoringData {
  taskId: string;
  url: string;
  extractedData: any;
  executionId?: string;
}

interface ChangeDetection {
  taskId: string;
  executionId: string;
  changedFields: string[];
  changeDetails?: any;
  isRestock?: boolean;
}

export class DatabaseService {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    const client = postgres(process.env.DATABASE_URL);
    this.db = drizzle(client, { schema });
  }

  async saveExecutionResult(data: ExecutionResult): Promise<string> {
    const [result] = await this.db.insert(schema.executionResults).values({
      taskId: data.taskId,
      planId: data.planId,
      status: data.status,
      result: data.result,
      logs: data.logs,
      errorMessage: data.errorMessage,
      executionTime: data.executionTime,
    }).returning({ id: schema.executionResults.id });
    
    return result.id;
  }

  async saveMonitoringData(data: MonitoringData): Promise<void> {
    await this.db.insert(schema.monitoringData).values({
      taskId: data.taskId,
      url: data.url,
      extractedData: data.extractedData,
      executionId: data.executionId,
    });
  }

  async getLatestMonitoringData(taskId: string): Promise<any> {
    const [latest] = await this.db
      .select()
      .from(schema.monitoringData)
      .where(eq(schema.monitoringData.taskId, taskId))
      .orderBy(desc(schema.monitoringData.timestamp))
      .limit(1);
      
    return latest?.extractedData || null;
  }

  async detectChanges(taskId: string, currentData: any): Promise<ChangeDetection | null> {
    const previousData = await this.getLatestMonitoringData(taskId);
    
    if (!previousData) {
      return null; // No previous data to compare
    }

    const changedFields: string[] = [];
    const changeDetails: any = {};
    
    // Simple field comparison
    for (const [key, value] of Object.entries(currentData)) {
      if (JSON.stringify(previousData[key]) !== JSON.stringify(value)) {
        changedFields.push(key);
        changeDetails[key] = {
          from: previousData[key],
          to: value
        };
      }
    }

    if (changedFields.length === 0) {
      return null; // No changes detected
    }

    // Detect restock scenario (when something becomes available)
    const isRestock = this.detectRestock(previousData, currentData);

    return {
      taskId,
      executionId: '', // Will be set by caller
      changedFields,
      changeDetails,
      isRestock
    };
  }

  async saveChangeDetection(data: ChangeDetection): Promise<void> {
    await this.db.insert(schema.changeDetections).values({
      taskId: data.taskId,
      executionId: data.executionId,
      changedFields: data.changedFields,
      changeDetails: data.changeDetails,
      isRestock: data.isRestock,
    });
  }

  private detectRestock(previous: any, current: any): boolean {
    // Common restock patterns
    const restockIndicators = [
      'availability',
      'inStock', 
      'available',
      'quantity',
      'stock'
    ];

    for (const indicator of restockIndicators) {
      const prevValue = previous[indicator];
      const currValue = current[indicator];
      
      // Check if item became available
      if (
        (prevValue === false && currValue === true) ||
        (prevValue === 'out of stock' && currValue === 'in stock') ||
        (typeof prevValue === 'number' && prevValue === 0 && typeof currValue === 'number' && currValue > 0)
      ) {
        return true;
      }
    }

    return false;
  }

  async getTask(taskId: string): Promise<Task | null> {
    const [task] = await this.db
      .select()
      .from(schema.todo)
      .where(eq(schema.todo.id, taskId))
      .limit(1);

    if (!task) return null;

    return {
      id: task.id,
      url: task.url,
      instruction: task.instruction
    };
  }

  async ensureTaskExists(task: Task): Promise<void> {
    // Check if task already exists
    const existingTask = await this.getTask(task.id);
    
    if (!existingTask) {
      // Create the task in the database
      await this.db.insert(schema.todo).values({
        id: task.id,
        creatorId: 'system', // Default creator for automated tasks
        name: `Automated Task: ${task.id}`,
        instruction: task.instruction,
        url: task.url,
        cron: '0 */6 * * *', // Default to every 6 hours
        isActive: true
      });
      
      console.log(`📋 Created task in database: ${task.id}`);
    }
  }
}