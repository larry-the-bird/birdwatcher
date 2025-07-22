#!/usr/bin/env tsx

import 'dotenv/config';
import { SimplifiedTaskHandler } from './src/handlers/simplified-handler';
import { NotificationService } from './src/services/notification-service';
import { Task } from './types';

/**
 * Coffee Email Monitoring Example
 * 
 * This demonstrates the coffee monitoring system with email notifications.
 * When changes are detected, emails will be sent to configured recipients.
 * 
 * Required Environment Variables:
 * - RESEND_API_KEY: Your Resend API key
 * - NOTIFICATION_FROM_EMAIL: Email address to send from (must be verified in Resend)
 * - NOTIFICATION_TO_EMAIL: Email address to receive notifications
 */

async function runCoffeeEmailExample() {
  console.log('☕ Coffee Email Monitoring Example');
  console.log('=' .repeat(50));

  // Check for required environment variables
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL;
  const toEmail = process.env.NOTIFICATION_TO_EMAIL;

  if (!resendApiKey || !fromEmail || !toEmail) {
    console.log('⚠️  Email notifications not configured. Using console-only mode.');
    console.log('');
    console.log('To enable email notifications, set these environment variables:');
    console.log('- RESEND_API_KEY=your_resend_api_key');
    console.log('- NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com');
    console.log('- NOTIFICATION_TO_EMAIL=your@email.com');
    console.log('');
    console.log('Running with console notifications only...\n');
    
    // Use console-only notifications
    const handler = new SimplifiedTaskHandler();
    await executeCoffeeTask(handler);
    return;
  }

  console.log('📧 Email notifications configured:');
  console.log(`   From: ${fromEmail}`);
  console.log(`   To: ${toEmail}`);
  console.log('');

  // Configure email notifications
  const notificationConfig = {
    email: {
      enabled: true,
      config: {
        apiKey: resendApiKey,
        fromEmail: fromEmail,
        fromName: 'BirdWatcher Coffee Monitor'
      },
      recipients: [
        { email: toEmail, name: 'Coffee Lover' }
      ]
    },
    console: { enabled: true }
  };

  const handler = new SimplifiedTaskHandler(undefined, notificationConfig);
  await executeCoffeeTask(handler);
}

async function executeCoffeeTask(handler: SimplifiedTaskHandler) {
  const coffeeTask: Task = {
    id: 'coffee-email-monitor',
    url: 'https://www.kaffecompagniet.se/kaffe/kaffebonor-pods-kapslar/kaffebonor-pods/single-estate-brygg-espr/gringo-etiopien-guji-organic-250-g-102685',
    instruction: `Extract the following data from this coffee product page:
    - roastingDate: The roasting date (look for "Ristningsdatum" or similar)
    - availability: Whether the coffee is in stock (look for stock status)
    - price: The current price
    
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
        
        console.log('\n📧 Email notifications sent to configured recipients!');
      } else {
        console.log('\n✅ No changes detected from previous execution');
      }
    } else {
      console.log('❌ Execution failed');
      console.log('Error:', result.error);
    }

    console.log('\n' + '='.repeat(50));
    console.log('💡 EMAIL MONITORING SETUP');
    console.log('=' .repeat(50));
    console.log('• To test email notifications, run this example twice');
    console.log('• Or manually change the roasting date on the website');
    console.log('• Emails include beautiful HTML formatting and direct links');
    console.log('• Restock alerts get special priority treatment');
    console.log('• All notifications are logged to both console and email');
    
  } catch (error) {
    console.error('❌ Failed to execute coffee email monitoring task:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runCoffeeEmailExample()
    .then(() => {
      console.log('\n✅ Coffee email monitoring example completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}

export { runCoffeeEmailExample };