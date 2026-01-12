import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { PaymentReminderTemplateService, MessageChannel, TenantType } from './payment-reminder-template.service';
import { PaymentReminderVariableService, VariableContext } from './payment-reminder-variable.service';

export interface SendMessageResult {
  success: boolean;
  channel: MessageChannel;
  message?: string;
  error?: string;
}

@Injectable()
export class PaymentReminderMessageService {
  private readonly logger = new Logger(PaymentReminderMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: PaymentReminderTemplateService,
    private readonly variableService: PaymentReminderVariableService,
  ) {}

  /**
   * Send reminder message to tenant
   */
  async sendReminderToTenant(
    contractId: bigint,
    invoiceId: bigint | null,
    stage: string,
    channels: MessageChannel[],
  ): Promise<SendMessageResult[]> {
    const results: SendMessageResult[] = [];

    try {
      // Get variable context
      const context = await this.variableService.getVariableContext(contractId, invoiceId || undefined);

      // Determine tenant type
      const tenantType = context.isBusiness ? TenantType.BUSINESS : TenantType.INDIVIDUAL;

      // Get template for each channel
      for (const channel of channels) {
        try {
          const template = this.templateService.getTemplate(
            stage as any,
            channel,
            tenantType,
          );

          if (!template) {
            results.push({
              success: false,
              channel,
              error: 'Template not found',
            });
            continue;
          }

          // Replace variables
          const message = this.variableService.replaceVariables(template, context);

          // Send message based on channel
          const result = await this.sendMessage(
            channel,
            context.tenantEmail || '',
            context.tenantPhone || '',
            message,
            context.tenantName || '',
          );

          results.push({
            success: result.success,
            channel,
            message: result.success ? message : undefined,
            error: result.error,
          });

          // Log the reminder
          await this.logReminder(contractId, invoiceId, stage, channel, result.success);
        } catch (error: any) {
          this.logger.error(`Error sending ${channel} message: ${error.message}`);
          results.push({
            success: false,
            channel,
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in sendReminderToTenant: ${error.message}`);
      return channels.map((channel) => ({
        success: false,
        channel,
        error: error.message,
      }));
    }

    return results;
  }

  /**
   * Send notification to owner
   */
  async sendNotificationToOwner(
    contractId: bigint,
    stage: string,
  ): Promise<boolean> {
    try {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          ownerUser: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      if (!contract?.ownerUser?.email) {
        return false;
      }

      const template = this.templateService.getOwnerTemplate(stage as any);
      if (!template) {
        return false;
      }

      // For now, we'll just log it. You can integrate with email service later
      this.logger.log(`Owner notification for contract ${contractId}: ${template}`);

      // TODO: Integrate with email service
      // await this.sendEmail(contract.ownerUser.email, 'Aviso de Pagamento', template);

      return true;
    } catch (error: any) {
      this.logger.error(`Error sending owner notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Send message via appropriate channel
   */
  private async sendMessage(
    channel: MessageChannel,
    email: string,
    phone: string,
    message: string,
    recipientName: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (channel) {
        case MessageChannel.EMAIL:
          return await this.sendEmail(email, 'Lembrete de Pagamento - MR3X', message);

        case MessageChannel.SMS:
          return await this.sendSMS(phone, message);

        case MessageChannel.WHATSAPP:
          return await this.sendWhatsApp(phone, message);

        default:
          return { success: false, error: 'Unknown channel' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email (TODO: Integrate with email service)
   */
  private async sendEmail(
    to: string,
    subject: string,
    body: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!to) {
      return { success: false, error: 'Email address not provided' };
    }

    // TODO: Integrate with your email service (SendGrid, AWS SES, etc.)
    this.logger.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
    this.logger.debug(`[EMAIL] Body: ${body.substring(0, 100)}...`);

    // For now, just log. You'll need to implement actual email sending
    // Example:
    // await this.emailService.send({
    //   to,
    //   subject,
    //   html: this.formatEmailBody(body),
    // });

    return { success: true };
  }

  /**
   * Send SMS (TODO: Integrate with SMS service)
   */
  private async sendSMS(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!phone) {
      return { success: false, error: 'Phone number not provided' };
    }

    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    this.logger.log(`[SMS] To: ${phone}`);
    this.logger.debug(`[SMS] Message: ${message.substring(0, 50)}...`);

    // For now, just log. You'll need to implement actual SMS sending
    // Example:
    // await this.smsService.send({
    //   to: phone,
    //   message,
    // });

    return { success: true };
  }

  /**
   * Send WhatsApp (TODO: Integrate with WhatsApp service)
   */
  private async sendWhatsApp(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!phone) {
      return { success: false, error: 'Phone number not provided' };
    }

    // TODO: Integrate with WhatsApp Business API
    this.logger.log(`[WHATSAPP] To: ${phone}`);
    this.logger.debug(`[WHATSAPP] Message: ${message.substring(0, 50)}...`);

    // For now, just log. You'll need to implement actual WhatsApp sending
    // Example:
    // await this.whatsappService.send({
    //   to: phone,
    //   message,
    // });

    return { success: true };
  }

  /**
   * Log reminder in database
   */
  private async logReminder(
    contractId: bigint,
    invoiceId: bigint | null,
    stage: string,
    channel: MessageChannel,
    success: boolean,
  ): Promise<void> {
    try {
      // TODO: Create PaymentReminderLog table in schema
      // await this.prisma.paymentReminderLog.create({
      //   data: {
      //     contractId,
      //     invoiceId,
      //     stage,
      //     channel,
      //     success,
      //     sentAt: new Date(),
      //   },
      // });
    } catch (error) {
      this.logger.error(`Error logging reminder: ${error}`);
    }
  }

  /**
   * Format email body as HTML
   */
  private formatEmailBody(text: string): string {
    // Convert plain text to HTML
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MR3X</h1>
          </div>
          <div class="content">
            ${text.replace(/\n/g, '<br>')}
          </div>
          <div class="footer">
            <p>MR3X é uma plataforma de tecnologia para gestão de aluguéis e não presta serviços jurídicos, advocatícios ou de intermediação judicial.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

