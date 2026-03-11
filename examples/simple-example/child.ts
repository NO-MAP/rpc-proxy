/**
 * Child process example
 */

import { createChildRPC } from '../../dist';
import { ChildAPI, ParentAPI } from './interfaces';

// Implement methods to expose to parent
class ChildImpl implements ChildAPI {
  async processData(data: string): Promise<string> {
    console.log('🔄 Processing data:', data);
    return data.toUpperCase();
  }

  async calculateHash(data: Buffer): Promise<string> {
    console.log('🔐 Calculating hash for:', data.toString());
    // Simulate hash calculation with base64
    return data.toString('base64');
  }

  async greet(name: string): Promise<string> {
    console.log('👋 Greeting:', name);
    return `Hello, ${name}! Nice to meet you.`;
  }
}

async function main() {
  console.log('👶 Child process starting...\n');

  // Create RPC connection with parent using type parameters
  const conn = createChildRPC<ChildImpl, ParentAPI>(
    new ChildImpl(),
    { debug: true, timeout: 10000 } as const
  );

  // parentProxy is now fully typed as Asyncify<ParentAPI>
  const parentProxy = conn.parentProxy;
  const emit = conn.emit;

  try {
    console.log('\n--- Calling parent methods ---\n');

    // Call parent's showMessage method
    console.log('1️⃣ Calling parentProxy.showMessage("Hello from child!")');
    await parentProxy.showMessage('Hello from child!');
    console.log('');

    // Call parent's getConfig method
    console.log('2️⃣ Calling parentProxy.getConfig()');
    const config = await parentProxy.getConfig();
    console.log('✅ Config received:');
    console.log('   - API Key:', config.apiKey);
    console.log('   - Endpoint:', config.endpoint);
    console.log('');

    // Call parent's addNumbers method
    console.log('3️⃣ Calling parentProxy.addNumbers(10, 20)');
    const sum = await parentProxy.addNumbers(10, 20);
    console.log('✅ Sum:', sum);
    console.log('');

    // Send a notification event to parent
    console.log('4️⃣ Emitting event: task-complete');
    emit('task-complete', {
      taskId: 123,
      status: 'success',
      duration: 42
    });
    console.log('');

    console.log('--- All calls completed successfully ---\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
