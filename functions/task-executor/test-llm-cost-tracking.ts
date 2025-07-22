#!/usr/bin/env tsx

import 'dotenv/config';
import { createLLMFromEnv } from './llm/llm-factory';

/**
 * Test LLM Cost Tracking
 * 
 * This demonstrates cost tracking in action by making actual LLM calls
 * and showing the detailed cost breakdown using LiteLLM pricing data.
 */

async function testLLMCostTracking() {
  console.log('💰 Testing LLM Cost Tracking');
  console.log('=' .repeat(50));

  try {
    const llm = createLLMFromEnv();
    
    console.log(`🤖 Using LLM: ${llm.getProviderInfo().provider} (${llm.getProviderInfo().model})`);

    // Test 1: Simple completion
    console.log('\n📊 Test 1: Simple coffee data extraction...');
    const messages = [
      {
        role: 'user' as const,
        content: `Extract the roasting date from this text: "Fresh coffee roasted on 2025-07-20, perfect for morning brew." Return as JSON with field "roastingDate".`
      }
    ];

    const response1 = await llm.generateCompletion(messages, { jsonMode: true });
    
    console.log('✅ Response:', JSON.parse(response1.content));
    
    if (response1.cost) {
      console.log('💰 Cost breakdown:');
      console.log(`   Input tokens: ${response1.usage?.promptTokens || 0} × $${response1.cost.inputCost.toFixed(8)} = $${response1.cost.inputCost.toFixed(6)}`);
      console.log(`   Output tokens: ${response1.usage?.completionTokens || 0} × $${response1.cost.outputCost.toFixed(8)} = $${response1.cost.outputCost.toFixed(6)}`);
      console.log(`   Total cost: $${response1.cost.totalCost.toFixed(6)}`);
    } else {
      console.log('⚠️ No cost information available');
    }

    // Test 2: More complex analysis
    console.log('\n📊 Test 2: Complex coffee analysis...');
    const messages2 = [
      {
        role: 'user' as const,
        content: `Analyze this coffee product information and extract structured data:
        
        "Premium Ethiopia Yirgacheffe - Single Origin
        Roasted: 2025-07-22
        Price: $24.99
        Weight: 340g
        Tasting Notes: Bright acidity, floral aroma, citrus finish
        Stock: 15 bags available"
        
        Return JSON with: roastingDate, price, weight, stock, tastingNotes (array), origin.`
      }
    ];

    const response2 = await llm.generateCompletion(messages2, { jsonMode: true });
    
    console.log('✅ Response:', JSON.parse(response2.content));
    
    if (response2.cost) {
      console.log('💰 Cost breakdown:');
      console.log(`   Input tokens: ${response2.usage?.promptTokens || 0} × $${(response2.cost.inputCost / (response2.usage?.promptTokens || 1)).toFixed(8)} = $${response2.cost.inputCost.toFixed(6)}`);
      console.log(`   Output tokens: ${response2.usage?.completionTokens || 0} × $${(response2.cost.outputCost / (response2.usage?.completionTokens || 1)).toFixed(8)} = $${response2.cost.outputCost.toFixed(6)}`);
      console.log(`   Total cost: $${response2.cost.totalCost.toFixed(6)}`);
    }

    // Test 3: Cost comparison for different scenarios
    console.log('\n📊 Test 3: Daily monitoring cost estimation...');
    
    const dailyRuns = 24; // Every hour
    const monthlyRuns = dailyRuns * 30;
    
    const avgCost = response1.cost && response2.cost 
      ? (response1.cost.totalCost + response2.cost.totalCost) / 2
      : 0.001; // Fallback estimate
    
    console.log(`Average cost per extraction: $${avgCost.toFixed(6)}`);
    console.log(`Daily cost (${dailyRuns} runs): $${(avgCost * dailyRuns).toFixed(4)}`);
    console.log(`Monthly cost (${monthlyRuns} runs): $${(avgCost * monthlyRuns).toFixed(2)}`);
    
    // Test 4: Show total session cost
    const totalCost = (response1.cost?.totalCost || 0) + (response2.cost?.totalCost || 0);
    
    console.log('\n📊 Test session summary:');
    console.log(`Total tokens used: ${(response1.usage?.totalTokens || 0) + (response2.usage?.totalTokens || 0)}`);
    console.log(`Total session cost: $${totalCost.toFixed(6)}`);

  } catch (error) {
    console.error('❌ Cost tracking test failed:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ LLM COST TRACKING TEST COMPLETED');
  console.log('=' .repeat(50));
  console.log('• Real-time cost calculation using LiteLLM pricing data');
  console.log('• Detailed breakdown of input/output token costs');
  console.log('• Automatic cost tracking in all LLM responses');
  console.log('• Perfect for monitoring operational costs');
}

if (require.main === module) {
  testLLMCostTracking()
    .then(() => {
      console.log('\n✅ LLM cost tracking test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}