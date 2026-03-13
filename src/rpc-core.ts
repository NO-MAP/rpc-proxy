/**
 * Core RPC implementation with message correlation and handling
 */

import {
  RPCMessage,
  MessageType,
  PendingRequest,
  RPCProxyOptions,
  MessagePort
} from './types';
import {
  generateCorrelationId,
  serializeError,
  deserializeError,
  defaultLogger,
  isValidMessage,
  isRequestMessage,
  isResponseMessage,
  isErrorMessage,
  isNotificationMessage
} from './utils';

/**
 * Core RPC class that handles message correlation and routing
 */
export class RPCCore {
  private pendingRequests = new Map<string, PendingRequest>();
  private messageHandlers = new Map<string, (...args: any[]) => any>();
  private notificationHandlers = new Map<string, Set<(...args: any[]) => void>>();
  private isListening = false;
  private boundMessageHandler: (msg: unknown) => void;
  private boundErrorHandler: (error: Error) => void;
  private boundDisconnectHandler: () => void;

  constructor(
    private port: MessagePort,
    private options: RPCProxyOptions = {}
  ) {
    const {
      timeout = 30000,
      debug = false,
      logger = defaultLogger
    } = options;

    this.options = { timeout, debug, logger };

    this.boundMessageHandler = this.handleMessage.bind(this);
    this.boundErrorHandler = this.handlePortError.bind(this);
    this.boundDisconnectHandler = this.handleDisconnect.bind(this);

    this.setupListeners();
  }

  /**
   * Set up event listeners for the message port
   */
  private setupListeners(): void {
    if (!this.isListening) {
      this.port.on('message', this.boundMessageHandler);
      this.port.on('error', this.boundErrorHandler);
      this.port.on('disconnect', this.boundDisconnectHandler);
      this.port.on('exit', this.boundDisconnectHandler);
      this.isListening = true;
    }
  }

  /**
   * Remove event listeners
   */
  private removeListeners(): void {
    if (this.isListening) {
      this.port.removeListener('message', this.boundMessageHandler);
      this.port.removeListener('error', this.boundErrorHandler);
      this.port.removeListener('disconnect', this.boundDisconnectHandler);
      this.port.removeListener('exit', this.boundDisconnectHandler);
      this.isListening = false;
    }
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.options.debug && this.options.logger) {
      this.options.logger(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Handle incoming messages from the other process
   */
  private async handleMessage(msg: unknown): Promise<void> {
    try {
      if (!isValidMessage(msg)) {
        this.log('Invalid message received:', msg);
        return;
      }

      const { id, type } = msg;

      switch (type) {
        case MessageType.Request:
          await this.handleRequest(id as string, msg);
          break;

        case MessageType.Response:
          this.handleResponse(id as string, msg);
          break;

        case MessageType.Error:
          this.handleError(id as string, msg);
          break;

        case MessageType.Notification:
          this.handleNotification(msg);
          break;

        default:
          this.log('Unknown message type:', type);
      }
    } catch (error) {
      this.log('Error handling message:', error);
    }
  }

  /**
   * Handle incoming RPC requests
   */
  private async handleRequest(id: string, msg: Record<string, unknown>): Promise<void> {
    if (!isRequestMessage(msg)) {
      this.log('Invalid request message:', msg);
      return;
    }

    const { method, args } = msg;
    this.log(`Received request for method: ${method}`);

    try {
      const handler = this.messageHandlers.get(method);
      if (!handler) {
        throw new Error(`No handler registered for method: ${method}`);
      }

      const result = await handler(...args);
      this.sendResponse(id, result);
    } catch (error) {
      this.sendError(id, error as Error);
    }
  }

  /**
   * Handle incoming RPC responses
   */
  private handleResponse(id: string, msg: Record<string, unknown>): void {
    if (!isResponseMessage(msg)) {
      this.log('Invalid response message:', msg);
      return;
    }

    const pending = this.pendingRequests.get(id);
    if (!pending) {
      this.log(`No pending request found for id: ${id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);
    // result may be undefined or missing (if serialized as undefined)
    pending.resolve('result' in msg ? msg.result : undefined);
  }

  /**
   * Handle incoming error messages
   */
  private handleError(id: string, msg: Record<string, unknown>): void {
    if (!isErrorMessage(msg)) {
      this.log('Invalid error message:', msg);
      return;
    }

    const pending = this.pendingRequests.get(id);
    if (!pending) {
      this.log(`No pending request found for id: ${id}`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);
    pending.reject(deserializeError(msg.error));
  }

  /**
   * Handle notification messages
   */
  private handleNotification(msg: Record<string, unknown>): void {
    if (!isNotificationMessage(msg)) {
      this.log('Invalid notification message:', msg);
      return;
    }

    const { event, data } = msg;
    this.log(`Received notification for event: ${event}`);

    const handlers = this.notificationHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Error in notification handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle errors from the message port
   */
  private handlePortError(error: Error): void {
    this.log('Message port error:', error);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.log('Message port disconnected');

    // Reject all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('RPC connection closed'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Send a response message
   */
  private sendResponse(id: string, result: unknown): void {
    const message: RPCMessage = {
      id,
      type: MessageType.Response,
      result
    };
    this.port.send(message);
  }

  /**
   * Send an error message
   */
  private sendError(id: string, error: Error): void {
    const message: RPCMessage = {
      id,
      type: MessageType.Error,
      error: serializeError(error)
    };
    this.port.send(message);
  }

  /**
   * Register a handler for a specific method
   */
  public registerHandler(method: string, handler: (...args: any[]) => any): void {
    this.messageHandlers.set(method, handler);
    this.log(`Registered handler for method: ${method}`);
  }

  /**
   * Unregister a handler
   */
  public unregisterHandler(method: string): void {
    this.messageHandlers.delete(method);
    this.log(`Unregistered handler for method: ${method}`);
  }

  /**
   * Register a notification event handler
   */
  public on(event: string, handler: (...args: any[]) => void): void {
    if (!this.notificationHandlers.has(event)) {
      this.notificationHandlers.set(event, new Set());
    }
    this.notificationHandlers.get(event)!.add(handler);
    this.log(`Registered handler for event: ${event}`);
  }

  /**
   * Unregister a notification event handler
   */
  public off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.notificationHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.notificationHandlers.delete(event);
      }
    }
    this.log(`Unregistered handler for event: ${event}`);
  }

  /**
   * Emit a notification event
   */
  public emit(event: string, data: unknown): void {
    const message: RPCMessage = {
      id: generateCorrelationId(),
      type: MessageType.Notification,
      event,
      data
    };
    this.port.send(message);
  }

  /**
   * Send an RPC request and wait for response
   */
  public async sendRequest(method: string, args: unknown[]): Promise<unknown> {
    const id = generateCorrelationId();
    const timeout = this.options.timeout || 30000;

    this.log(`Sending request for method: ${method}, id: ${id}`);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`RPC timeout: ${method} (timeout: ${timeout}ms)`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutId,
        timestamp: Date.now()
      });

      const message: RPCMessage = {
        id,
        type: MessageType.Request,
        method,
        args
      };

      this.port.send(message);
    });
  }

  /**
   * Clean up and close the RPC connection
   */
  public destroy(): void {
    this.removeListeners();
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('RPC connection destroyed'));
    });
    this.pendingRequests.clear();
    this.messageHandlers.clear();
    this.notificationHandlers.clear();
  }
}
