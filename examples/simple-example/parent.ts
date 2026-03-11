/**
 * Parent process example
 */

import { fork } from 'child_process';
import { createParentRPC } from '../../dist';
import { ParentAPI, ChildAPI } from './interfaces';

// Implement methods to expose to child
class ParentImpl implements ParentAPI {
  async showMessage(message: string): Promise<void> {
    console.log('📨 Message from child:', message);
  }

  async getConfig(): Promise<{ apiKey: string; endpoint: string }> {
    console.log('🔧 Config requested by child');
    return {
      apiKey: 'secret-api-key-12345',
      endpoint: 'https://api.example.com'
    };
  }

  async addNumbers(a: number, b: number): Promise<number> {
    console.log(`🔢 Child wants to add: ${a} + ${b}`);
    return a + b;
  }
}

async function main() {
  console.log('🚀 Parent process starting...\n');

  // Fork child process
  const child = fork('./child.js', {
    silent: false,
    cwd: __dirname
  });

  // Create RPC connection with type safety
  const conn = createParentRPC<ParentImpl, ChildAPI>(
    child,
    new ParentImpl(),
    { debug: true, timeout: 10000 } as const
  );

  // childProxy is now fully typed as Asyncify<ChildAPI>
  const childProxy = conn.childProxy;
  const on = conn.on;

  // Listen to child events
  on('task-complete', (data: any) => {
    console.log('✅ Child event received:', data);
  });

  // Wait a bit for child to initialize
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    console.log('\n--- Calling child methods ---\n');

    // Call child's processData method
    console.log('1️⃣ Calling childProxy.processData("hello world")');
    const result1 = await childProxy.processData('hello world');
    console.log('✅ Result:', result1);
    console.log('');

    // Call child's greet method
    console.log('2️⃣ Calling childProxy.greet("Alice")');
    const result2 = await childProxy.greet('Alice');
    console.log('✅ Result:', result2);
    console.log('');

    // Call child's calculateHash method
    console.log('3️⃣ Calling childProxy.calculateHash(Buffer.from("secret"))');
    const hash = await childProxy.calculateHash(Buffer.from('secret'));
    console.log('✅ Hash:', hash);
    console.log('');

    console.log('--- All calls completed successfully ---\n');

    // Wait for child to finish
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Cleanup
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
