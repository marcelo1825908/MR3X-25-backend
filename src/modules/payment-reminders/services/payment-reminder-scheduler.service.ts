import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../config/prisma.service';
import { PaymentReminderMessageService } from './payment-reminder-message.service';
import { PaymentReminderTemplateService, ReminderStage, MessageChannel } from './payment-reminder-template.service';

interface ContractWithInvoice {
  contractId: bigint;
  invoiceId: bigint | null;
  dueDate: Date;
  tenantId: bigint;
  ownerId: bigint | null;
  status: string;
}

@Injectable()
export class PaymentReminderSchedulerService {
  private readonly logger = new Logger(PaymentReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageService: PaymentReminderMessageService,
  ) {}

  /**
   * Run every day at 8 AM to check for reminders
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailyReminders() {
    this.logger.log('Starting daily payment reminder check...');

    try {
      await this.processAllReminders();
      this.logger.log('Daily payment reminder check completed');
    } catch (error) {
      this.logger.error('Error in daily payment reminder check:', error);
    }
  }

  /**
   * Process all reminders for all active contracts
   */
  async processAllReminders(): Promise<{
    processed: number;
    sent: number;
    errors: number;
  }> {
    const result = {
      processed: 0,
      sent: 0,
      errors: 0,
    };

    try {
      // Get all active contracts with pending/overdue invoices
      const contracts = await this.getContractsNeedingReminders();

      this.logger.log(`Found ${contracts.length} contracts needing reminders`);

      for (const contract of contracts) {
        try {
          result.processed++;

          const stage = this.determineReminderStage(contract.dueDate);
          if (!stage) {
            continue; // Not in a reminder window
          }

          // Check if we already sent this reminder today
          const alreadySent = await this.checkIfAlreadySent(
            contract.contractId,
            contract.invoiceId,
            stage,
          );

          if (alreadySent) {
            continue;
          }

          // Determine channels based on tenant preferences or default
          const channels = await this.getChannelsForTenant(contract.tenantId);

          // Send reminder
          const results = await this.messageService.sendReminderToTenant(
            contract.contractId,
            contract.invoiceId,
            stage,
            channels,
          );

          const success = results.some((r) => r.success);
          if (success) {
            result.sent++;

            // Send owner notification if overdue
            if (this.isOverdueStage(stage)) {
              await this.messageService.sendNotificationToOwner(
                contract.contractId,
                stage,
              );
            }
          } else {
            result.errors++;
          }
        } catch (error: any) {
          this.logger.error(
            `Error processing reminder for contract ${contract.contractId}: ${error.message}`,
          );
          result.errors++;
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in processAllReminders: ${error.message}`);
      throw error;
    }

    return result;
  }

  /**
   * Get contracts that need reminders
   */
  private async getContractsNeedingReminders(): Promise<ContractWithInvoice[]> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get contracts with active invoices
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: {
          // Include invoices due in next 7 days or overdue up to 7 days
          gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        contract: {
          status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED'] },
          deleted: false,
        },
      },
      include: {
        contract: {
          include: {
            tenantUser: {
              select: {
                email: true,
                phone: true,
              },
            },
          },
        },
        tenant: {
          select: {
            email: true,
            phone: true,
          },
        },
      },
    });

    const contracts: ContractWithInvoice[] = [];

    for (const invoice of invoices) {
      if (!invoice.contract) {
        continue;
      }

      // Check if tenant has contact info (from invoice.tenant or invoice.contract.tenantUser)
      const tenantEmail = invoice.tenant?.email || invoice.contract?.tenantUser?.email;
      const tenantPhone = invoice.tenant?.phone || invoice.contract?.tenantUser?.phone;

      if (!tenantEmail && !tenantPhone) {
        continue;
      }

      contracts.push({
        contractId: invoice.contractId,
        invoiceId: invoice.id,
        dueDate: invoice.dueDate,
        tenantId: invoice.contract?.tenantId || invoice.tenantId || BigInt(0),
        ownerId: invoice.contract?.ownerId || invoice.ownerId,
        status: invoice.status,
      });
    }

    // Also get contracts without invoices but with nextDueDate
    const contractsWithoutInvoices = await this.prisma.contract.findMany({
      where: {
        status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED'] },
        deleted: false,
        property: {
          nextDueDate: {
            gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
            lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: {
        tenantUser: {
          select: {
            email: true,
            phone: true,
          },
        },
        property: {
          select: {
            nextDueDate: true,
          },
        },
      },
    });

    for (const contract of contractsWithoutInvoices) {
      if (!contract.property?.nextDueDate) {
        continue;
      }

      if (!contract.tenantUser?.email && !contract.tenantUser?.phone) {
        continue;
      }

      // Check if we already have an invoice for this
      const hasInvoice = contracts.some(
        (c) => c.contractId === contract.id && c.invoiceId !== null,
      );

      if (!hasInvoice) {
        contracts.push({
          contractId: contract.id,
          invoiceId: null,
          dueDate: contract.property.nextDueDate,
          tenantId: contract.tenantId,
          ownerId: contract.ownerId,
          status: 'PENDING',
        });
      }
    }

    return contracts;
  }

  /**
   * Determine which reminder stage based on due date
   */
  private determineReminderStage(dueDate: Date): ReminderStage | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 7) {
      return ReminderStage.PRE_DUE_7_DAYS;
    } else if (diffDays === 3) {
      return ReminderStage.PRE_DUE_3_DAYS;
    } else if (diffDays === 0) {
      return ReminderStage.DUE_TODAY;
    } else if (diffDays === -1) {
      return ReminderStage.POST_DUE_1_DAY;
    } else if (diffDays === -3) {
      return ReminderStage.POST_DUE_3_DAYS;
    } else if (diffDays === -7) {
      return ReminderStage.POST_DUE_7_DAYS;
    }

    return null; // Not in a reminder window
  }

  /**
   * Check if reminder was already sent today
   */
  private async checkIfAlreadySent(
    contractId: bigint,
    invoiceId: bigint | null,
    stage: ReminderStage,
  ): Promise<boolean> {
    // TODO: Implement with PaymentReminderLog table
    // For now, we'll use a simple in-memory cache or check notifications
    // This prevents duplicate sends on the same day

    // You can implement this by checking if a notification was created today
    // or by using a cache/Redis

    return false; // For now, allow sending
  }

  /**
   * Get preferred channels for tenant
   */
  private async getChannelsForTenant(tenantId: bigint): Promise<MessageChannel[]> {
    // TODO: Get from tenant preferences or agency settings
    // For now, return default channels
    return [MessageChannel.EMAIL, MessageChannel.WHATSAPP];
  }

  /**
   * Check if stage is overdue
   */
  private isOverdueStage(stage: ReminderStage): boolean {
    return [
      ReminderStage.POST_DUE_1_DAY,
      ReminderStage.POST_DUE_3_DAYS,
      ReminderStage.POST_DUE_7_DAYS,
    ].includes(stage);
  }

  /**
   * Manually trigger reminder for a specific contract
   */
  async triggerReminderForContract(
    contractId: string,
    stage?: ReminderStage,
    channels?: MessageChannel[],
  ): Promise<{ success: boolean; message: string }> {
    try {
      const contract = await this.prisma.contract.findUnique({
        where: { id: BigInt(contractId) },
        include: {
          property: {
            select: {
              nextDueDate: true,
            },
          },
        },
      });

      if (!contract) {
        return { success: false, message: 'Contract not found' };
      }

      const dueDate = contract.property?.nextDueDate || new Date();
      const reminderStage = stage || this.determineReminderStage(dueDate);

      if (!reminderStage) {
        return { success: false, message: 'No reminder needed at this time' };
      }

      const invoice = await this.prisma.invoice.findFirst({
        where: {
          contractId: BigInt(contractId),
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'desc' },
      });

      const defaultChannels = channels || [MessageChannel.EMAIL, MessageChannel.WHATSAPP];

      const results = await this.messageService.sendReminderToTenant(
        BigInt(contractId),
        invoice?.id || null,
        reminderStage,
        defaultChannels,
      );

      const success = results.some((r) => r.success);

      return {
        success,
        message: success
          ? `Reminder sent via ${results.filter((r) => r.success).map((r) => r.channel).join(', ')}`
          : `Failed to send reminder: ${results.map((r) => r.error).join(', ')}`,
      };
    } catch (error: any) {
      this.logger.error(`Error triggering reminder: ${error.message}`);
      return { success: false, message: error.message };
    }
  }
}

