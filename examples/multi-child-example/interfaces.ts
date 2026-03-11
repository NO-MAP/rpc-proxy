/**
 * Shared interfaces for multi-child process example
 */

export interface ParentAPI {
  logMessage(workerId: number, message: string): Promise<void>;
  getWorkerId(): Promise<number>;
}

export interface WorkerAPI {
  processTask(taskId: number, data: string): Promise<string>;
  getStatus(): Promise<string>;
}
