#!/usr/bin/env tsx

import 'dotenv/config';
import { DatabaseService } from './src/services/database-service';

/**
 * Demo Change Detection
 * 
 * This demonstrates the change detection logic by manually inserting
 * different monitoring data and testing the comparison logic.
 */

async function demoChangeDetection() {
  console.log('🔍 Change Detection Demo');
  console.log('=' .repeat(50));

  const db = new DatabaseService();
  const taskId = 'demo-change-detection';

  try {
    // Simulate first execution data
    console.log('\n📊 Step 1: Insert initial monitoring data...');
    await db.saveMonitoringData({
      taskId,
      url: 'https://example.com/coffee',
      extractedData: {
        roastingDate: '2025-07-15',
        availability: 'out of stock',
        price: '149 kr'
      }
    });
    console.log('✅ Initial data saved');

    // Simulate second execution with changes
    console.log('\n📊 Step 2: Test change detection with new data...');
    const newData = {
      roastingDate: '2025-07-22',  // Changed!
      availability: 'in stock',    // Changed! (Restock!)
      price: '149 kr'              // Same
    };

    const changeDetection = await db.detectChanges(taskId, newData);
    
    if (changeDetection) {
      console.log('🔍 Changes detected!');
      console.log('Changed fields:', changeDetection.changedFields);
      console.log('Is restock?', changeDetection.isRestock);
      console.log('Change details:', JSON.stringify(changeDetection.changeDetails, null, 2));

      if (changeDetection.isRestock) {
        console.log('🎉 RESTOCK ALERT! Coffee is back in stock!');
      }
    } else {
      console.log('✅ No changes detected');
    }

    // Test with no changes
    console.log('\n📊 Step 3: Test with identical data (no changes)...');
    const sameData = {
      roastingDate: '2025-07-22',
      availability: 'in stock',
      price: '149 kr'
    };

    await db.saveMonitoringData({
      taskId,
      url: 'https://example.com/coffee',
      extractedData: newData
    });

    const noChangeDetection = await db.detectChanges(taskId, sameData);
    
    if (noChangeDetection) {
      console.log('🔍 Unexpected changes detected');
    } else {
      console.log('✅ Correctly detected no changes');
    }

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

if (require.main === module) {
  demoChangeDetection()
    .then(() => {
      console.log('\n✅ Change detection demo completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}