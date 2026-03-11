/**
 * Worker process (child) - Multiple instances can be spawned
 */

import { createChildRPC } from '../../dist';
import { WorkerAPI, ParentAPI } from './interfaces';

class WorkerImpl implements WorkerAPI {
  constructor(private workerId: number) {
    console.log(`👷 Worker ${this.workerId} initialized`);
  }

  async processTask(taskId: number, data: string): Promise<string> {
    console.log(`👷 Worker ${this.workerId}: Processing task ${taskId}`);
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    return `Worker-${this.workerId}: Processed "${data}"`;
  }

  async getStatus(): Promise<string> {
    return `Worker-${this.workerId} is running`;
  }
}

async function main() {
  // Get worker ID from command line arguments
  const workerId = parseInt(process.argv[2] || '0');

  console.log(`👶 Worker process ${workerId} starting...\n`);

  // Create RPC connection with parent
  const conn = createChildRPC<WorkerImpl, ParentAPI>(
    new WorkerImpl(workerId),
    { debug: true, timeout: 10000 }
  );

  const parentProxy = conn.parentProxy;

  try {
    // Announce this worker to parent
    await parentProxy.logMessage(workerId, `Worker ${workerId} ready!`);

    // Send periodic status updates
    setInterval(async () => {
      const status = await parentProxy.getWorkerId();
      console.log(`👷 Worker ${workerId}: Current worker ID from parent: ${status}`);
    }, 5000);

    // Keep process alive
    process.on('SIGINT', () => {
      console.log(`\n👷 Worker ${workerId}: Shutting down...`);
      process.exit(0);
    });

  } catch (error) {
    console.error(`❌ Worker ${workerId} error:`, error);
    process.exit(1);
  }
}

main();
