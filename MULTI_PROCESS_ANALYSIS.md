# 多子进程场景下的隔离性分析

## 问题：多个子进程是否会造成污染？

**答案：不会！** ✅

## 技术原理

### 1. 架构层面的隔离

每个子进程都有完全独立的 `RPCCore` 实例和消息处理管道：

```typescript
// 父进程中
const workers: Array<{
  process: ChildProcess;
  rpc: ReturnType<typeof createParentRPC<ParentImpl, WorkerAPI>>;
}> = [];

for (let i = 0; i < 3; i++) {
  const child = fork('./worker.js');

  // 每个子进程创建独立的RPC连接
  const rpc = createParentRPC<ParentImpl, WorkerAPI>(
    child,
    new ParentImpl(),
    options
  );

  workers.push({ process: child, rpc });
}
```

### 2. 消息监听器隔离

每个 `RPCCore` 实例绑定到不同的 `ChildProcess`：

```typescript
export class RPCCore {
  private boundMessageHandler: (msg: unknown) => void;

  constructor(private port: MessagePort, options: RPCProxyOptions) {
    // 绑定到特定的 ChildProcess
    this.port.on('message', this.boundMessageHandler);
  }
}

// 实际使用
const rpc1 = createParentRPC(child1, impl1);
const rpc2 = createParentRPC(child2, impl2);

// rpc1 只会收到 child1 的消息
// rpc2 只会收到 child2 的消息
```

### 3. 请求映射表隔离

每个 `RPCCore` 实例维护独立的 `pendingRequests` Map：

```typescript
export class RPCCore {
  private pendingRequests = new Map<string, PendingRequest>();

  async sendRequest(method: string, args: unknown[]): Promise<unknown> {
    const id = generateCorrelationId();

    return new Promise((resolve, reject) => {
      // 存储到当前实例的 Map 中
      this.pendingRequests.set(id, { resolve, reject, ... });

      // 发送到对应的 ChildProcess
      this.port.send({ id, method, args });
    });
  }
}
```

**数据结构示意：**

```
RPCCore 实例 1 (child1)
  └─ pendingRequests:
      ├─ "pid1-timestamp1-abc" → { resolve, reject, timeout }
      ├─ "pid1-timestamp2-def" → { resolve, reject, timeout }
      └─ "pid1-timestamp3-ghi" → { resolve, reject, timeout }

RPCCore 实例 2 (child2)
  └─ pendingRequests:
      ├─ "pid1-timestamp4-jkl" → { resolve, reject, timeout }
      ├─ "pid1-timestamp5-mno" → { resolve, reject, timeout }
      └─ "pid1-timestamp6-pqr" → { resolve, reject, timeout }
```

### 4. 消息ID唯一性

虽然多个进程可能同时生成ID，但包含进程ID确保唯一性：

```typescript
export function generateCorrelationId(): string {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
```

**示例：**
```
父进程 (PID 1000):
  - "1000-1704067200000-abc123" → Child 1 请求 1
  - "1000-1704067200001-def456" → Child 1 请求 2
  - "1000-1704067200002-ghi789" → Child 2 请求 1

子进程1 (PID 1001):
  - "1001-1704067200003-jkl012" → Parent 请求 1

子进程2 (PID 1002):
  - "1002-1704067200004-mno345" → Parent 请求 1
```

### 5. 操作系统级别的进程隔离

Node.js 的 `child_process.fork()` 创建的是**完全独立的操作系统进程**：

```
┌────────────────────┐
│  Parent Process    │
│  PID: 1000         │
│  Memory: 100MB     │
└────────┬───────────┘
         │ IPC Channel
         │ (OS-level isolation)
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼─────┐
│Child 1│ │Child 2 │
│PID:1001│ │PID:1002│
│Mem:50MB│ │Mem:50MB│
└───────┘ └────────┘
```

每个进程有：
- 独立的内存空间
- 独立的V8实例
- 独立的事件循环
- 独立的变量作用域

## 消息流转分析

### 场景：父进程并发调用多个子进程

```typescript
// 父进程代码
const [result1, result2, result3] = await Promise.all([
  workers[0].rpc.childProxy.processTask(1, 'data1'),  // → Child 1
  workers[1].rpc.childProxy.processTask(2, 'data2'),  // → Child 2
  workers[2].rpc.childProxy.processTask(3, 'data3'),  // → Child 3
]);
```

**消息流：**

