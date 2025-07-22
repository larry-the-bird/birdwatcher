import { EmailService, EmailConfig, EmailRecipient } from './email-service';

/**
 * Notification service for change detection alerts
 * 
 * Supports multiple notification methods:
 * - Email notifications via Resend
 * - Console logging
 * - Future: Slack/Discord webhooks, SMS alerts, Push notifications
 */

export interface ChangeNotification {
  taskId: string;
  taskName?: string;
  url: string;
  changedFields: string[];
  changeDetails: any;
  isRestock: boolean;
  timestamp: Date;
}

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    config: EmailConfig;
    recipients: EmailRecipient[];
  };
  console?: {
    enabled: boolean;
  };
}

export class NotificationService {
  private emailService?: EmailService;
  private config: NotificationConfig;

  constructor(config: NotificationConfig = { console: { enabled: true } }) {
    this.config = config;
    
    // Initialize email service if configured
    if (config.email?.enabled && config.email.config) {
      this.emailService = new EmailService(config.email.config);
    }
  }
  
  async sendChangeNotification(notification: ChangeNotification): Promise<void> {
    // Always log to console if enabled
    if (this.config.console?.enabled !== false) {
      this.logToConsole(notification);
    }
    
    // Send email notification if configured
    if (this.emailService && this.config.email?.recipients) {
      try {
        if (notification.isRestock) {
          await this.emailService.sendRestockAlert(notification, this.config.email.recipients);
        } else {
          await this.emailService.sendChangeNotification(notification, this.config.email.recipients);
        }
      } catch (error) {
        console.error('❌ Failed to send email notification:', error);
        // Don't throw - we don't want email failures to break the monitoring
      }
    }
  }

  private logToConsole(notification: ChangeNotification): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔔 CHANGE NOTIFICATION');
    console.log('=' .repeat(60));
    
    console.log(`📋 Task: ${notification.taskName || notification.taskId}`);
    console.log(`🌐 URL: ${notification.url}`);
    console.log(`⏰ Time: ${notification.timestamp.toLocaleString()}`);
    
    if (notification.isRestock) {
      console.log('🎉 RESTOCK ALERT: Item is back in stock!');
    }
    
    console.log('\n📊 Changes detected:');
    for (const field of notification.changedFields) {
      const change = notification.changeDetails[field];
      if (change) {
        console.log(`  • ${field}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`);
      }
    }
    
    console.log('=' .repeat(60));
    
    if (this.emailService) {
      console.log('📧 Email notification sent to recipients');
    }
  }

  async sendRestockAlert(notification: ChangeNotification): Promise<void> {
    // Mark as restock for special handling
    notification.isRestock = true;
    console.log('\n🚨 PRIORITY RESTOCK ALERT 🚨');
    await this.sendChangeNotification(notification);
  }

  // Factory method to create notification service with email
  static withEmail(
    apiKey: string,
    fromEmail: string,
    recipients: EmailRecipient[],
    fromName: string = 'BirdWatcher'
  ): NotificationService {
    return new NotificationService({
      email: {
        enabled: true,
        config: { apiKey, fromEmail, fromName },
        recipients
      },
      console: { enabled: true }
    });
  }

  // Factory method for console-only notifications
  static consoleOnly(): NotificationService {
    return new NotificationService({
      console: { enabled: true }
    });
  }
}