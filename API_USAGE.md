# API 使用说明

## 核心概念

`node-ipc-rpc-proxy` 提供了**类型安全的父子进程 RPC 通信**。设计理念是：

1. **简单函数**：`createParentRPC` 和 `createChildRPC` 返回未类型化的 `any` proxy
2. **类型断言**：使用 TypeScript 的 `as Asyncify<Interface>` 进行类型断言
3. **完全类型安全**：获得完整的 TypeScript 类型检查和自动完成

## 基本用法

### 1. 定义接口

```typescript
// interfaces.ts
export interface ParentAPI {
  logMessage(message: string): Promise<void>;
  getConfig(): Promise<{ apiKey: string }>;
}

export interface ChildAPI {
  processData(data: string): Promise<string>;
  calculateHash(data: Buffer): Promise<string>;
}
```

### 2. 父进程实现

```typescript
// parent.ts
import { fork } from 'child_process';
import { createParentRPC, Asyncify } from 'node-ipc-rpc-proxy';
import { ParentAPI, ChildAPI } from './interfaces';

// 实现父进程暴露给子进程的方法
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

  // 创建 RPC 连接
  const conn = createParentRPC(child, new ParentImpl(), {
    debug: true,
    timeout: 10000
  });

  // 使用类型断言获得完全的类型安全
  const childProxy = conn.childProxy as Asyncify<ChildAPI>;

  // 现在可以完全类型安全地调用子进程的方法
  const result = await childProxy.processData('hello');
  //          ^? 类型是 Promise<string>

  const hash = await childProxy.calculateHash(Buffer.from('data'));
  //         ^? 类型是 Promise<string>
}

main();
```

### 3. 子进程实现

```typescript
// child.ts
import { createChildRPC, Asyncify } from 'node-ipc-rpc-proxy';
import { ChildAPI, ParentAPI } from './interfaces';

// 实现子进程暴露给父进程的方法
class ChildImpl implements ChildAPI {
  async processData(data: string): Promise<string> {
    return data.toUpperCase();
  }

  async calculateHash(data: Buffer): Promise<string> {
    return data.toString('base64');
  }
}

async function main() {
  // 创建 RPC 连接
  const conn = createChildRPC(new ChildImpl(), {
    debug: true,
    timeout: 10000
  });

  // 使用类型断言获得完全的类型安全
  const parentProxy = conn.parentProxy as Asyncify<ParentAPI>;

  // 现在可以完全类型安全地调用父进程的方法
  const config = await parentProxy.getConfig();
  //           ^? 类型是 Promise<{ apiKey: string }>

  await parentProxy.logMessage('Hello from child!');
}

main();
```

## API 参考

### createParentRPC

创建父进程到子进程的 RPC 连接。

```typescript
function createParentRPC<T extends object>(
  childProcess: ChildProcess,
  implementation: T,        // 父进程暴露给子进程的实现
  options?: RPCProxyOptions
): {
  childProxy: any;          // 调用子进程方法的 proxy（未类型化）
  destroy: () => void;      // 清理连接
  on: (event, handler) => void;
  off: (event, handler) => void;
  emit: (event, data) => void;
}
```

### createChildRPC

创建子进程到父进程的 RPC 连接。

```typescript
function createChildRPC<T extends object>(
  implementation: T,        // 子进程暴露给父进程的实现
  options?: RPCProxyOptions
): {
  parentProxy: any;         // 调用父进程方法的 proxy（未类型化）
  destroy: () => void;      // 清理连接
  on: (event, handler) => void;
  off: (event, handler) => void;
  emit: (event, data) => void;
}
```

### Asyncify<T>

类型工具，将接口的所有方法转换为异步方法。

```typescript
type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
}
```

## 为什么这样设计？

### 优点

1. **灵活性**：返回 `any` 允许用户自由地类型断言为任何接口
2. **简洁性**：不需要传递接口构造函数作为参数
3. **类型安全**：通过 `as Asyncify<Interface>` 获得完整的类型检查
4. **直观性**：API 简单直接，易于理解

### 对比其他方案

```typescript
// ❌ 方案 1: 需要传递接口构造函数（繁琐）
const proxy = createRPCProxy(impl, ParentAPI);

// ❌ 方案 2: 使用泛型参数（类型推断问题）
const proxy = createRPCProxy<ChildAPI, ParentAPI>(impl);

// ✅ 方案 3: 返回 any + 类型断言（当前方案）
const conn = createChildRPC(impl);
const proxy = conn.parentProxy as Asyncify<ParentAPI>;
```

## 完整示例

查看 [examples/simple-example](./examples/simple-example/) 获取完整的工作示例。

## 类型安全演示

```typescript
// 定义接口
interface MyAPI {
  getData(id: string): Promise<{ name: string }>;
  process(item: number): Promise<boolean>;
}

// 创建 proxy
const conn = createParentRPC(child, impl);
const proxy = conn.childProxy as Asyncify<MyAPI>;

// ✅ 完全类型安全
const data = await proxy.getData('123');
//    ^? 类型是 { name: string }

// ✅ 参数类型检查
await proxy.process(42);    // OK
await proxy.process('abc'); // ❌ 编译错误: string 不能赋值给 number

// ✅ 自动完成
// 输入 proxy. 时，IDE 会显示 getData 和 process
```

## 总结

- 使用 `createParentRPC` / `createChildRPC` 创建连接
- 使用 `as Asyncify<Interface>` 进行类型断言
- 获得完整的 TypeScript 类型安全！
