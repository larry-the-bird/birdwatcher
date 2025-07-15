#!/usr/bin/env tsx

import { ChangeDetector } from './change-detector';

/**
 * Demo of the change detection system working
 */
async function demoChangeDetection() {
  console.log('☕ Coffee Monitoring Change Detection Demo');
  console.log('==========================================');

  const changeDetector = new ChangeDetector();

  // Simulate first coffee monitoring execution
  const firstExecution = {
    roastingDate: '2025-07-02',
    price: 165,
    inStock: true,
    grindType: 'whole-bean'
  };

  console.log('📅 First execution data:', JSON.stringify(firstExecution, null, 2));

  // Simulate second execution with changes (new roasting = restock!)
  const secondExecution = {
    roastingDate: '2025-07-10', // NEW ROASTING DATE = RESTOCK!
    price: 170, // Price also changed
    inStock: true,
    grindType: 'whole-bean'
  };

  console.log('📅 Second execution data:', JSON.stringify(secondExecution, null, 2));

  // Test change detection
  const changeResult = changeDetector.hasChanged(firstExecution, secondExecution);
  
  console.log('\n🔍 Change Detection Results:');
  console.log('============================');
  console.log('✅ Has changes:', changeResult.hasChanged);
  console.log('🔄 Changed fields:', changeResult.changedFields);
  console.log('☕ Is restock:', changeResult.isRestock);
  console.log('⏰ Detected at:', changeResult.timestamp.toISOString());

  // Get detailed changes
  const detailedChanges = changeDetector.getChangeDetails(firstExecution, secondExecution);
  
  console.log('\n📋 Detailed Changes:');
  console.log('====================');
  detailedChanges.changes.forEach((change, index) => {
    console.log(`${index + 1}. Field: ${change.field}`);
    console.log(`   Type: ${change.changeType}`);
    console.log(`   Previous: ${change.previousValue}`);
    console.log(`   Current: ${change.currentValue}`);
    
    if (change.field === 'roastingDate') {
      console.log('   🎉 NEW COFFEE RESTOCK DETECTED!');
    }
    console.log('');
  });

  // Test case: no changes
  console.log('\n🔄 Testing no changes scenario...');
  const noChangeResult = changeDetector.hasChanged(firstExecution, firstExecution);
  console.log('✅ Has changes:', noChangeResult.hasChanged);
  console.log('🔄 Changed fields:', noChangeResult.changedFields);

  console.log('\n🎯 Demo completed! The monitoring system can detect:');
  console.log('   ☕ Coffee restocking (new roasting dates)');
  console.log('   💰 Price changes');
  console.log('   📦 Stock availability changes');
  console.log('   🔧 Any field modifications');
  console.log('\nThis would run automatically on cron schedule! 🕒');
}

// Run the demo
if (require.main === module) {
  demoChangeDetection().catch(console.error);
}