# node-ipc-rpc-proxy

A type-safe, async RPC proxy library for Node.js parent-child process communication using TypeScript interfaces and ES6 Proxy objects.

## Features

- **Type-Safe**: Full TypeScript support with interface-based type inference
- **Async/Await**: Promise-based API for intuitive async communication
- **Bidirectional**: Both parent and child can call each other's methods
- **Transparent Proxy**: Use remote methods as if they were local
- **Error Handling**: Automatic error serialization and propagation
- **Timeout Protection**: Configurable timeouts for RPC calls
- **Event Support**: Fire-and-forget notifications and event listeners
- **Zero Dependencies**: Lightweight implementation with no external dependencies

## Installation

```bash
npm install node-ipc-rpc-proxy
```

## Quick Start

### Basic Example

#### Define Shared Interface

```typescript
// interfaces.ts
export interface ParentAPI {
  showMessage(message: string): Promise<void>;
  getConfig(): Promise<{ apiKey: string; endpoint: string }>;
}

export interface ChildAPI {
  processData(data: string): Promise<string>;
  calculateHash(data: Buffer): Promise<string>;
}
```

#### Parent Process (parent.ts)

```typescript
import { fork } from 'child_process';
import { createParentRPC } from 'node-ipc-rpc-proxy';
import { ParentAPI } from './interfaces';

// Implement methods to expose to child
class ParentImpl implements ParentAPI {
  async showMessage(message: string): Promise<void> {
    console.log('Message from child:', message);
  }

  async getConfig(): Promise<{ apiKey: string; endpoint: string }> {
    return {
      apiKey: 'secret-key',
      endpoint: 'https://api.example.com'
    };
  }
}

// Fork child process and create RPC connection
const child = fork('./child.js');
const { childProxy } = createParentRPC<ChildAPI>(child, new ParentImpl());

// Call child's methods (fully typed!)
try {
  const result = await childProxy.processData('hello world');
  console.log('Result:', result); // 'HELLO WORLD'

  const hash = await childProxy.calculateHash(Buffer.from('data'));
  console.log('Hash:', hash);
} catch (error) {
  console.error('RPC error:', error);
}
```

#### Child Process (child.ts)

```typescript
import { createChildRPC } from 'node-ipc-rpc-proxy';
import { ChildAPI } from './interfaces';

// Implement methods to expose to parent
class ChildImpl implements ChildAPI {
  async processData(data: string): Promise<string> {
    return data.toUpperCase();
  }

  async calculateHash(data: Buffer): Promise<string> {
    // Simulate hash calculation
    return Buffer.from(data).toString('base64');
  }
}

// Create RPC connection with parent
const { parentProxy } = createChildRPC<ParentAPI>(new ChildImpl());

// Call parent's methods (fully typed!)
const config = await parentProxy.getConfig();
console.log('API Key:', config.apiKey);

await parentProxy.showMessage('Hello from child!');
```

## API Reference

### Parent Process API

#### `createParentRPC<T>(childProcess, implementation, options?)`

Create an RPC connection with a child process from the parent.

**Parameters:**
- `childProcess: ChildProcess` - The child process instance
- `implementation: T` - Object implementing methods to expose to the child
- `options?: RPCProxyOptions` - Optional configuration

**Returns:**
```typescript
{
  childProxy: Asyncify<T>  // Proxy to call child's methods
  destroy: () => void      // Clean up connection
  on: (event, handler) => void    // Register event listener
  off: (event, handler) => void   // Unregister event listener
  emit: (event, data) => void     // Send notification event
}
```

#### `forkAndCreateRPC<T>(modulePath, implementation, args?, options?)`

Convenience function that forks a child process and sets up RPC in one call.

**Parameters:**
- `modulePath: string` - Path to child process module
- `implementation: T` - Object implementing methods to expose
- `args?: string[]` - Arguments to pass to child process
- `options?: { rpcOptions?: RPCProxyOptions; execArgv?: string[]; ... }` - Options

**Example:**

```typescript
import { forkAndCreateRPC } from 'node-ipc-rpc-proxy';

const { child, childProxy } = forkAndCreateRPC(
  './worker.js',
  new ParentImpl(),
  ['--task', 'process-data'],
  {
    rpcOptions: { timeout: 10000, debug: true },
    execArgv: ['--max-old-space-size=4096']
  }
);

const result = await childProxy.doWork('data');
```

### Child Process API

#### `createChildRPC<T>(implementation, options?)`

Create an RPC connection with the parent process from the child.

**Parameters:**
- `implementation: T` - Object implementing methods to expose to the parent
- `options?: RPCProxyOptions` - Optional configuration

**Returns:**
```typescript
{
  parentProxy: Asyncify<T>  // Proxy to call parent's methods
  destroy: () => void       // Clean up connection
  on: (event, handler) => void    // Register event listener
  off: (event, handler) => void   // Unregister event listener
  emit: (event, data) => void     // Send notification event
}
```

### Configuration Options

```typescript
interface RPCProxyOptions {
  timeout?: number;       // Request timeout in milliseconds (default: 30000)
  debug?: boolean;        // Enable debug logging (default: false)
  errorHandler?: (error: Error, method: string, args: unknown[]) => void;
  logger?: (message: string, ...args: unknown[]) => void;
}
```

**Example:**