```
时刻 T0: 父进程发送请求
┌────────────┐    send     ┌──────────────┐
│  Parent    │────────────→│  Child 1     │
│  RPCCore 1 │  {id: A1,   │  (PID: 1001) │
│             │   method,   │              │
└────────────┘   args}      └──────────────┘

┌────────────┐    send     ┌──────────────┐
│  Parent    │────────────→│  Child 2     │
│  RPCCore 2 │  {id: A2,   │  (PID: 1002) │
│             │   method,   │              │
└────────────┘   args}      └──────────────┘

┌────────────┐    send     ┌──────────────┐
│  Parent    │────────────→│  Child 3     │
│  RPCCore 3 │  {id: A3,   │  (PID: 1003) │
│             │   method,   │              │
└────────────┘   args}      └──────────────┘

时刻 T1: 子进程处理并返回

┌──────────────┐    send     ┌────────────┐
│  Child 1     │────────────→│  Parent    │
│  (PID: 1001) │  {id: A1,   │  RPCCore 1 │ ← 只在这个实例中查找 A1
│              │   result}   │            │
└──────────────┘             └────────────┘

┌──────────────┐    send     ┌────────────┐
│  Child 2     │────────────→│  Parent    │
│  (PID: 1002) │  {id: A2,   │  RPCCore 2 │ ← 只在这个实例中查找 A2
│              │   result}   │            │
└──────────────┘             └────────────┘

┌──────────────┐    send     ┌────────────┐
│  Child 3     │────────────→│  Parent    │
│  (PID: 1003) │  {id: A3,   │  RPCCore 3 │ ← 只在这个实例中查找 A3
│              │   result}   │            │
└──────────────┘             └────────────┘
```

### 关键点

1. **消息不会串扰**: Child 1 的消息只会被 RPCCore 1 的监听器接收
2. **Promise 正确解析**: 每个请求的 Promise 只在对应的 RPCCore 实例中解析
3. **无需手动路由**: Node.js IPC 机制自动路由消息到正确的监听器

## 并发安全性

### 快速并发调用同一子进程

```typescript
// 父进程快速发送3个请求到同一个子进程
const [r1, r2, r3] = await Promise.all([
  worker.rpc.childProxy.processTask(1, 'a'),
  worker.rpc.childProxy.processTask(2, 'b'),
  worker.rpc.childProxy.processTask(3, 'c'),
]);
```

**安全性保证：**

1. **唯一ID**: 每个请求有唯一的 correlation ID
   ```typescript
   "1000-1704067200000-abc123"  // 请求 1
   "1000-1704067200001-def456"  // 请求 2 (时间戳不同)
   "1000-1704067200002-ghi789"  // 请求 3 (随机部分不同)
   ```

2. **独立Promise**: 每个请求创建独立的 Promise
   ```typescript
   this.pendingRequests.set(id1, { resolve: fn1, reject: fn1, ... });
   this.pendingRequests.set(id2, { resolve: fn2, reject: fn2, ... });
   this.pendingRequests.set(id3, { resolve: fn3, reject: fn3, ... });
   ```

3. **正确匹配**: 响应通过ID精确匹配
   ```typescript
   // 收到响应 { id: "1000-1704067200001-def456", result: "..." }
   const pending = this.pendingRequests.get("1000-1704067200001-def456");
   pending.resolve(result);  // 只解析对应的 Promise
   ```

## 内存泄漏防护

### 超时自动清理

```typescript
return new Promise((resolve, reject) => {
  const timeoutId = setTimeout(() => {
    this.pendingRequests.delete(id);  // 自动清理
    reject(new Error(`RPC timeout: ${method}`));
  }, timeout);

  this.pendingRequests.set(id, {
    resolve,
    reject,
    timeout: timeoutId,
    timestamp: Date.now()
  });
});
```

### 进程退出清理

```typescript
private handleDisconnect(): void {
  // 清理所有pending请求
  this.pendingRequests.forEach((pending) => {
    clearTimeout(pending.timeout);
    pending.reject(new Error('RPC connection closed'));
  });
  this.pendingRequests.clear();
}
```

## 测试验证

运行多子进程示例：

```bash
npm run build
node dist/examples/multi-child-example/parent.js
```

**预期结果：**
- ✅ 所有worker独立处理请求
- ✅ 没有消息串扰
- ✅ 并发调用正确返回
- ✅ 快速连续调用不会混淆

## 总结

| 方面 | 隔离保证 |
|------|---------|
| **进程级别** | ✅ 操作系统级别的进程隔离 |
| **实例级别** | ✅ 每个RPC连接独立的RPCCore实例 |
| **监听器级别** | ✅ 绑定到不同的ChildProcess对象 |
| **数据结构** | ✅ 独立的pendingRequests Map |
| **消息ID** | ✅ 包含进程ID、时间戳、随机数 |
| **并发安全** | ✅ Promise独立且通过ID精确匹配 |
| **资源清理** | ✅ 超时和断开时自动清理 |

**结论：可以放心使用多个子进程，不会有任何污染问题！** 🎉
