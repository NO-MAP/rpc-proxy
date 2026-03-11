# Simple Example

This example demonstrates basic parent-child process communication using `node-ipc-rpc-proxy`.

## Prerequisites

Build the library first:

```bash
cd ../..
npm run build
```

## Running the Example

In one terminal, run the parent:

```bash
npm run build
node dist/examples/simple-example/parent.js
```

## What It Demonstrates

1. **Bidirectional Communication**: Both parent and child can call each other's methods
2. **Type Safety**: Full TypeScript support with interface definitions
3. **Async/Await**: Promise-based API for intuitive async operations
4. **Error Handling**: Automatic error propagation
5. **Event Notifications**: Fire-and-forget events from child to parent

## File Structure

- `interfaces.ts` - Shared TypeScript interfaces
- `parent.ts` - Parent process implementation
- `child.ts` - Child process implementation

## Expected Output

You should see both parent and child processes calling each other's methods with full type safety and async/await support.
