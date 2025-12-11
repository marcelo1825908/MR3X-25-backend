import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../config/prisma.service';
import { ExtrajudicialNotificationsService } from '../extrajudicial-notifications.service';
import * as crypto from 'crypto';

interface OverdueContract {
  id: bigint;
  contractToken: string | null;
  propertyId: bigint;
  tenantId: bigint;
  ownerId: bigint | null;
  agencyId: bigint | null;
  monthlyRent: any;
  lateFeePercent: any;
  interestRatePercent: any;
  dueDay: number | null;
  property: {
    id: bigint;
    name: string | null;
    address: string | null;
    city: string | null;
    neighborhood: string | null;
    cep: string | null;
    agencyId: bigint | null;
  };
  tenantUser: {
    id: bigint;
    name: string | null;
    email: string | null;
    document: string | null;
    phone: string | null;
    address: string | null;
  };
  ownerUser: {
    id: bigint;
    name: string | null;
    email: string | null;
    document: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  agency: {
    id: bigint;
    name: string;
    cnpj: string;
    email: string;
    phone: string | null;
    address: string | null;
    extrajudicialEnabled: boolean;
    extrajudicialDaysBeforeNotice: number;
    extrajudicialLegalDeadlineDays: number;
    extrajudicialAutoGenerate: boolean;
  } | null;
  payments: Array<{
    id: bigint;
    dueDate: Date;
    valorPago: any;
    status: string;
  }>;
}

@Injectable()
export class ExtrajudicialSchedulerService {
  private readonly logger = new Logger(ExtrajudicialSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private extrajudicialService: ExtrajudicialNotificationsService,
  ) {}

  /**
   * Run daily at 6:00 AM to check for overdue contracts
   * and generate extrajudicial notifications automatically
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleOverdueContractsCheck() {
    this.logger.log('Starting daily overdue contracts check for extrajudicial notifications...');

    try {
      await this.checkAndGenerateNotifications();
      this.logger.log('Completed daily overdue contracts check');
    } catch (error) {
      this.logger.error('Error in overdue contracts check:', error);
    }
  }

  /**
   * Main method to check overdue contracts and generate notifications
   * Can also be called manually via API
   */
  async checkAndGenerateNotifications(): Promise<{
    checked: number;
    generated: number;
    skipped: number;
    errors: number;
    details: Array<{ contractId: string; status: string; message: string }>;
  }> {
    const result = {
      checked: 0,
      generated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ contractId: string; status: string; message: string }>,
    };

    // Get all active contracts with overdue payments
    const overdueContracts = await this.getOverdueContracts();
    result.checked = overdueContracts.length;

    this.logger.log(`Found ${overdueContracts.length} contracts with overdue payments`);

    for (const contract of overdueContracts) {
      try {
        const contractId = contract.id.toString();

        // Check if agency has auto-generate enabled
        if (!contract.agency?.extrajudicialAutoGenerate) {
          result.skipped++;
          result.details.push({
            contractId,
            status: 'SKIPPED',
            message: 'Agency has auto-generation disabled',
          });
          continue;
        }

        // Calculate days overdue
        const oldestOverduePayment = this.getOldestOverduePayment(contract.payments);
        if (!oldestOverduePayment) {
          result.skipped++;
          result.details.push({
            contractId,
            status: 'SKIPPED',
            message: 'No overdue payments found',
          });
          continue;
        }

        const daysOverdue = this.calculateDaysOverdue(oldestOverduePayment.dueDate);
        const daysBeforeNotice = contract.agency?.extrajudicialDaysBeforeNotice || 30;

        // Check if contract has reached the delinquency threshold
        if (daysOverdue < daysBeforeNotice) {
          result.skipped++;
          result.details.push({
            contractId,
            status: 'SKIPPED',
            message: `Only ${daysOverdue} days overdue, threshold is ${daysBeforeNotice} days`,
          });
          continue;
        }

        // Check if notification already exists for this contract
        const existingNotification = await this.prisma.extrajudicialNotification.findFirst({
          where: {
            contractId: contract.id,
            type: 'COBRANCA_ALUGUEL',
            status: {
              notIn: ['RESOLVIDO', 'CANCELADO'],
            },
          },
        });

        if (existingNotification) {
          result.skipped++;
          result.details.push({
            contractId,
            status: 'SKIPPED',
            message: `Already has extrajudicial notification (${existingNotification.notificationToken})`,
          });
          continue;
        }

        // Generate the notification
        await this.generateNotificationForContract(contract, daysOverdue);

        result.generated++;
        result.details.push({
          contractId,
          status: 'GENERATED',
          message: `Notification generated for ${daysOverdue} days overdue`,
        });

      } catch (error) {
        result.errors++;
        result.details.push({
          contractId: contract.id.toString(),
          status: 'ERROR',
          message: error.message,
        });
        this.logger.error(`Error processing contract ${contract.id}:`, error);
      }
    }

