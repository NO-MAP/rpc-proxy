/**
 * RPC Proxy implementation using ES6 Proxy for transparent method invocation
 */

import { RPCCore } from './rpc-core';
import { RPCProxyOptions, Asyncify } from './types';

/**
 * Create an RPC proxy for calling remote methods
 *
 * @param rpcCore - The RPC core instance
 * @param interfaceClass - The interface class for type safety
 * @returns A proxy object that implements the interface
 */
export function createRPCProxy<T extends object>(
  rpcCore: RPCCore,
  _interfaceClass?: new () => T
): Asyncify<T> {
  return new Proxy({} as Asyncify<T>, {
    get(_target, prop: string) {
      // Return a function that sends an RPC request
      return async (...args: unknown[]): Promise<unknown> => {
        return rpcCore.sendRequest(prop, args);
      };
    }
  });
}

/**
 * Register implementation methods as RPC handlers
 *
 * @param rpcCore - The RPC core instance
 * @param implementation - The object implementing the RPC methods
 */
export function registerRPCHandlers<T extends object>(
  rpcCore: RPCCore,
  implementation: T
): void {
  const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(implementation));

  methodNames.forEach(methodName => {
    // Skip constructor and non-method properties
    if (methodName === 'constructor' || typeof (implementation as any)[methodName] !== 'function') {
      return;
    }

    const handler = (implementation as any)[methodName].bind(implementation);
    rpcCore.registerHandler(methodName, handler);
  });
}

/**
 * Create a bidirectional RPC connection
 *
 * @param port - The message port (ChildProcess or custom port)
 * @param implementation - Object implementing methods to expose to the other process
 * @param options - RPC configuration options
 * @returns An object with the proxy and methods to manage the connection
 */
export function createRPCConnection<T extends object>(
  port: any,
  implementation: T,
  options?: RPCProxyOptions
): {
  proxy: Asyncify<T>;
  core: RPCCore;
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data: any) => void;
} {
  const core = new RPCCore(port, options);

  // Register handlers for the implementation
  registerRPCHandlers(core, implementation);

  // Create proxy for calling remote methods
  const proxy = createRPCProxy<T>(core);

  return {
    proxy,
    core,
    destroy: () => core.destroy(),
    on: (event: string, handler: (...args: any[]) => void) => core.on(event, handler),
    off: (event: string, handler: (...args: any[]) => void) => core.off(event, handler),
    emit: (event: string, data: any) => core.emit(event, data)
  };
}

/**
 * Type guard to check if a value is a valid message port
 */
export function isValidMessagePort(port: unknown): port is import('./types').MessagePort {
  return (
    typeof port === 'object' &&
    port !== null &&
    'send' in port &&
    typeof (port as any).send === 'function' &&
    'on' in port &&
    typeof (port as any).on === 'function'
  );
}
