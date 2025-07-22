#!/usr/bin/env tsx

import 'dotenv/config';
import { NotificationService } from './src/services/notification-service';

/**
 * Test Email Notifications
 * 
 * This script tests the email notification system independently
 * by sending sample change detection notifications.
 */

async function testEmailNotifications() {
  console.log('📧 Testing Email Notifications');
  console.log('=' .repeat(50));

  // Check for required environment variables
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL;
  const toEmail = process.env.NOTIFICATION_TO_EMAIL;

  if (!resendApiKey || !fromEmail || !toEmail) {
    console.log('⚠️  Email notifications not configured. Testing console-only mode.');
    console.log('');
    console.log('To test email notifications, set these environment variables:');
    console.log('- RESEND_API_KEY=your_resend_api_key');
    console.log('- NOTIFICATION_FROM_EMAIL=notifications@yourdomain.com');
    console.log('- NOTIFICATION_TO_EMAIL=your@email.com');
    console.log('');
    
    await testConsoleNotifications();
    return;
  }

  console.log('📧 Email notifications configured:');
  console.log(`   From: ${fromEmail}`);
  console.log(`   To: ${toEmail}`);
  console.log('');

  // Test actual email sending
  const notificationService = NotificationService.withEmail(
    resendApiKey,
    fromEmail,
    [{ email: toEmail, name: 'Test User' }],
    'BirdWatcher Test'
  );

  await testNotificationService(notificationService, true);
}

async function testConsoleNotifications() {
  const notificationService = NotificationService.consoleOnly();
  await testNotificationService(notificationService, false);
}

async function testNotificationService(notificationService: NotificationService, isEmailEnabled: boolean) {
  
  // Test 1: Regular change notification
  console.log('\n📊 Test 1: Regular change notification');
  console.log('-'.repeat(30));
  
  try {
    await notificationService.sendChangeNotification({
      taskId: 'test-coffee-monitor',
      taskName: 'Coffee Roasting Date Monitor',
      url: 'https://example.com/coffee/ethiopia-sidamo',
      changedFields: ['roastingDate', 'price'],
      changeDetails: {
        roastingDate: {
          from: '2025-07-15',
          to: '2025-07-22'
        },
        price: {
          from: '149 kr',
          to: '159 kr'
        }
      },
      isRestock: false,
      timestamp: new Date()
    });
    
    console.log('✅ Regular change notification sent successfully');
  } catch (error) {
    console.error('❌ Failed to send regular change notification:', error);
  }

  // Wait a moment between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Restock alert
  console.log('\n📊 Test 2: Restock alert notification');
  console.log('-'.repeat(30));
  
  try {
    await notificationService.sendRestockAlert({
      taskId: 'test-coffee-restock',
      taskName: 'Premium Ethiopia Yirgacheffe',
      url: 'https://example.com/coffee/ethiopia-yirgacheffe',
      changedFields: ['availability', 'stock'],
      changeDetails: {
        availability: {
          from: 'out of stock',
          to: 'in stock'
        },
        stock: {
          from: 0,
          to: 15
        }
      },
      isRestock: true,
      timestamp: new Date()
    });
    
    console.log('✅ Restock alert sent successfully');
  } catch (error) {
    console.error('❌ Failed to send restock alert:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ NOTIFICATION TESTS COMPLETED');
  console.log('=' .repeat(50));
  
  if (isEmailEnabled) {
    console.log('📧 Check your email inbox for the test notifications!');
    console.log('   - Look for emails from "BirdWatcher Test"');
    console.log('   - Check your spam folder if not found');
    console.log('   - Emails include HTML formatting with direct links');
  } else {
    console.log('📝 Console notifications tested successfully');
    console.log('   - Configure email settings to test actual email sending');
  }
}

if (require.main === module) {
  testEmailNotifications()
    .then(() => {
      console.log('\n✅ Email notification test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}