    // Log summary
    this.logger.log(`Summary: Checked=${result.checked}, Generated=${result.generated}, Skipped=${result.skipped}, Errors=${result.errors}`);

    return result;
  }

  /**
   * Get all active contracts with overdue payments
   */
  private async getOverdueContracts(): Promise<OverdueContract[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.prisma.contract.findMany({
      where: {
        deleted: false,
        status: {
          in: ['ATIVO', 'ASSINADO'],
        },
        payments: {
          some: {
            dueDate: {
              lt: today,
            },
            status: {
              in: ['PENDING', 'OVERDUE', 'PARCIAL'],
            },
          },
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            neighborhood: true,
            cep: true,
            agencyId: true,
          },
        },
        tenantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            document: true,
            phone: true,
            address: true,
          },
        },
        ownerUser: {
          select: {
            id: true,
            name: true,
            email: true,
            document: true,
            phone: true,
            address: true,
          },
        },
        agency: {
          select: {
            id: true,
            name: true,
            cnpj: true,
            email: true,
            phone: true,
            address: true,
            extrajudicialEnabled: true,
            extrajudicialDaysBeforeNotice: true,
            extrajudicialLegalDeadlineDays: true,
            extrajudicialAutoGenerate: true,
          },
        },
        payments: {
          where: {
            dueDate: {
              lt: today,
            },
            status: {
              in: ['PENDING', 'OVERDUE', 'PARCIAL'],
            },
          },
          select: {
            id: true,
            dueDate: true,
            valorPago: true,
            status: true,
          },
          orderBy: {
            dueDate: 'asc',
          },
        },
      },
    }) as unknown as OverdueContract[];
  }

  /**
   * Get the oldest overdue payment
   */
  private getOldestOverduePayment(payments: Array<{ id: bigint; dueDate: Date; valorPago: any; status: string }>) {
    if (!payments || payments.length === 0) return null;
    return payments.reduce((oldest, payment) =>
      payment.dueDate < oldest.dueDate ? payment : oldest
    );
  }

  /**
   * Calculate days overdue from a date
   */
  private calculateDaysOverdue(dueDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - due.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate financial amounts for the notification
   */
  private calculateFinancialAmounts(contract: OverdueContract, daysOverdue: number) {
    // Calculate total overdue amount (principal)
    const principalAmount = contract.payments.reduce((sum, p) => {
      return sum + parseFloat(p.valorPago?.toString() || '0');
    }, 0);

    // Calculate fine (multa)
    const lateFeePercent = parseFloat(contract.lateFeePercent?.toString() || '2');
    const fineAmount = principalAmount * (lateFeePercent / 100);

    // Calculate interest (juros)
    const interestRatePercent = parseFloat(contract.interestRatePercent?.toString() || '1');
    const monthsOverdue = Math.ceil(daysOverdue / 30);
    const interestAmount = principalAmount * (interestRatePercent / 100) * monthsOverdue;

    // Monetary correction (simplified - using a fixed rate)
    const correctionRate = 0.5; // 0.5% monthly correction
    const correctionAmount = principalAmount * (correctionRate / 100) * monthsOverdue;

    // Total amount
    const totalAmount = principalAmount + fineAmount + interestAmount + correctionAmount;

    return {
      principalAmount: Math.round(principalAmount * 100) / 100,
      fineAmount: Math.round(fineAmount * 100) / 100,
      interestAmount: Math.round(interestAmount * 100) / 100,
      correctionAmount: Math.round(correctionAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  /**
   * Generate extrajudicial notification for a contract
   */
  private async generateNotificationForContract(contract: OverdueContract, daysOverdue: number) {
    const { principalAmount, fineAmount, interestAmount, correctionAmount, totalAmount } =
      this.calculateFinancialAmounts(contract, daysOverdue);

    // Determine creditor (owner or agency)
    const creditor = contract.ownerUser || {
      id: contract.agency?.id,
      name: contract.agency?.name,
      document: contract.agency?.cnpj,
      email: contract.agency?.email,
      phone: contract.agency?.phone,
      address: contract.agency?.address,
    };

    const debtor = contract.tenantUser;
    const property = contract.property;
    const legalDeadlineDays = contract.agency?.extrajudicialLegalDeadlineDays || 15;

    // Build property address
    const propertyAddress = [
      property.address,
      property.neighborhood,
      property.city,
      property.cep,
    ].filter(Boolean).join(', ');

    // Generate notification token and hash
    const notificationToken = this.generateToken();
    const authHash = this.generateHash(JSON.stringify({
      contractId: contract.id.toString(),
      debtorId: debtor.id.toString(),
      amount: totalAmount,
      timestamp: Date.now(),
    }));

    // Format currency
    const formatCurrency = (value: number) =>
      `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Build notification content
    const title = `NOTIFICAÇÃO EXTRAJUDICIAL DE COBRANÇA DE ALUGUÉIS`;

    const subject = `Cobrança de aluguéis em atraso referente ao imóvel localizado em ${propertyAddress}`;

    const description = `
NOTIFICAÇÃO EXTRAJUDICIAL

NOTIFICANTE: ${creditor.name || 'N/A'}
CPF/CNPJ: ${creditor.document || 'N/A'}
Endereço: ${creditor.address || 'N/A'}

NOTIFICADO(A): ${debtor.name || 'N/A'}
CPF/CNPJ: ${debtor.document || 'N/A'}
Endereço: ${debtor.address || 'N/A'}

OBJETO: Cobrança de aluguéis em atraso

Prezado(a) ${debtor.name},

Pelo presente instrumento, fica V.Sa. NOTIFICADO(A) de que se encontra em débito para com o(a) NOTIFICANTE, referente aos aluguéis do imóvel localizado em:

${propertyAddress}

CONTRATO: ${contract.contractToken || `#${contract.id}`}

DEMONSTRATIVO DO DÉBITO:

1. Valor Principal (aluguéis em atraso): ${formatCurrency(principalAmount)}
2. Multa por atraso (${contract.lateFeePercent || 2}%): ${formatCurrency(fineAmount)}
3. Juros de mora (${contract.interestRatePercent || 1}% a.m.): ${formatCurrency(interestAmount)}
4. Correção monetária: ${formatCurrency(correctionAmount)}

TOTAL DO DÉBITO: ${formatCurrency(totalAmount)}

(Valores calculados até a presente data - ${new Date().toLocaleDateString('pt-BR')})

Dias em atraso: ${daysOverdue} dias

Fica V.Sa. NOTIFICADO(A) a efetuar o pagamento do débito acima discriminado no prazo de ${legalDeadlineDays} (${this.numberToWords(legalDeadlineDays)}) dias, contados do recebimento desta notificação.

O não pagamento no prazo estipulado acarretará:
- Protesto do título em cartório;
- Inclusão do nome nos órgãos de proteção ao crédito (SPC/SERASA);
- Ajuizamento de ação de despejo por falta de pagamento cumulada com cobrança;
- Continuidade da incidência de juros e correção monetária até a quitação total.

Esta notificação tem caráter de ÚLTIMA OPORTUNIDADE AMIGÁVEL antes das medidas judiciais cabíveis.

TOKEN DE VERIFICAÇÃO: ${notificationToken}
HASH DE AUTENTICIDADE: ${authHash}

${creditor.address ? `Local: ${creditor.address.split(',')[0]}` : 'Local'}, ${new Date().toLocaleDateString('pt-BR')}

_________________________________
${creditor.name}
${creditor.document ? `CPF/CNPJ: ${creditor.document}` : ''}
NOTIFICANTE
    `.trim();

    const legalBasis = `
- Lei nº 8.245/1991 (Lei do Inquilinato), artigos 9º, III e 62
- Código Civil, artigos 389, 395 e 406 (mora e inadimplemento)
- Código de Processo Civil, artigos 726 e seguintes (notificação extrajudicial)
    `.trim();

    const demandedAction = `
Pagamento integral do débito no valor de ${formatCurrency(totalAmount)} no prazo de ${legalDeadlineDays} dias úteis a contar do recebimento desta notificação, sob pena de adoção das medidas judiciais cabíveis, incluindo ação de despejo por falta de pagamento e negativação nos órgãos de proteção ao crédito.
    `.trim();

    const consequencesText = `
Em caso de não pagamento no prazo estipulado:
1. Protesto do título em cartório competente
2. Inscrição nos órgãos de proteção ao crédito (SPC/SERASA)
3. Ajuizamento de ação de despejo por falta de pagamento (art. 9º, III, Lei 8.245/91)
4. Cobrança judicial dos valores devidos com acréscimo de custas processuais e honorários advocatícios (20% sobre o valor da causa)
5. Continuidade da incidência de juros, multa e correção monetária até a efetiva quitação
    `.trim();

    // Create the notification in database
    const notification = await this.prisma.extrajudicialNotification.create({
      data: {
        contractId: contract.id,
        propertyId: contract.propertyId,
        agencyId: contract.agencyId,

        notificationToken,
        notificationNumber: this.generateNotificationNumber(),
        protocolNumber: this.generateProtocolNumber(),

        type: 'COBRANCA_ALUGUEL',
        status: 'GERADO',
        priority: daysOverdue > 60 ? 'HIGH' : 'NORMAL',

        creditorId: BigInt(creditor.id?.toString() || '0'),
        creditorName: creditor.name || 'N/A',
        creditorDocument: creditor.document || 'N/A',
        creditorAddress: creditor.address,
        creditorEmail: creditor.email,
        creditorPhone: creditor.phone,

        debtorId: debtor.id,
        debtorName: debtor.name || 'N/A',
        debtorDocument: debtor.document || 'N/A',
        debtorAddress: debtor.address,
        debtorEmail: debtor.email,
        debtorPhone: debtor.phone,

        title,
        subject,
        description,
        legalBasis,
        demandedAction,

        principalAmount,
        fineAmount,
        interestAmount,
        correctionAmount,
        totalAmount,

        deadlineDays: legalDeadlineDays,
        deadlineDate: this.calculateDeadlineDate(legalDeadlineDays),
        consequencesText,

        provisionalHash: authHash,
        createdBy: BigInt(creditor.id?.toString() || '0'),
      },
    });

    // Create audit entry
    await this.prisma.extrajudicialNotificationAudit.create({
      data: {
        notificationId: notification.id,
        action: 'AUTO_GENERATED',
        performedBy: BigInt(creditor.id?.toString() || '0'),
        details: JSON.stringify({
          daysOverdue,
          principalAmount,
          totalAmount,
          contractToken: contract.contractToken,
          generatedBySystem: true,
        }),
      },
    });

    this.logger.log(`Generated extrajudicial notification ${notification.notificationToken} for contract ${contract.contractToken || contract.id}`);

    return notification;
  }

  /**
   * Generate unique token
   */
  private generateToken(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `MR3X-NOT-${year}-${random}`;
  }

  /**
   * Generate notification number
   */
  private generateNotificationNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `MR3X-NOT-${year}-${random}`;
  }

  /**
   * Generate protocol number
   */
  private generateProtocolNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PROT-${dateStr}-${random}`;
  }

  /**
   * Generate hash
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
  }

  /**
   * Calculate deadline date
   */
  private calculateDeadlineDate(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * Convert number to words (Portuguese)
   */
  private numberToWords(num: number): string {
    const words: Record<number, string> = {
      1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
      6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
      11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
      16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove', 20: 'vinte',
      30: 'trinta', 45: 'quarenta e cinco', 60: 'sessenta', 90: 'noventa',
    };
    return words[num] || num.toString();
  }

  /**
   * Check and update expired deadlines
   * Runs daily to mark notifications with expired deadlines
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handleExpiredDeadlines() {
    this.logger.log('Checking for expired extrajudicial notification deadlines...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find notifications with expired deadlines that are still pending
      const expiredNotifications = await this.prisma.extrajudicialNotification.findMany({
        where: {
          status: {
            in: ['GERADO', 'ENVIADO', 'VISUALIZADO'],
          },
          deadlineDate: {
            lt: today,
          },
        },
      });

      this.logger.log(`Found ${expiredNotifications.length} notifications with expired deadlines`);

      for (const notification of expiredNotifications) {
        // Update status to PRAZO_EXPIRADO
        await this.prisma.extrajudicialNotification.update({
          where: { id: notification.id },
          data: { status: 'PRAZO_EXPIRADO' },
        });

        // Create audit entry
        await this.prisma.extrajudicialNotificationAudit.create({
          data: {
            notificationId: notification.id,
            action: 'DEADLINE_EXPIRED',
            performedBy: notification.createdBy,
            details: JSON.stringify({
              deadlineDate: notification.deadlineDate,
              expiredAt: today,
              autoUpdated: true,
            }),
          },
        });

        this.logger.log(`Marked notification ${notification.notificationToken} as deadline expired`);
      }

      this.logger.log('Completed expired deadlines check');
    } catch (error) {
      this.logger.error('Error checking expired deadlines:', error);
    }
  }
}
