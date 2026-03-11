/**
 * node-ipc-rpc-proxy
 *
 * A type-safe, async RPC proxy library for Node.js parent-child process communication
 */

// Export core types
export * from './types';

// Export core RPC implementation
export { RPCCore } from './rpc-core';

// Export proxy creation functions
export { createRPCProxy, registerRPCHandlers, createRPCConnection, isValidMessagePort } from './rpc-proxy';

// Export parent process utilities
export { createParentRPC, forkAndCreateRPC, createChildRPCProxy as createParentChildProxy } from './parent';

// Export child process utilities
export { createChildRPC, createChildRPCProxy } from './child';

// Export utilities
export * from './utils';
