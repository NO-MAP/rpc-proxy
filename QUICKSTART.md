# Quick Start Guide

## Installation & Build

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Library is now ready to use!
```

## Simple Usage Example

### Step 1: Define Interfaces

Create a shared file `interfaces.ts`:

```typescript
export interface ParentAPI {
  logMessage(message: string): Promise<void>;
  getConfig(): Promise<{ apiKey: string }>;
}

export interface ChildAPI {
  processData(data: string): Promise<string>;
  calculate(data: number): Promise<number>;
}
```

### Step 2: Create Parent Process

Create `parent.ts`:

```typescript
import { fork } from 'child_process';
import { createParentRPC } from './src/index';
import { ParentAPI, ChildAPI } from './interfaces';

class ParentImpl implements ParentAPI {
  async logMessage(message: string): Promise<void> {
    console.log('Parent received:', message);
  }

  async getConfig(): Promise<{ apiKey: string }> {
    return { apiKey: 'secret-123' };
  }
}

async function main() {
  const child = fork('./child.js');
  const { childProxy } = createParentRPC<ChildAPI>(child, new ParentImpl());

  // Call child's methods
  const result = await childProxy.processData('hello');
  console.log('Result:', result); // 'HELLO'

  const calc = await childProxy.calculate(42);
  console.log('Calculated:', calc);
}

main();
```

### Step 3: Create Child Process

Create `child.ts`:

```typescript
import { createChildRPC } from './src/index';
import { ChildAPI, ParentAPI } from './interfaces';

class ChildImpl implements ChildAPI {
  async processData(data: string): Promise<string> {
    return data.toUpperCase();
  }

  async calculate(data: number): Promise<number> {
    return data * 2;
  }
}

async function main() {
  const { parentProxy } = createChildRPC<ParentAPI>(new ChildImpl());

  // Call parent's methods
  await parentProxy.logMessage('Hello from child!');

  const config = await parentProxy.getConfig();
  console.log('API Key:', config.apiKey);
}

main();
```

### Step 4: Build and Run

```bash
# Build TypeScript
npm run build

# Run parent process (will automatically spawn child)
node dist/parent.js
```

## That's It!

You now have:
- ✅ Type-safe RPC communication
- ✅ Bidirectional method calls
- ✅ Async/await support
- ✅ Automatic error handling
- ✅ Full TypeScript type checking

## Next Steps

- Check out [examples/simple-example](./examples/simple-example/) for a complete working example
- Read the full [README.md](./README.md) for advanced features
- Explore timeout configuration, event handling, and more!
