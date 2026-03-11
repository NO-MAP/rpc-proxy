/**
 * Child process utilities for RPC communication
 */

import { createRPCConnection } from './rpc-proxy';
import { RPCProxyOptions, Asyncify } from './types';

/**
 * Create an RPC connection in a child process to communicate with parent
 *
 * This function creates a bidirectional RPC connection where:
 * - The child exposes its implementation to the parent (T)
 * - The child receives a proxy to call parent's methods (P)
 *
 * @param implementation - Object implementing methods to expose to the parent
 * @param options - RPC configuration options
 * @returns A proxy object to call parent's methods and control methods
 *
 * @example
 * ```typescript
 * // child.ts
 * import { createChildRPC } from 'node-ipc-rpc-proxy';
 *
 * // Define parent's interface
 * interface ParentAPI {
 *   showMessage(msg: string): Promise<void>;
 *   getConfig(): Promise<Config>;
 * }
 *
 * class ChildImpl {
 *   async getData(id: string): Promise<string> {
 *     return `Data for ${id}`;
 *   }
 * }
 *
 * const { parentProxy } = createChildRPC<ChildImpl, ParentAPI>(new ChildImpl());
 *
 * // Call parent's method (fully typed!)
 * await parentProxy.showMessage('Hello from child!');
 * ```
 */
export function createChildRPC<T extends object, P = any>(
  implementation: T,
  options?: RPCProxyOptions
): {
  parentProxy: Asyncify<P>;
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data: any) => void;
} {
  if (!process.send) {
    throw new Error('createChildRPC can only be used in a child process with IPC enabled');
  }

  // Create a message port adapter for process
  const processPort = {
    send: (message: unknown) => {
      process.send!(message);
    },
    on: (event: string, listener: (...args: any[]) => void) => {
      process.on(event as any, listener);
    },
    removeListener: (event: string, listener: (...args: any[]) => void) => {
      process.removeListener(event as any, listener);
    }
  };

  const connection = createRPCConnection(processPort, implementation, options);

  return {
    parentProxy: connection.proxy as unknown as Asyncify<P>,
    destroy: connection.destroy,
    on: connection.on,
    off: connection.off,
    emit: connection.emit
  };
}

/**
 * Create a typed parent proxy with interface
 *
 * @deprecated Use createChildRPC<T, P> directly with type parameters instead
 * @param implementation - Object implementing methods to expose to the parent
 * @param options - RPC configuration options
 * @returns A typed proxy to call parent's methods
 *
 * @example
 * ```typescript
 * // shared.ts
 * export interface ParentAPI {
 *   showMessage(msg: string): Promise<void>;
 *   getConfig(): Promise<Config>;
 * }
 *
 * // child.ts
 * import { createChildRPCProxy, ParentAPI } from './shared';
 *
 * class ChildImpl {
 *   async processData(data: string): Promise<string> {
 *     return data.toUpperCase();
 *   }
 * }
 *
 * const parentProxy = createChildRPCProxy<ChildImpl, ParentAPI>(new ChildImpl());
 * await parentProxy.showMessage('Hello!');
 * ```
 */
export function createChildRPCProxy<TChildImpl extends object, TParentAPI extends object>(
  implementation: TChildImpl,
  options?: RPCProxyOptions
): Asyncify<TParentAPI> {
  const { parentProxy } = createChildRPC<TChildImpl, TParentAPI>(implementation, options);
  return parentProxy;
}
