import { Resend } from 'resend';
import { ChangeNotification } from './notification-service';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor(config: EmailConfig) {
    this.resend = new Resend(config.apiKey);
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName || 'BirdWatcher';
  }

  async sendChangeNotification(
    notification: ChangeNotification, 
    recipients: EmailRecipient[]
  ): Promise<void> {
    const subject = this.buildSubject(notification);
    const html = this.buildHtml(notification);
    const text = this.buildText(notification);

    for (const recipient of recipients) {
      try {
        const result = await this.resend.emails.send({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: recipient.email,
          subject,
          html,
          text,
        });

        console.log(`📧 Email sent successfully to ${recipient.email}:`, result.data?.id);
      } catch (error) {
        console.error(`❌ Failed to send email to ${recipient.email}:`, error);
        throw error;
      }
    }
  }

  async sendRestockAlert(
    notification: ChangeNotification, 
    recipients: EmailRecipient[]
  ): Promise<void> {
    const subject = `🎉 RESTOCK ALERT: ${notification.taskName || notification.taskId}`;
    const html = this.buildRestockHtml(notification);
    const text = this.buildRestockText(notification);

    for (const recipient of recipients) {
      try {
        const result = await this.resend.emails.send({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: recipient.email,
          subject,
          html,
          text,
        });

        console.log(`🚨 Restock alert sent to ${recipient.email}:`, result.data?.id);
      } catch (error) {
        console.error(`❌ Failed to send restock alert to ${recipient.email}:`, error);
        throw error;
      }
    }
  }

  private buildSubject(notification: ChangeNotification): string {
    const prefix = notification.isRestock ? '🎉 RESTOCK:' : '🔍 Changes Detected:';
    return `${prefix} ${notification.taskName || notification.taskId}`;
  }

  private buildHtml(notification: ChangeNotification): string {
    const changesHtml = notification.changedFields.map(field => {
      const change = notification.changeDetails[field];
      if (!change) return `<li><strong>${field}</strong>: Changed</li>`;
      
      return `
        <li>
          <strong>${field}</strong>: 
          <span style="text-decoration: line-through; color: #666;">${JSON.stringify(change.from)}</span>
          → 
          <span style="color: #2563eb; font-weight: bold;">${JSON.stringify(change.to)}</span>
        </li>
      `;
    }).join('');

    const restockBanner = notification.isRestock ? `
      <div style="background: #10b981; color: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 18px;">🎉 RESTOCK ALERT!</h2>
        <p style="margin: 8px 0 0 0;">Item is back in stock!</p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>BirdWatcher Change Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${restockBanner}
          
          <h1 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            🔍 Change Detection Report
          </h1>
          
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #374151;">Task Details</h3>
            <p style="margin: 4px 0;"><strong>Task:</strong> ${notification.taskName || notification.taskId}</p>
            <p style="margin: 4px 0;"><strong>URL:</strong> <a href="${notification.url}" style="color: #2563eb;">${notification.url}</a></p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${notification.timestamp.toLocaleString()}</p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #374151;">Changes Detected</h3>
            <ul style="background: #fef3c7; padding: 16px; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
              ${changesHtml}
            </ul>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
            <p>This notification was sent by BirdWatcher - your automated monitoring system.</p>
            <p>Generated at: ${new Date().toISOString()}</p>
          </div>
        </body>
      </html>
    `;
  }

  private buildText(notification: ChangeNotification): string {
    const restockHeader = notification.isRestock ? '🎉 RESTOCK ALERT!\n\n' : '';
    
    const changes = notification.changedFields.map(field => {
      const change = notification.changeDetails[field];
      if (!change) return `- ${field}: Changed`;
      return `- ${field}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`;
    }).join('\n');

    return `${restockHeader}CHANGE DETECTION REPORT

Task: ${notification.taskName || notification.taskId}
URL: ${notification.url}
Time: ${notification.timestamp.toLocaleString()}

Changes Detected:
${changes}

---
This notification was sent by BirdWatcher - your automated monitoring system.
Generated at: ${new Date().toISOString()}`;
  }

  private buildRestockHtml(notification: ChangeNotification): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>🎉 Restock Alert!</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px;">🎉 RESTOCK ALERT!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your monitored item is back in stock!</p>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px 0; color: #374151;">Item Details</h3>
            <p style="margin: 4px 0;"><strong>Task:</strong> ${notification.taskName || notification.taskId}</p>
            <p style="margin: 4px 0;"><strong>URL:</strong> <a href="${notification.url}" style="color: #2563eb; text-decoration: none; font-weight: bold;">View Item →</a></p>
            <p style="margin: 4px 0;"><strong>Detected at:</strong> ${notification.timestamp.toLocaleString()}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${notification.url}" 
               style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              🛍️ Check It Out Now
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
            <p>This restock alert was sent by BirdWatcher.</p>
            <p>Don't wait too long - items can sell out quickly!</p>
          </div>
        </body>
      </html>
    `;
  }

  private buildRestockText(notification: ChangeNotification): string {
    return `🎉 RESTOCK ALERT!

Your monitored item is back in stock!

Task: ${notification.taskName || notification.taskId}
URL: ${notification.url}
Detected at: ${notification.timestamp.toLocaleString()}

Don't wait too long - items can sell out quickly!

---
This restock alert was sent by BirdWatcher.`;
  }
}