```typescript
const { childProxy } = createParentRPC(
  child,
  new ParentImpl(),
  {
    timeout: 5000,           // 5 second timeout
    debug: true,             // Enable debug logs
    errorHandler: (error, method) => {
      console.error(`RPC error in ${method}:`, error);
    }
  }
);
```

## Advanced Usage

### Event/Notification Pattern

Send events without waiting for a response:

```typescript
// Parent process
const { childProxy, on } = createParentRPC(child, new ParentImpl());

// Listen to child events
on('task-complete', (data) => {
  console.log('Child completed task:', data);
});

// Child process
const { parentProxy, emit } = createChildRPC(new ChildImpl());

// Send notification to parent
emit('task-complete', { taskId: 123, duration: 1000 });
```

### Error Handling

Errors are automatically serialized and propagated:

```typescript
// Child implementation
class ChildImpl {
  async processData(data: string): Promise<string> {
    if (!data) {
      throw new Error('Data cannot be empty');
    }
    return data.toUpperCase();
  }
}

// Parent process
try {
  const result = await childProxy.processData('');  // Throws error
} catch (error) {
  console.error('Child process error:', error.message);
  // Error: Data cannot be empty
  console.error('Stack:', error.stack);
}
```

### Timeout Handling

Set timeouts for long-running operations:

```typescript
const { childProxy } = createParentRPC(
  child,
  new ParentImpl(),
  { timeout: 5000 }  // 5 second timeout
);

try {
  const result = await childProxy.longRunningTask();
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Operation timed out');
  }
}
```

### Multiple Child Processes

Manage multiple workers:

```typescript
const workers = [];

for (let i = 0; i < 4; i++) {
  const { child, childProxy } = forkAndCreateRPC(
    './worker.js',
    new ParentImpl()
  );
  workers.push({ child, proxy: childProxy });
}

// Distribute work
const results = await Promise.all(
  workers.map(({ proxy }) => proxy.processTask(`task-${i}`))
);

// Cleanup
workers.forEach(({ child }) => child.kill());
```

### Type-Safe Interfaces

Define shared interfaces for full type safety:

```typescript
// shared.ts
export interface DatabaseAPI {
  query(sql: string): Promise<any[]>;
  insert(table: string, data: object): Promise<number>;
  update(table: string, id: number, data: object): Promise<boolean>;
  delete(table: string, id: number): Promise<boolean>;
}

export interface CacheAPI {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<boolean>;
}

// parent.ts
class DatabaseImpl implements DatabaseAPI {
  async query(sql: string): Promise<any[]> {
    // Database implementation
    return [];
  }
  // ... other methods
}

const { childProxy } = createParentRPC<CacheAPI>(child, new DatabaseImpl());
const value = await childProxy.get('user:123');  // Fully typed!
```

## Use Cases

- **Worker Pools**: Distribute CPU-intensive tasks across child processes
- **Service Isolation**: Run untrusted code in isolated processes
- **Resource Management**: Separate memory/CPU intensive operations
- **Microservices**: Inter-process communication within a Node.js application
- **Task Queues**: Process background jobs in child processes

## How It Works

1. **Interface Definition**: Define TypeScript interfaces for both parent and child APIs
2. **Implementation**: Implement the interfaces in their respective processes
3. **Proxy Creation**: Create proxy objects using `createParentRPC` or `createChildRPC`
4. **Method Calls**: Call methods through the proxy as if they were local
5. **Message Passing**: The library uses Node.js IPC (Inter-Process Communication) to pass messages
6. **Correlation**: Request/response correlation is handled automatically with unique IDs
7. **Type Safety**: TypeScript provides full type checking and autocomplete

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Parent Process                     │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌─────────────────┐  │
│  │ RPC Proxy    │         │ RPC Handlers    │  │
│  │ (calls child)│         │ (exposed to     │  │
│  │              │         │  child)         │  │
│  └──────┬───────┘         └────────┬────────┘  │
│         │                          │           │
│         └───────────┬──────────────┘           │
│                     │                          │
│              ┌──────▼────────┐                 │
│              │  RPC Core     │                 │
│              │  (correlation,│                 │
│              │   timeouts)   │                 │
│              └──────┬────────┘                 │
└─────────────────────┼──────────────────────────┘
                      │ IPC Channel
                      │ (process.send)
┌─────────────────────┼──────────────────────────┐
│                     │        Child Process      │
│              ┌──────▼────────┐                 │
│              │  RPC Core     │                 │
│              └──────┬────────┘                 │
│                     │                          │
│         ┌───────────┴──────────────┐           │
│         │                           │           │
│  ┌──────▼───────┐         ┌────────▼────────┐  │
│  │ RPC Handlers │         │  RPC Proxy      │  │
│  │ (exposed to  │         │  (calls parent) │  │
│  │  parent)     │         │                 │  │
│  └──────────────┘         └─────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Performance Considerations

- **Serialization**: Uses Node.js structured clone algorithm (faster than JSON)
- **Async/Await**: Non-blocking operations
- **Timeout Protection**: Prevents memory leaks from hanging requests
- **Connection Pooling**: Can manage multiple child processes efficiently

## Error Handling Best Practices

1. **Always use try-catch** when calling proxy methods
2. **Set appropriate timeouts** for your use case
3. **Handle disconnection** by listening to child process events
4. **Validate inputs** before passing to proxy methods
5. **Clean up connections** using the `destroy()` method

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Keywords

rpc, ipc, process, communication, typescript, proxy, async, type-safe, child-process, parent-child, inter-process
