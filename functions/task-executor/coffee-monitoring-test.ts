import { handler } from './index';

/**
 * Test coffee monitoring functionality
 * This simulates the scheduled monitoring workflow
 */
export async function testCoffeeMonitoring() {
  console.log('☕ Testing Coffee Monitoring System');
  console.log('=====================================');

  const coffeeMonitoringPayload = {
    instruction: "Extract roasting date, price, and availability status from the coffee product page",
    url: "https://www.kaffecompagniet.se/kaffe/kaffebonor-pods-kapslar/kaffebonor-pods/single-estate-brygg-espr/gringo-etiopien-guji-organic-250-g-102685",
    taskId: "coffee-monitor-test-123", // Simulated task ID
    options: {
      timeout: 30000,
      screenshot: true,
      executionMode: "interactive"
    }
  };

  try {
    console.log('🎯 First execution (baseline)...');
    const firstResult = await handler(coffeeMonitoringPayload);
    console.log('✅ First execution completed:', JSON.stringify(firstResult, null, 2));

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🎯 Second execution (change detection)...');
    const secondResult = await handler(coffeeMonitoringPayload);
    console.log('✅ Second execution completed:', JSON.stringify(secondResult, null, 2));

    console.log('\n📊 Coffee monitoring test completed!');
    
  } catch (error) {
    console.error('❌ Coffee monitoring test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCoffeeMonitoring();
}