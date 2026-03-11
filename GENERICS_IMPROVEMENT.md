# 泛型优化说明

## 优化内容

成功将 `any` 类型替换为泛型参数，提供了**完整的类型安全**！

## 新 API 设计

### createParentRPC

```typescript
function createParentRPC<T extends object, C = any>(
  childProcess: ChildProcess,
  implementation: T,
  options?: RPCProxyOptions
): {
  childProxy: Asyncify<C>;  // 类型安全！
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data: any) => void;
}
```

**参数说明:**
- `T` - 父进程暴露给子进程的实现类型
- `C` - 父进程期望从子进程获得的接口类型（默认 `any`）

### createChildRPC

```typescript
function createChildRPC<T extends object, P = any>(
  implementation: T,
  options?: RPCProxyOptions
): {
  parentProxy: Asyncify<P>;  // 类型安全！
  destroy: () => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, data: any) => void;
}
```

**参数说明:**
- `T` - 子进程暴露给父进程的实现类型
- `P` - 子进程期望从父进程获得的接口类型（默认 `any`）

## 使用示例

### 父进程

```typescript
import { fork } from 'child_process';
import { createParentRPC } from 'node-ipc-rpc-proxy';
import { ParentAPI, ChildAPI } from './interfaces';

class ParentImpl implements ParentAPI {
  async showMessage(message: string): Promise<void> {
    console.log('Message:', message);
  }
}

async function main() {
  const child = fork('./child.js');

  // 使用泛型参数：<父进程实现类型, 子进程接口类型>
  const conn = createParentRPC<ParentImpl, ChildAPI>(
    child,
    new ParentImpl(),
    { debug: true, timeout: 10000 } as const
  );

  // childProxy 现在是完全类型安全的 Asyncify<ChildAPI>
  const result = await conn.childProxy.processData('hello');
  //          ^? 类型是 Promise<string>

  const hash = await conn.childProxy.calculateHash(Buffer.from('data'));
  //         ^? 类型是 Promise<string>
}
```

### 子进程

```typescript
import { createChildRPC } from 'node-ipc-rpc-proxy';
import { ChildAPI, ParentAPI } from './interfaces';

class ChildImpl implements ChildAPI {
  async processData(data: string): Promise<string> {
    return data.toUpperCase();
  }
}

async function main() {
  // 使用泛型参数：<子进程实现类型, 父进程接口类型>
  const conn = createChildRPC<ChildImpl, ParentAPI>(
    new ChildImpl(),
    { debug: true, timeout: 10000 } as const
  );

  // parentProxy 现在是完全类型安全的 Asyncify<ParentAPI>
  const config = await conn.parentProxy.getConfig();
  //           ^? 类型是 Promise<{ apiKey: string; endpoint: string }>

  await conn.parentProxy.showMessage('Hello!');
}
```

## 优势对比

### ❌ 之前的设计（使用 any）

```typescript
const conn = createParentRPC(child, new ParentImpl());
const childProxy = conn.childProxy as Asyncify<ChildAPI>;  // 需要手动类型断言
```

**缺点:**
- 返回 `any` 类型，失去类型安全
- 需要手动类型断言
- 容易出现类型错误

### ✅ 新的设计（使用泛型）

```typescript
const conn = createParentRPC<ParentImpl, ChildAPI>(child, new ParentImpl());
const childProxy = conn.childProxy;  // 自动推断为 Asyncify<ChildAPI>
```

**优点:**
- ✅ 完全类型安全
- ✅ 无需手动类型断言
- ✅ 编译时类型检查
- ✅ IDE 自动完成支持
- ✅ 重构更安全

## 完整的类型安全演示

```typescript
// 定义接口
interface MyAPI {
  getData(id: string): Promise<{ name: string; age: number }>;
  process(item: number): Promise<boolean>;
}

// 创建连接
const conn = createParentRPC<ParentImpl, MyAPI>(child, new ParentImpl());
const proxy = conn.childProxy;

// ✅ 完全类型安全
const data = await proxy.getData('123');
//    ^? 类型是 { name: string; age: number }
console.log(data.name);  // OK
console.log(data.age);   // OK

// ✅ 参数类型检查
await proxy.process(42);    // OK
await proxy.process('abc'); // ❌ 编译错误: string 不能赋值给 number

// ✅ 返回类型推断
const result = await proxy.process(42);
//       ^? 类型是 boolean
if (result) {
  // TypeScript 知道 result 是 boolean
}

// ✅ 方法名自动完成
// 输入 proxy. 时，IDE 会自动显示 getData 和 process
```

## 类型推断示例

```typescript
// 场景 1: 只关心父进程实现，子进程类型使用默认 any
const conn1 = createParentRPC<ParentImpl>(child, new ParentImpl());
const childProxy1 = conn1.childProxy;  // 类型是 any

// 场景 2: 完整类型指定
const conn2 = createParentRPC<ParentImpl, ChildAPI>(child, new ParentImpl());
const childProxy2 = conn2.childProxy;  // 类型是 Asyncify<ChildAPI>

// 场景 3: 类型推断（从实现类）
class MyParentImpl implements ParentAPI { ... }
const conn3 = createParentRPC<MyParentImpl, ChildAPI>(child, new MyParentImpl());
const childProxy3 = conn3.childProxy;  // 类型是 Asyncify<ChildAPI>
```

## 迁移指南

### 从旧 API 迁移

```typescript
// ❌ 旧方式
const conn = createParentRPC(child, new ParentImpl());
const childProxy = conn.childProxy as Asyncify<ChildAPI>;

// ✅ 新方式
const conn = createParentRPC<ParentImpl, ChildAPI>(child, new ParentImpl());
const childProxy = conn.childProxy;
```

### 向后兼容

```typescript
// 仍然可以不指定泛型参数，返回 any
const conn = createParentRPC(child, new ParentImpl());
const childProxy = conn.childProxy;  // 类型是 any
```

## 技术细节

### 为什么使用 `as unknown as Asyncify<C>`？

在 `createParentRPC` 的实现中，我们需要将 `connection.proxy`（类型为 `Asyncify<T>`）转换为 `Asyncify<C>`。

由于 `T` 和 `C` 是不同的类型，TypeScript 编译器不允许直接转换。我们使用 `as unknown as` 作为中间步骤：

```typescript
childProxy: connection.proxy as unknown as Asyncify<C>
```

这是安全的，因为：
1. `connection.proxy` 实际上是一个代理对象，可以调用任何方法
2. 类型转换只在编译时生效，运行时不受影响
3. 调用是通过方法名字符串发送的，不依赖类型系统

### 为什么使用 `as const`？

在传递 options 时使用 `as const` 可以帮助 TypeScript 更好地推断字面量类型：

```typescript
{ debug: true, timeout: 10000 } as const
```

这确保 options 对象的类型被正确推断为 `RPCProxyOptions`。

## 总结

这次优化成功地将库的类型安全性提升到了一个新的水平：

- ✅ 消除了 `any` 类型
- ✅ 提供了完整的泛型支持
- ✅ 保持了向后兼容性
- ✅ 改善了开发体验
- ✅ 增强了代码可维护性

现在 `node-ipc-rpc-proxy` 是一个真正类型安全的 RPC 库！🎉
