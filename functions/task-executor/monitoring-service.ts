import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc } from 'drizzle-orm';
import { monitoringData, changeDetections } from '../../next/src/db/schema';
import { ChangeDetector } from './change-detector';
import { ChangeResult, HistoricalData } from './types';

export interface MonitoringResult {
  hasChanges: boolean;
  isRestock?: boolean;
  isFirstExecution?: boolean;
  changedFields?: string[];
}

export class MonitoringService {
  constructor(
    private db: ReturnType<typeof drizzle>,
    private changeDetector: ChangeDetector
  ) {}

  async storeExecutionData(data: {
    taskId: string;
    url: string;
    extractedData: any;
    executionId: string;
  }): Promise<void> {
    await this.db
      .insert(monitoringData)
      .values({
        taskId: data.taskId,
        url: data.url,
        extractedData: data.extractedData,
        executionId: data.executionId,
        timestamp: new Date()
      });
  }

  async getLastExecutionData(taskId: string): Promise<HistoricalData | null> {
    const results = await this.db
      .select()
      .from(monitoringData)
      .where(eq(monitoringData.taskId, taskId))
      .orderBy(desc(monitoringData.timestamp))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return {
      taskId: result.taskId,
      url: result.url,
      extractedData: result.extractedData,
      timestamp: result.timestamp,
      executionId: result.executionId || ''
    };
  }

  async processMonitoring(
    taskId: string,
    currentData: any,
    executionId: string
  ): Promise<MonitoringResult> {
    // Get the last execution data
    const previousData = await this.getLastExecutionData(taskId);

    // If no previous data, this is the first execution
    if (!previousData) {
      return {
        hasChanges: false,
        isFirstExecution: true
      };
    }

    // Compare current data with previous data
    const changeResult = this.changeDetector.hasChanged(
      previousData.extractedData,
      currentData
    );

    // If changes detected, store them
    if (changeResult.hasChanged) {
      await this.storeChanges(taskId, changeResult, executionId);
    }

    return {
      hasChanges: changeResult.hasChanged,
      isRestock: changeResult.isRestock,
      changedFields: changeResult.changedFields
    };
  }

  async storeChanges(
    taskId: string,
    changeResult: ChangeResult,
    executionId: string
  ): Promise<void> {
    await this.db
      .insert(changeDetections)
      .values({
        taskId,
        executionId,
        changedFields: changeResult.changedFields,
        isRestock: changeResult.isRestock || false,
        detectedAt: new Date()
      });
  }
}