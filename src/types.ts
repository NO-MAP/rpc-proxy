/**
 * Core type definitions for the RPC proxy library
 */

/**
 * RPC message types for communication between processes
 */
export enum MessageType {
  Request = 'request',
  Response = 'response',
  Error = 'error',
  Notification = 'notification'
}

/**
 * Serialized error that can be sent across processes
 */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

/**
 * Base RPC message structure
 */
export interface BaseMessage {
  id: string;
  type: MessageType;
}

/**
 * Request message sent from caller to handler
 */
export interface RequestMessage extends BaseMessage {
  type: MessageType.Request;
  method: string;
  args: unknown[];
}

/**
 * Response message sent back to caller
 */
export interface ResponseMessage extends BaseMessage {
  type: MessageType.Response;
  result: unknown;
}

/**
 * Error message sent back when handler throws
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.Error;
  error: SerializedError;
}

/**
 * Notification message (fire-and-forget, no response)
 */
export interface NotificationMessage extends BaseMessage {
  type: MessageType.Notification;
  event: string;
  data: unknown;
}

/**
 * Union type of all possible RPC messages
 */
export type RPCMessage = RequestMessage | ResponseMessage | ErrorMessage | NotificationMessage;

/**
 * Represents a pending request waiting for response
 */
export interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  timestamp: number;
}

/**
 * Configuration options for RPC proxy
 */
export interface RPCProxyOptions {
  /**
   * Default timeout for RPC calls in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;

  /**
   * Custom error handler for RPC errors
   */
  errorHandler?: (error: Error, method: string, args: unknown[]) => void;

  /**
   * Custom logger function
   */
  logger?: (message: string, ...args: unknown[]) => void;
}

/**
 * Interface for objects that can send and receive messages
 */
export interface MessagePort {
  send(message: unknown): void;
  on(event: 'message', listener: (message: unknown) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'disconnect' | 'exit', listener: () => void): void;
  removeListener(event: 'message', listener: (message: unknown) => void): void;
  removeListener(event: 'error', listener: (error: Error) => void): void;
  removeListener(event: 'disconnect' | 'exit', listener: () => void): void;
}

/**
 * Convert a method to async, avoiding double-wrapping if it already returns Promise
 */
export type AsyncMethod<T> = T extends (...args: infer A) => infer R
  ? R extends Promise<any>
    ? T  // Already returns Promise, don't wrap again
    : (...args: A) => Promise<R>
  : never;

/**
 * Convert all methods in an interface to async methods
 * Skips methods that already return Promise to avoid double-wrapping
 */
export type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? AsyncMethod<T[K]>
    : T[K];
};

/**
 * Extract method names from an interface
 */
export type MethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Event handler map for notifications
 */
export type EventHandlerMap = Record<string, Set<(...args: any[]) => void>>;
