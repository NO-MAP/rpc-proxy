# 多子进程示例

这个示例演示了父进程同时管理多个子进程时的场景，验证不会有消息污染。

## 运行示例

```bash
# 构建项目
npm run build

# 运行父进程（会自动启动3个worker子进程）
node dist/examples/multi-child-example/parent.js
```

## 测试内容

### 测试 1: 并发调用所有worker
同时向所有3个worker发送任务请求，验证：
- 每个worker独立处理自己的请求
- 不会收到其他worker的消息
- 响应正确返回到对应的调用方

### 测试 2: 顺序单独调用
逐个调用每个worker的状态查询，验证：
- 每个worker的连接独立
- 不会出现串扰

### 测试 3: 快速并发调用同一worker
向同一个worker快速发送多个请求，验证：
- 请求ID不会冲突
- 响应正确匹配

## 为什么不会有污染？

### 1. 独立的 RPCCore 实例
```typescript
// 每个worker都有自己的RPCCore实例
for (let i = 0; i < numWorkers; i++) {
  const workerProcess = fork('./worker.js', [i]);

  // 每个worker创建独立的RPC连接
  const rpc = createParentRPC(workerProcess, parentImpl);

  workers.push({ process: workerProcess, rpc });
}
```

### 2. 独立的消息监听器
```typescript
class RPCCore {
  private boundMessageHandler: (msg: unknown) => void;

  private setupListeners(): void {
    // 每个RPCCore实例绑定到不同的ChildProcess
    this.port.on('message', this.boundMessageHandler);
  }
}
```

### 3. 独立的pendingRequests映射
```typescript
class RPCCore {
  private pendingRequests = new Map<string, PendingRequest>();
  // 每个实例有独立的请求映射表
  // 不会与其他实例混淆
}
```

### 4. 唯一的相关性ID
```typescript
export function generateCorrelationId(): string {
  // ID包含进程ID，确保唯一性
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
```

### 5. 进程级别的隔离
```typescript
// ChildProcess是操作系统级别的隔离
// 每个子进程有独立的内存空间
// 消息通过IPC通道传递，天然隔离
```

## 预期输出

```
🚀 Parent process starting with multiple workers...

✅ Worker 1 spawned
✅ Worker 2 spawned
✅ Worker 3 spawned

==============================================================
Testing concurrent calls to all workers...
==============================================================

📋 Test 1: Calling all workers concurrently

✅ Results from all workers:
   Worker 1: Worker-1: Processed "Task data for worker 1"
   Worker 2: Worker-2: Processed "Task data for worker 2"
   Worker 3: Worker-3: Processed "Task data for worker 3"

📋 Test 2: Individual sequential calls

   Worker 1: Worker-1 is running
   Worker 2: Worker-2 is running
   Worker 3: Worker-3 is running

📋 Test 3: Rapid concurrent calls to Worker 1

✅ Rapid call results:
   Call 1: Worker-1: Processed "Rapid call 1"
   Call 2: Worker-1: Processed "Rapid call 2"
   Call 3: Worker-1: Processed "Rapid call 3"

==============================================================
✅ All tests passed! No contamination detected.
==============================================================
```

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Parent Process                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ RPCCore #1      │  │ RPCCore #2      │  ...         │
│  │ (Worker 1)      │  │ (Worker 2)      │              │
│  ├─────────────────┤  ├─────────────────┤              │
│  │ pendingRequests │  │ pendingRequests │              │
│  │ Map             │  │ Map             │              │
│  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                        │
│           └────────┬───────────┘                        │
│                    │                                    │
│           ┌────────▼────────┐                          │
│           │  Parent Impl    │                          │
│           └─────────────────┘                          │
└─────────────────────────────────────────────────────────┘
                    │           │
                    │           │
        ┌───────────▼────┐     │
        │ ChildProcess 1 │     │
        └────────────────┘     │
                                │
        ┌───────────────────────▼────┐
        │ ChildProcess 2              │
        └─────────────────────────────┘
```

## 关键要点

✅ **完全隔离**: 每个worker的RPC连接完全独立
✅ **无污染**: 消息不会在不同worker之间串扰
✅ **类型安全**: 每个worker都可以有相同或不同的API接口
✅ **并发安全**: 可以安全地并发调用多个worker
✅ **易于管理**: 可以单独启动/停止/监控每个worker
