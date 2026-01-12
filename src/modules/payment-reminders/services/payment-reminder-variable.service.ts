import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';

export interface VariableContext {
  tenantName?: string;
  tenantDocument?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  ownerName?: string;
  ownerDocument?: string;
  propertyAddress?: string;
  propertyCity?: string;
  rentAmount?: number;
  dueDate?: Date;
  referenceMonth?: string;
  paymentLink?: string;
  daysUntilDue?: number;
  daysOverdue?: number;
  lateFee?: number;
  interest?: number;
  totalAmount?: number;
  isBusiness?: boolean;
}

@Injectable()
export class PaymentReminderVariableService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Replace variables in template with actual values
   */
  replaceVariables(template: string, context: VariableContext): string {
    let result = template;

    // Tenant variables
    result = result.replace(/\[NOME\]/g, context.tenantName || '[NOME]');
    result = result.replace(/\[NAME\]/g, context.tenantName || '[NAME]');
    result = result.replace(/\[TENANT_NAME\]/g, context.tenantName || '[TENANT_NAME]');

    // Owner variables
    result = result.replace(/\[OWNER_NAME\]/g, context.ownerName || '[OWNER_NAME]');
    result = result.replace(/\[PROPRIETARIO\]/g, context.ownerName || '[PROPRIETARIO]');

    // Property variables
    result = result.replace(/\[PROPERTY_ADDRESS\]/g, context.propertyAddress || '[PROPERTY_ADDRESS]');
    result = result.replace(/\[ENDEREÇO\]/g, context.propertyAddress || '[ENDEREÇO]');
    result = result.replace(/\[PROPERTY_CITY\]/g, context.propertyCity || '[PROPERTY_CITY]');
    result = result.replace(/\[CIDADE\]/g, context.propertyCity || '[CIDADE]');

    // Financial variables
    result = result.replace(/\[RENT_AMOUNT\]/g, this.formatCurrency(context.rentAmount || 0));
    result = result.replace(/\[VALOR_ALUGUEL\]/g, this.formatCurrency(context.rentAmount || 0));
    result = result.replace(/\[TOTAL_AMOUNT\]/g, this.formatCurrency(context.totalAmount || context.rentAmount || 0));
    result = result.replace(/\[VALOR_TOTAL\]/g, this.formatCurrency(context.totalAmount || context.rentAmount || 0));
    result = result.replace(/\[LATE_FEE\]/g, this.formatCurrency(context.lateFee || 0));
    result = result.replace(/\[MULTA\]/g, this.formatCurrency(context.lateFee || 0));
    result = result.replace(/\[INTEREST\]/g, this.formatCurrency(context.interest || 0));
    result = result.replace(/\[JUROS\]/g, this.formatCurrency(context.interest || 0));

    // Date variables
    result = result.replace(/\[DUE_DATE\]/g, context.dueDate ? this.formatDate(context.dueDate) : '[DUE_DATE]');
    result = result.replace(/\[DATA_VENCIMENTO\]/g, context.dueDate ? this.formatDate(context.dueDate) : '[DATA_VENCIMENTO]');
    result = result.replace(/\[REFERENCE_MONTH\]/g, context.referenceMonth || '[REFERENCE_MONTH]');
    result = result.replace(/\[MES_REFERENCIA\]/g, context.referenceMonth || '[MES_REFERENCIA]');

    // Time variables
    if (context.daysUntilDue !== undefined) {
      result = result.replace(/\[DAYS_UNTIL_DUE\]/g, context.daysUntilDue.toString());
      result = result.replace(/\[DIAS_RESTANTES\]/g, context.daysUntilDue.toString());
    }
    if (context.daysOverdue !== undefined) {
      result = result.replace(/\[DAYS_OVERDUE\]/g, context.daysOverdue.toString());
      result = result.replace(/\[DIAS_ATRASO\]/g, context.daysOverdue.toString());
    }

    // Link variables
    result = result.replace(/\[LINK\]/g, context.paymentLink || '[LINK]');
    result = result.replace(/\[PAYMENT_LINK\]/g, context.paymentLink || '[PAYMENT_LINK]');

    return result;
  }

  /**
   * Get variable context from contract and invoice
   */
  async getVariableContext(
    contractId: bigint,
    invoiceId?: bigint,
  ): Promise<VariableContext> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        tenantUser: {
          select: {
            name: true,
            document: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        ownerUser: {
          select: {
            name: true,
            document: true,
          },
        },
        property: {
          select: {
            address: true,
            city: true,
            nextDueDate: true,
          },
        },
      },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    let invoice: any = null;
    if (invoiceId) {
      invoice = await this.prisma.invoice.findUnique({
        where: { id: BigInt(invoiceId) },
      });
    } else {
      // Get the most recent pending/overdue invoice
      invoice = await this.prisma.invoice.findFirst({
        where: {
          contractId: BigInt(contractId),
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        orderBy: { dueDate: 'desc' },
      });
    }

    const now = new Date();
    const dueDate = invoice?.dueDate || contract.property?.nextDueDate || new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

    // Generate payment link (you'll need to implement this based on your payment system)
    const paymentLink = this.generatePaymentLink(contractId, invoice?.id);

    // Format reference month
    const referenceMonth = invoice?.referenceMonth || this.getReferenceMonth(dueDate);

    return {
      tenantName: contract.tenantUser?.name || '',
      tenantDocument: contract.tenantUser?.document || '',
      tenantEmail: contract.tenantUser?.email || '',
      tenantPhone: contract.tenantUser?.phone || '',
      ownerName: contract.ownerUser?.name || '',
      ownerDocument: contract.ownerUser?.document || '',
      propertyAddress: contract.property?.address || '',
      propertyCity: contract.property?.city || '',
      rentAmount: invoice ? Number(invoice.originalValue) : Number(contract.monthlyRent),
      dueDate,
      referenceMonth,
      paymentLink,
      daysUntilDue,
      daysOverdue,
      lateFee: invoice ? Number(invoice.fine || 0) : 0,
      interest: invoice ? Number(invoice.interest || 0) : 0,
      totalAmount: invoice ? Number(invoice.updatedValue) : Number(contract.monthlyRent),
      isBusiness: false, // UserRole enum doesn't have BUSINESS, check tenant type from other fields if needed
    };
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('pt-BR');
  }

  private getReferenceMonth(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private generatePaymentLink(contractId: bigint, invoiceId?: bigint): string {
    const frontendUrl = process.env.FRONTEND_URL || 'https://mr3x.com.br';
    if (invoiceId) {
      return `${frontendUrl}/dashboard/payments/invoice/${invoiceId.toString()}`;
    }
    return `${frontendUrl}/dashboard/payments/contract/${contractId.toString()}`;
  }
}

