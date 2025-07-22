import { ExecutionPath } from '../../types';
import { promises as fs } from 'fs';
import * as path from 'path';

export class PathStorage {
  private storageDir: string;
  private paths: Map<string, ExecutionPath>;

  constructor(storageDir: string = './execution-paths') {
    this.storageDir = storageDir;
    this.paths = new Map();
    this.ensureStorageDir();
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  async savePath(executionPath: ExecutionPath): Promise<void> {
    this.paths.set(executionPath.taskId, executionPath);
    
    // Also persist to file for durability
    try {
      const filePath = path.join(this.storageDir, `${executionPath.taskId}.json`);
      await fs.writeFile(filePath, JSON.stringify(executionPath, null, 2));
      console.log(`✅ Saved execution path for task: ${executionPath.taskId}`);
      console.log(`📁 Path saved to: ${path.resolve(filePath)}`);
    } catch (error) {
      console.error('Failed to save path to file:', error);
    }
  }

  async getPath(taskId: string): Promise<ExecutionPath | null> {
    // Check in-memory cache first
    if (this.paths.has(taskId)) {
      return this.paths.get(taskId)!;
    }

    // Try to load from file
    try {
      const filePath = path.join(this.storageDir, `${taskId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      const executionPath = JSON.parse(data) as ExecutionPath;
      
      // Restore Date object
      executionPath.lastSuccessful = new Date(executionPath.lastSuccessful);
      
      // Cache in memory
      this.paths.set(taskId, executionPath);
      
      return executionPath;
    } catch (error) {
      // File doesn't exist or is corrupted
      return null;
    }
  }

  async deletePath(taskId: string): Promise<void> {
    this.paths.delete(taskId);
    
    try {
      const filePath = path.join(this.storageDir, `${taskId}.json`);
      await fs.unlink(filePath);
      console.log(`🗑️ Deleted execution path for task: ${taskId}`);
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  async getAllPaths(): Promise<ExecutionPath[]> {
    const allPaths: ExecutionPath[] = [];
    
    try {
      const files = await fs.readdir(this.storageDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const taskId = file.replace('.json', '');
        const path = await this.getPath(taskId);
        if (path) {
          allPaths.push(path);
        }
      }
    } catch (error) {
      console.error('Failed to read paths directory:', error);
    }
    
    return allPaths;
  }

  async loadAllPaths(): Promise<void> {
    const paths = await this.getAllPaths();
    console.log(`📂 Loaded ${paths.length} execution paths from storage`);
  }
}