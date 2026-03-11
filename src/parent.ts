/**
 * Parent process utilities for RPC communication with child processes
 */

import { ChildProcess, fork } from 'child_process';
import { createRPCConnection } from './rpc-proxy';
import { RPCProxyOptions, Asyncify } from './types';

/**
 * Create an RPC connection with a child process
 *
 * This function creates a bidirectional RPC connection where:
 * - The parent exposes its implementation to the child (T)
 * - The parent receives a proxy to call child's methods (C)
 *
 * @param childProcess - The child process to communicate with
 * @param implementation - Object implementing methods to expose to the child
 * @param options - RPC configuration options
 * @returns A proxy object to call child's methods and control methods
 *
 * @example
 * ```typescript
 * // parent.ts
 * import { fork } from 'child_process';
 * import { createParentRPC } from 'node-ipc-rpc-proxy';
 *
 * // Define child's interface
 * interface ChildAPI {
 *   processData(data: string): Promise<string>;
 * }
 *
 * class ParentImpl {
 *   async showMessage(msg: string): Promise<void> {
 *     console.log('Message from child:', msg);
 *   }
 * }
 *
 * const child = fork('./child.js');
 * const { childProxy } = createParentRPC<ParentImpl, ChildAPI>(child, new ParentImpl());
 *
 * // Call child's method (fully typed!)
 * const result = await childProxy.processData('hello');
 * console.log(result); // 'HELLO'
 * ```
 */
export function createParentRPC<T extends object, C = any>(
  childProcess: ChildProcess,
  implementation: T,
  options?: RPCProxyOptions
): {
  childProxy: Asyncify<C>;
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data: any) => void;
} {
  // Create a message port adapter for child process
  const childPort = {
    send: (message: unknown) => {
      childProcess.send(message as any);
    },
    on: (event: string, listener: (...args: any[]) => void) => {
      childProcess.on(event as any, listener);
    },
    removeListener: (event: string, listener: (...args: any[]) => void) => {
      childProcess.removeListener(event as any, listener);
    }
  };

  const connection = createRPCConnection(childPort, implementation, options);

  return {
    childProxy: connection.proxy as unknown as Asyncify<C>,
    destroy: () => {
      connection.destroy();
      // Optionally kill the child process
      // childProcess.kill();
    },
    on: connection.on,
    off: connection.off,
    emit: connection.emit
  };
}

/**
 * Fork a child process and create an RPC connection
 *
 * This is a convenience function that combines forking a child process and setting up RPC.
 *
 * @param modulePath - Path to the child process module
 * @param implementation - Object implementing methods to expose to the child
 * @param args - Arguments to pass to the child process
 * @param options - Child process options and RPC options
 * @returns An object with the child process, proxy, and control methods
 *
 * @example
 * ```typescript
 * // parent.ts
 * import { forkAndCreateRPC } from 'node-ipc-rpc-proxy';
 *
 * class ParentImpl {
 *   async logMessage(msg: string): Promise<void> {
 *     console.log('Child says:', msg);
 *   }
 * }
 *
 * const { child, childProxy } = forkAndCreateRPC(
 *   './child.js',
 *   new ParentImpl(),
 *   ['--arg1', 'value1'],
 *   {
 *     rpcOptions: { timeout: 10000, debug: true },
 *     execArgv: ['--max-old-space-size=4096']
 *   }
 * );
 *
 * await childProxy.doWork('task1');
 * ```
 */
export function forkAndCreateRPC<T extends object, C = any>(
  modulePath: string,
  implementation: T,
  args: string[] = [],
  options?: {
    execArgv?: string[];
    silent?: boolean;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    rpcOptions?: RPCProxyOptions;
  }
): {
  child: ChildProcess;
  childProxy: Asyncify<C>;
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data: any) => void;
} {
  const forkOptions = {
    execArgv: options?.execArgv,
    silent: options?.silent,
    cwd: options?.cwd,
    env: options?.env
  };

  const child = fork(modulePath, args, forkOptions);
  const connection = createParentRPC<T, C>(child, implementation, options?.rpcOptions);

  return {
    child,
    childProxy: connection.childProxy,
    destroy: () => {
      connection.destroy();
      child.kill();
    },
    on: connection.on,
    off: connection.off,
    emit: connection.emit
  };
}

/**
 * Create a typed child proxy with interface
 *
 * @deprecated Use createParentRPC<T, C> directly with type parameters instead
 * @param childProcess - The child process to communicate with
 * @param implementation - Object implementing methods to expose to the child
 * @param childInterface - The child's interface class for type safety
 * @param options - RPC configuration options
 * @returns A typed proxy to call child's methods
 *
 * @example
 * ```typescript
 * // shared.ts
 * export interface ChildAPI {
 *   processData(data: string): Promise<string>;
 *   calculateHash(data: Buffer): Promise<string>;
 * }
 *
 * // parent.ts
 * import { fork, createChildRPCProxy, ChildAPI } from './shared';
 *
 * class ParentImpl {
 *   async log(msg: string): Promise<void> {
 *     console.log(msg);
 *   }
 * }
 *
 * const child = fork('./child.js');
 * const childProxy = createChildRPCProxy<ParentImpl, ChildAPI>(child, new ParentImpl());
 *
 * const hash = await childProxy.calculateHash(Buffer.from('data'));
 * ```
 */
export function createChildRPCProxy<TParentImpl extends object, TChildAPI extends object>(
  childProcess: ChildProcess,
  implementation: TParentImpl,
  options?: RPCProxyOptions
): Asyncify<TChildAPI> {
  const { childProxy } = createParentRPC<TParentImpl, TChildAPI>(childProcess, implementation, options);
  return childProxy;
}
