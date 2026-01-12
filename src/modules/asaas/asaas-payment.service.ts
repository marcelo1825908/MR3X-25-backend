import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AsaasService } from './asaas.service';
import { PaymentCreationResult } from './interfaces/asaas.interfaces';

export interface CreateAgreementPaymentDto {
  agreementId: string;
  userId: string;
  billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
}

export interface CreateInvoicePaymentDto {
  invoiceId: string;
  userId: string;
  billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
}

export interface CreateNotificationPaymentDto {
  notificationId: string;
  userId: string;
  billingType?: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
}

export interface PaymentLinkResult {
  success: boolean;
  paymentId?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  barcode?: string;
  digitableLine?: string;
  error?: string;
}

@Injectable()
export class AsaasPaymentService {
  private readonly logger = new Logger(AsaasPaymentService.name);

  constructor(
    private prisma: PrismaService,
    private asaasService: AsaasService,
  ) {}

  async createAgreementPayment(dto: CreateAgreementPaymentDto): Promise<PaymentLinkResult> {
    if (!this.asaasService.isEnabled()) {
      return { success: false, error: 'Payment gateway is not configured' };
    }

    const agreement = await this.prisma.agreement.findUnique({
      where: { id: BigInt(dto.agreementId) },
      include: {
        property: true,
        tenant: true,
      },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    if (agreement.status === 'CONCLUIDO') {
      throw new BadRequestException('Agreement is already completed');
    }

    const tenant = agreement.tenant;
    if (!tenant) {
      throw new BadRequestException('No tenant associated with this agreement');
    }

    const customerResult = await this.asaasService.syncCustomer({
      id: tenant.id.toString(),
      name: tenant.name || 'Cliente',
      email: tenant.email,
      document: tenant.document || '',
      phone: tenant.phone || undefined,
    });

    if (!customerResult.success || !customerResult.customerId) {
      return { success: false, error: customerResult.error || 'Failed to sync customer' };
    }

    const value = Number(agreement.negotiatedAmount) || Number(agreement.originalAmount);
    const installments = agreement.installments || 1;
    const installmentValue = installments > 1
      ? Number(agreement.installmentValue) || Math.ceil(value / installments * 100) / 100
      : value;

    const dueDate = this.asaasService.calculateDueDate(3);

    const propertyAddress = agreement.property?.address || agreement.propertyId.toString();
    const paymentResult = await this.asaasService.createCompletePayment({
      customerId: customerResult.customerId,
      value: installments > 1 ? installmentValue : value,
      dueDate,
      description: `Acordo - ${agreement.title || `Imóvel ${propertyAddress}`}`,
      externalReference: `agreement:${dto.agreementId}`,
      billingType: dto.billingType || 'UNDEFINED',
      installmentCount: installments > 1 ? installments : undefined,
    });

    if (!paymentResult.success) {
      return paymentResult;
    }

    await this.prisma.agreement.update({
      where: { id: BigInt(dto.agreementId) },
      data: {
        asaasPaymentId: paymentResult.paymentId,
        asaasPaymentLink: paymentResult.invoiceUrl,
        paymentStatus: 'PENDING',
        status: 'AGUARDANDO_ASSINATURA',
      },
    });

    this.logger.log(`Created Asaas payment ${paymentResult.paymentId} for agreement ${dto.agreementId}`);

    return paymentResult;
  }

  async createInvoicePayment(dto: CreateInvoicePaymentDto): Promise<PaymentLinkResult> {
    if (!this.asaasService.isEnabled()) {
      return { success: false, error: 'Payment gateway is not configured' };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(dto.invoiceId) },
      include: {
        contract: {
          include: {
            tenantUser: true,
          },
        },
        property: true,
        tenant: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    if (invoice.asaasId) {
      try {
        const existingPayment = await this.asaasService.getPayment(invoice.asaasId);
        const result: PaymentLinkResult = {
          success: true,
          paymentId: existingPayment.id,
          invoiceUrl: existingPayment.invoiceUrl,
          bankSlipUrl: existingPayment.bankSlipUrl,
        };

        if (existingPayment.billingType === 'PIX') {
          const pixData = await this.asaasService.getPixQrCode(existingPayment.id);
          result.pixQrCode = pixData.encodedImage;
          result.pixCopyPaste = pixData.payload;
        }

        return result;
      } catch (e) {
        this.logger.warn(`Could not get existing payment ${invoice.asaasId}, creating new one`);
      }
    }

    const tenant = invoice.tenant || invoice.contract?.tenantUser;
    if (!tenant) {
      throw new BadRequestException('No tenant associated with this invoice');
    }

    const customerResult = await this.asaasService.syncCustomer({
      id: tenant.id.toString(),
      name: tenant.name || 'Cliente',
      email: tenant.email,
      document: tenant.document || '',
      phone: tenant.phone || undefined,
    });

    if (!customerResult.success || !customerResult.customerId) {
      return { success: false, error: customerResult.error || 'Failed to sync customer' };
    }

    const baseValue = Number(invoice.originalValue);
    const fine = invoice.fine ? Number(invoice.fine) : 0;
    const interest = invoice.interest ? Number(invoice.interest) : 0;
    const discount = invoice.discount ? Number(invoice.discount) : 0;
    const totalValue = baseValue + fine + interest - discount;

    const dueDate = invoice.dueDate
      ? (new Date(invoice.dueDate) > new Date()
          ? this.asaasService.formatDate(invoice.dueDate)
          : this.asaasService.calculateDueDate(3))
      : this.asaasService.calculateDueDate(3);

    const paymentResult = await this.asaasService.createCompletePayment({
      customerId: customerResult.customerId,
      value: totalValue,
      dueDate,
      description: `Fatura ${invoice.invoiceNumber || invoice.id} - ${invoice.description || 'Aluguel'}`,
      externalReference: `invoice:${dto.invoiceId}`,
      billingType: dto.billingType || 'UNDEFINED',
      fine: fine > 0 ? { value: 2, type: 'PERCENTAGE' } : undefined,
      interest: interest > 0 ? { value: 1 } : undefined,
    });

    if (!paymentResult.success) {
      return paymentResult;
    }

    await this.prisma.invoice.update({
      where: { id: BigInt(dto.invoiceId) },
      data: {
        asaasId: paymentResult.paymentId,
        paymentLink: paymentResult.invoiceUrl,
        boletoUrl: paymentResult.bankSlipUrl,
        pixQrCode: paymentResult.pixQrCode,
        pixCopyPaste: paymentResult.pixCopyPaste,
        barcode: paymentResult.barcode,
        boletoDigitableLine: paymentResult.digitableLine,
        webhookStatus: 'PENDING',
        syncedAt: new Date(),
      },
    });

    this.logger.log(`Created Asaas payment ${paymentResult.paymentId} for invoice ${dto.invoiceId}`);

    return paymentResult;
  }

  async getPaymentStatus(paymentId: string): Promise<{
    status: string;
    paymentDate?: string;
    value?: number;
    billingType?: string;
  }> {
    if (!this.asaasService.isEnabled()) {
      throw new BadRequestException('Payment gateway is not configured');
    }

    const payment = await this.asaasService.getPayment(paymentId);

    return {
      status: this.asaasService.mapPaymentStatus(payment.status),
      paymentDate: payment.paymentDate || payment.confirmedDate,
      value: payment.value,
      billingType: payment.billingType,
    };
  }

  async cancelPayment(paymentId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.asaasService.isEnabled()) {
      return { success: false, error: 'Payment gateway is not configured' };
    }

    try {
      await this.asaasService.deletePayment(paymentId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async refundPayment(paymentId: string, value?: number): Promise<{ success: boolean; error?: string }> {
    if (!this.asaasService.isEnabled()) {
      return { success: false, error: 'Payment gateway is not configured' };
    }

    try {
      await this.asaasService.refundPayment(paymentId, value);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async markAsReceivedInCash(
    paymentId: string,
    paymentDate: Date,
    value: number,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.asaasService.isEnabled()) {
      return { success: false, error: 'Payment gateway is not configured' };
    }

    try {
      await this.asaasService.receiveInCash(
        paymentId,
        this.asaasService.formatDate(paymentDate),
        value,
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPixQrCode(paymentId: string): Promise<{
    success: boolean;
    qrCode?: string;
    copyPaste?: string;
    error?: string;
  }> {
    if (!this.asaasService.isEnabled()) {
      return { success: false, error: 'Payment gateway is not configured' };
    }

    try {
      const pixData = await this.asaasService.getPixQrCode(paymentId);
      return {
        success: true,
        qrCode: pixData.encodedImage,
        copyPaste: pixData.payload,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async syncPendingPayments(agencyId?: string): Promise<{ synced: number; errors: number }> {
    if (!this.asaasService.isEnabled()) {
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    const where: any = {
      asaasId: { not: null },
      status: { in: ['PENDING', 'OVERDUE'] },
    };
    if (agencyId) {
      where.agencyId = BigInt(agencyId);
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      take: 100,
    });

    for (const invoice of invoices) {
      try {
        const payment = await this.asaasService.getPayment(invoice.asaasId!);
        const status = this.asaasService.mapPaymentStatus(payment.status);

        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status,
            webhookStatus: payment.status,
            lastWebhookAt: new Date(),
            syncedAt: new Date(),
            paidAt: payment.paymentDate ? new Date(payment.paymentDate) : null,
            paidValue: status === 'PAID' ? payment.value : null,
          },
        });

        synced++;
      } catch (error) {
        this.logger.error(`Failed to sync invoice ${invoice.id}: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(`Synced ${synced} payments, ${errors} errors`);
    return { synced, errors };
  }
}
