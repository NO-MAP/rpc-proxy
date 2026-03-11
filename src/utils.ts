/**
 * Utility functions for RPC proxy
 */

import { SerializedError } from './types';

/**
 * Generate a unique correlation ID for RPC requests
 */
export function generateCorrelationId(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Serialize an error for transmission across processes
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }

  return {
    name: 'Error',
    message: String(error)
  };
}

/**
 * Deserialize an error received from another process
 */
export function deserializeError(serialized: SerializedError): Error {
  const error = new Error(serialized.message);
  error.name = serialized.name;
  error.stack = serialized.stack;

  if (serialized.code) {
    (error as any).code = serialized.code;
  }

  return error;
}

/**
 * Default logger implementation
 */
export function defaultLogger(message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[RPC-Proxy ${timestamp}]`, message, ...args);
}

/**
 * Validate if a value is a valid message object
 */
export function isValidMessage(msg: unknown): msg is Record<string, unknown> {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'id' in msg &&
    'type' in msg
  );
}

/**
 * Check if a message is a request message
 */
export function isRequestMessage(msg: Record<string, unknown>): msg is { id: string; method: string; args: unknown[] } {
  return (
    'method' in msg &&
    typeof msg.method === 'string' &&
    'args' in msg &&
    Array.isArray(msg.args)
  );
}

/**
 * Check if a message is a response message
 */
export function isResponseMessage(msg: Record<string, unknown>): msg is { id: string; result: unknown } {
  return 'result' in msg;
}

/**
 * Check if a message is an error message
 */
export function isErrorMessage(msg: Record<string, unknown>): msg is { id: string; error: SerializedError } {
  return (
    'error' in msg &&
    typeof msg.error === 'object' &&
    msg.error !== null &&
    'message' in msg.error
  );
}

/**
 * Check if a message is a notification message
 */
export function isNotificationMessage(msg: Record<string, unknown>): msg is { event: string; data: unknown } {
  return (
    'event' in msg &&
    typeof msg.event === 'string' &&
    'data' in msg
  );
}
