/**
 * Parent process with multiple workers
 */

import { fork } from 'child_process';
import { createParentRPC } from '../../dist';
import { ParentAPI, WorkerAPI } from './interfaces';

class ParentImpl implements ParentAPI {
  private currentWorkerId = 0;

  async logMessage(workerId: number, message: string): Promise<void> {
    console.log(`\n📨 Received from Worker ${workerId}: ${message}`);
  }

  async getWorkerId(): Promise<number> {
    // Increment to show which worker is currently calling
    return ++this.currentWorkerId;
  }
}

interface WorkerConnection {
  id: number;
  process: any;
  rpc: ReturnType<typeof createParentRPC<ParentImpl, WorkerAPI>>;
}

async function main() {
  console.log('🚀 Parent process starting with multiple workers...\n');

  const workers: WorkerConnection[] = [];
  const numWorkers = 3;

  // Create multiple workers
  for (let i = 0; i < numWorkers; i++) {
    const workerId = i + 1;
    const workerProcess = fork('./worker.js', [workerId.toString()], {
      silent: false,
      cwd: __dirname
    });

    // Create separate RPC connection for each worker
    const rpc = createParentRPC<ParentImpl, WorkerAPI>(
      workerProcess,
      new ParentImpl(),
      { debug: true, timeout: 10000 }
    );

    workers.push({
      id: workerId,
      process: workerProcess,
      rpc
    });

    console.log(`✅ Worker ${workerId} spawned`);
  }

  // Wait for workers to initialize
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n' + '='.repeat(60));
  console.log('Testing concurrent calls to all workers...');
  console.log('='.repeat(60) + '\n');

  try {
    // Test 1: Concurrent calls to all workers
    console.log('📋 Test 1: Calling all workers concurrently\n');

    const results = await Promise.all(
      workers.map(async (worker, index) => {
        const result = await worker.rpc.childProxy.processTask(
          index + 1,
          `Task data for worker ${worker.id}`
        );
        return { workerId: worker.id, result };
      })
    );

    console.log('\n✅ Results from all workers:');
    results.forEach(({ workerId, result }) => {
      console.log(`   Worker ${workerId}: ${result}`);
    });

    // Test 2: Individual calls to verify no cross-contamination
    console.log('\n📋 Test 2: Individual sequential calls\n');

    for (const worker of workers) {
      const status = await worker.rpc.childProxy.getStatus();
      console.log(`   Worker ${worker.id}: ${status}`);
    }

    // Test 3: Rapid concurrent calls to same worker
    console.log('\n📋 Test 3: Rapid concurrent calls to Worker 1\n');

    const worker1 = workers[0];
    const rapidCalls = await Promise.all([
      worker1.rpc.childProxy.processTask(101, 'Rapid call 1'),
      worker1.rpc.childProxy.processTask(102, 'Rapid call 2'),
      worker1.rpc.childProxy.processTask(103, 'Rapid call 3'),
    ]);

    console.log('\n✅ Rapid call results:');
    rapidCalls.forEach((result, index) => {
      console.log(`   Call ${index + 1}: ${result}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed! No contamination detected.');
    console.log('='.repeat(60) + '\n');

    // Cleanup
    console.log('🧹 Cleaning up workers...');
    workers.forEach(worker => {
      worker.rpc.destroy();
      worker.process.kill();
    });

    console.log('✅ All workers terminated');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    workers.forEach(worker => {
      worker.rpc.destroy();
      worker.process.kill();
    });
    process.exit(1);
  }
}

main();
