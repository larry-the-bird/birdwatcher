#!/usr/bin/env tsx

import 'dotenv/config';
import { LLMPricingService, TokenUsage } from './src/services/llm-pricing-service';

/**
 * Test LLM Pricing Service
 * 
 * This script tests the LLM pricing service by:
 * 1. Fetching pricing data from LiteLLM
 * 2. Testing model name resolution
 * 3. Calculating costs for common usage scenarios
 */

async function testLLMPricing() {
  console.log('💰 Testing LLM Pricing Service');
  console.log('=' .repeat(50));

  const pricingService = new LLMPricingService();

  try {
    // Test 1: Fetch pricing data
    console.log('\n📊 Test 1: Fetching LiteLLM pricing data...');
    const pricingData = await pricingService.fetchPricingData();
    const modelCount = Object.keys(pricingData).length;
    console.log(`✅ Successfully fetched pricing for ${modelCount} models`);

    // Test 2: Test model resolution
    console.log('\n🔍 Test 2: Testing model name resolution...');
    const testModels = [
      'gpt-4o',
      'gpt-4o-mini', 
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ];

    for (const model of testModels) {
      const pricing = await pricingService.getModelPricing(model);
      if (pricing) {
        console.log(`✅ ${model}: Input $${pricing.input_cost_per_token?.toFixed(8) || 'N/A'} | Output $${pricing.output_cost_per_token?.toFixed(8) || 'N/A'}`);
      } else {
        console.log(`❌ ${model}: No pricing found`);
      }
    }

    // Test 3: Cost calculations for coffee monitoring scenario
    console.log('\n💡 Test 3: Coffee monitoring cost scenarios...');
    
    const scenarios = [
      {
        name: 'Small extraction (GPT-4o Mini)',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 500, outputTokens: 50 }
      },
      {
        name: 'Medium extraction (GPT-4o)',
        model: 'gpt-4o',
        usage: { inputTokens: 1000, outputTokens: 100 }
      },
      {
        name: 'Large analysis (Claude Sonnet)',
        model: 'claude-3-5-sonnet-20241022',
        usage: { inputTokens: 2000, outputTokens: 300 }
      },
      {
        name: 'Complex reasoning (Claude Opus)',
        model: 'claude-3-opus-20240229',
        usage: { inputTokens: 1500, outputTokens: 500 }
      }
    ];

    for (const scenario of scenarios) {
      const cost = await pricingService.calculateCost(scenario.model, scenario.usage as TokenUsage);
      console.log(`\n💰 ${scenario.name}:`);
      console.log(`   ${pricingService.formatCostBreakdown(cost)}`);
    }

    // Test 4: Daily/monthly cost estimates
    console.log('\n📈 Test 4: Usage cost estimates...');
    
    const dailyRuns = 24; // Every hour
    const monthlyRuns = dailyRuns * 30;
    
    const typicalUsage: TokenUsage = { inputTokens: 800, outputTokens: 80 };
    
    for (const model of ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet-20241022']) {
      const singleCost = await pricingService.calculateCost(model, typicalUsage);
      const dailyCost = singleCost.totalCost * dailyRuns;
      const monthlyCost = singleCost.totalCost * monthlyRuns;
      
      console.log(`\n📊 ${model} estimates (800 input + 80 output tokens):`);
      console.log(`   Single run: $${singleCost.totalCost.toFixed(6)}`);
      console.log(`   Daily (24 runs): $${dailyCost.toFixed(4)}`);
      console.log(`   Monthly (720 runs): $${monthlyCost.toFixed(2)}`);
    }

    // Test 5: Available models sample
    console.log('\n📋 Test 5: Available models (sample)...');
    const availableModels = await pricingService.getAvailableModels();
    const claudeModels = availableModels.filter(m => m.toLowerCase().includes('claude')).slice(0, 5);
    const gptModels = availableModels.filter(m => m.toLowerCase().includes('gpt')).slice(0, 5);
    
    console.log('Claude models:', claudeModels);
    console.log('GPT models:', gptModels);
    console.log(`Total models available: ${availableModels.length}`);

  } catch (error) {
    console.error('❌ Pricing test failed:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ LLM PRICING TEST COMPLETED');
  console.log('=' .repeat(50));
  console.log('• Pricing data is cached for 1 hour to avoid repeated API calls');
  console.log('• Fallback pricing is used when LiteLLM is unavailable');
  console.log('• Model name matching supports exact, prefix, and partial matching');
  console.log('• Cost tracking will now be included in all LLM responses');
}

if (require.main === module) {
  testLLMPricing()
    .then(() => {
      console.log('\n✅ LLM pricing test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}