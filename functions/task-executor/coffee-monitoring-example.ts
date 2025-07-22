#!/usr/bin/env tsx

import 'dotenv/config';
import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';
import { Task } from './types';

/**
 * Coffee Monitoring Example
 * 
 * This demonstrates how the BirdWatcher system can monitor a coffee product page
 * for changes in roasting date, availability, or other properties over time.
 * 
 * Key features demonstrated:
 * - Database storage of execution results
 * - Monitoring data tracking over time
 * - Change detection between executions
 * - Restock detection for availability changes
 */

async function runCoffeeMonitoringExample() {
  console.log('☕ Coffee Monitoring Example');
  console.log('=' .repeat(50));

  const handler = new SimplifiedTaskHandler();
  
  // Example coffee product task
  const coffeeTask: Task = {
    id: 'coffee-restock-monitor',
    url: 'https://www.kaffecompagniet.se/kaffe/kaffebonor-pods-kapslar/kaffebonor-pods/single-estate-brygg-espr/gringo-etiopien-guji-organic-250-g-102685',
    instruction: `Extract the following data from this coffee product page:
    - roastingDate: The roasting date (look for "Ristningsdatum" or similar)
    
    Return the data as a JSON object with these exact field names.`
  };

  try {
    console.log(`🎯 Monitoring coffee product: ${coffeeTask.url}`);
    console.log(`📋 Task ID: ${coffeeTask.id}\n`);

    // Execute the task
    const result = await handler.executeTask(coffeeTask);

    console.log('\n' + '='.repeat(50));
    console.log('📊 EXECUTION RESULTS');
    console.log('=' .repeat(50));

    if (result.success) {
      console.log('✅ Execution successful!');
      console.log(`🆔 Execution ID: ${result.executionId}`);
      console.log(`🗂️  Used saved path: ${result.usedSavedPath ? 'Yes' : 'No'}`);
      
      console.log('\n📦 Extracted Data:');
      console.log(JSON.stringify(result.extractedData, null, 2));

      if (result.changesDetected) {
        console.log('\n🔍 CHANGES DETECTED:');
        console.log('Fields that changed:', Object.keys(result.changeDetails || {}));
        
        if (result.changeDetails) {
          for (const [field, change] of Object.entries(result.changeDetails)) {
            console.log(`  ${field}: ${JSON.stringify((change as any).from)} → ${JSON.stringify((change as any).to)}`);
          }
        }
        
        // Check if this was a restock
        const changeDetectionResult = await handler['db'].detectChanges(coffeeTask.id, result.extractedData);
        if (changeDetectionResult?.isRestock) {
          console.log('🎉 RESTOCK ALERT: Coffee appears to be back in stock!');
        }
      } else {
        console.log('\n✅ No changes detected from previous execution');
      }
    } else {
      console.log('❌ Execution failed');
      console.log('Error:', result.error);
    }

    console.log('\n' + '='.repeat(50));
    console.log('💡 MONITORING INSIGHTS');
    console.log('=' .repeat(50));
    console.log('• This task would typically run on a schedule (e.g., every 6 hours)');
    console.log('• Each execution is saved to the database with full history');
    console.log('• Changes are automatically detected and can trigger notifications');
    console.log('• Restock detection helps notify when products become available');
    console.log('• Multiple runs will show change detection in action');
    
  } catch (error) {
    console.error('❌ Failed to execute coffee monitoring task:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCoffeeMonitoringExample()
    .then(() => {
      console.log('\n✅ Coffee monitoring example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}

export { runCoffeeMonitoringExample };