/**
 * Shared interfaces for parent-child communication
 */

export interface ParentAPI {
  showMessage(message: string): Promise<void>;
  getConfig(): Promise<{ apiKey: string; endpoint: string }>;
  addNumbers(a: number, b: number): Promise<number>;
}

export interface ChildAPI {
  processData(data: string): Promise<string>;
  calculateHash(data: Buffer): Promise<string>;
  greet(name: string): Promise<string>;
}
