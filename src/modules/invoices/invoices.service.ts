import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto';
import { UpdateInvoiceDto, MarkAsPaidDto, CancelInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  private serializeInvoice(invoice: any) {
    return {
      ...invoice,
      id: invoice.id?.toString(),
      contractId: invoice.contractId?.toString(),
      propertyId: invoice.propertyId?.toString(),
      agencyId: invoice.agencyId?.toString(),
      tenantId: invoice.tenantId?.toString(),
      ownerId: invoice.ownerId?.toString(),
      createdBy: invoice.createdBy?.toString(),
      originalValue: invoice.originalValue ? Number(invoice.originalValue) : null,
      fine: invoice.fine ? Number(invoice.fine) : null,
      interest: invoice.interest ? Number(invoice.interest) : null,
      discount: invoice.discount ? Number(invoice.discount) : null,
      updatedValue: invoice.updatedValue ? Number(invoice.updatedValue) : null,
      paidValue: invoice.paidValue ? Number(invoice.paidValue) : null,
      ownerAmount: invoice.ownerAmount ? Number(invoice.ownerAmount) : null,
      agencyAmount: invoice.agencyAmount ? Number(invoice.agencyAmount) : null,
      platformFee: invoice.platformFee ? Number(invoice.platformFee) : null,
      gatewayFee: invoice.gatewayFee ? Number(invoice.gatewayFee) : null,
      contract: invoice.contract ? {
        ...invoice.contract,
        id: invoice.contract.id?.toString(),
        propertyId: invoice.contract.propertyId?.toString(),
        tenantId: invoice.contract.tenantId?.toString(),
        ownerId: invoice.contract.ownerId?.toString(),
        agencyId: invoice.contract.agencyId?.toString(),
        monthlyRent: invoice.contract.monthlyRent ? Number(invoice.contract.monthlyRent) : null,
      } : null,
      property: invoice.property ? {
        ...invoice.property,
        id: invoice.property.id?.toString(),
        ownerId: invoice.property.ownerId?.toString(),
        agencyId: invoice.property.agencyId?.toString(),
      } : null,
      tenant: invoice.tenant ? {
        ...invoice.tenant,
        id: invoice.tenant.id?.toString(),
      } : null,
      owner: invoice.owner ? {
        ...invoice.owner,
        id: invoice.owner.id?.toString(),
      } : null,
      transfers: invoice.transfers?.map((t: any) => ({
        ...t,
        id: t.id?.toString(),
        invoiceId: t.invoiceId?.toString(),
        recipientId: t.recipientId?.toString(),
        grossValue: t.grossValue ? Number(t.grossValue) : null,
        mr3xFee: t.mr3xFee ? Number(t.mr3xFee) : null,
        pspFee: t.pspFee ? Number(t.pspFee) : null,
        retainedTax: t.retainedTax ? Number(t.retainedTax) : null,
        transferredValue: t.transferredValue ? Number(t.transferredValue) : null,
      })),
    };
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    agencyId?: string;
    propertyId?: string;
    contractId?: string;
    tenantId?: string;
    ownerId?: string;
    status?: string;
    type?: string;
    referenceMonth?: string;
    startDate?: string;
    endDate?: string;
    createdById?: string;
    userId?: string;
  }) {
    const {
      skip = 0,
      take = 50,
      agencyId,
      propertyId,
      contractId,
      tenantId,
      ownerId,
      status,
      type,
      referenceMonth,
      startDate,
      endDate,
      createdById,
      userId,
    } = params;

    const where: any = {};

    if (agencyId) where.agencyId = BigInt(agencyId);
    if (propertyId) where.propertyId = BigInt(propertyId);
    if (contractId) where.contractId = BigInt(contractId);
    if (tenantId) where.tenantId = BigInt(tenantId);
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (status) where.status = status;
    if (type) where.type = type;
    if (referenceMonth) where.referenceMonth = referenceMonth;
    if (createdById) where.createdBy = BigInt(createdById);

    // Date range filter
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    // Fallback filter for users without explicit agency
    if (!agencyId && !createdById && userId) {
      where.OR = [
        { tenantId: BigInt(userId) },
        { ownerId: BigInt(userId) },
        { createdBy: BigInt(userId) },
        { contract: { property: { createdBy: BigInt(userId) } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        include: {
          contract: {
            select: {
              id: true,
              propertyId: true,
              tenantId: true,
              ownerId: true,
              agencyId: true,
              startDate: true,
              endDate: true,
              monthlyRent: true,
              status: true,
            },
          },
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              neighborhood: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              document: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          transfers: {
            include: {
              recipient: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices.map((inv) => this.serializeInvoice(inv)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
      include: {
        contract: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                neighborhood: true,
              },
            },
            tenantUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                document: true,
              },
            },
            ownerUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            neighborhood: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        transfers: {
          include: {
            recipient: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    return this.serializeInvoice(invoice);
  }

  async create(data: CreateInvoiceDto, userId: string, userAgencyId?: string) {
    // Get contract to auto-populate fields
    const contract = await this.prisma.contract.findUnique({
      where: { id: BigInt(data.contractId) },
      include: {
        property: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }

    // Calculate updated value
    const originalValue = data.originalValue;
    const fine = data.fine || 0;
    const interest = data.interest || 0;
    const discount = data.discount || 0;
    const updatedValue = originalValue + fine + interest - discount;

    // Generate invoice number
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const invoiceNumber = `INV-${year}${month}-${random}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        contractId: BigInt(data.contractId),
        propertyId: data.propertyId ? BigInt(data.propertyId) : contract.propertyId,
        agencyId: data.agencyId ? BigInt(data.agencyId) : (userAgencyId ? BigInt(userAgencyId) : contract.agencyId),
        tenantId: data.tenantId ? BigInt(data.tenantId) : contract.tenantId,
        ownerId: data.ownerId ? BigInt(data.ownerId) : contract.ownerId,
        invoiceNumber,
        referenceMonth: data.referenceMonth,
        description: data.description,
        type: data.type,
        dueDate: new Date(data.dueDate),
        originalValue: originalValue,
        fine: fine,
        interest: interest,
        discount: discount,
        updatedValue: updatedValue,
        ownerAmount: data.ownerAmount,
        agencyAmount: data.agencyAmount,
        status: InvoiceStatus.PENDING,
        notes: data.notes,
        createdBy: BigInt(userId),
      },
      include: {
        contract: true,
        property: true,
        tenant: true,
        owner: true,
      },
    });

    return this.serializeInvoice(invoice);
  }

  async update(id: string, data: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    // Don't allow editing paid invoices
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Não é possível editar uma fatura já paga');
    }

    // Recalculate updated value if financial fields changed
    let updatedValue = Number(invoice.updatedValue);
    if (data.fine !== undefined || data.interest !== undefined || data.discount !== undefined) {
      const originalValue = Number(invoice.originalValue);
      const fine = data.fine ?? Number(invoice.fine || 0);
      const interest = data.interest ?? Number(invoice.interest || 0);
      const discount = data.discount ?? Number(invoice.discount || 0);
      updatedValue = originalValue + fine + interest - discount;
    }

    const updated = await this.prisma.invoice.update({
      where: { id: BigInt(id) },
      data: {
        description: data.description,
        fine: data.fine,
        interest: data.interest,
        discount: data.discount,
        updatedValue: updatedValue,
        status: data.status,
        notes: data.notes,
      },
      include: {
        contract: true,
        property: true,
        tenant: true,
        owner: true,
      },
    });

    return this.serializeInvoice(updated);
  }

  async markAsPaid(id: string, data: MarkAsPaidDto, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Fatura já está paga');
    }

    if (invoice.status === 'CANCELED') {
      throw new BadRequestException('Não é possível pagar uma fatura cancelada');
    }

    const paidValue = data.paidValue ?? Number(invoice.updatedValue);
    const paidAt = data.paidAt ? new Date(data.paidAt) : new Date();

    const updated = await this.prisma.invoice.update({
      where: { id: BigInt(id) },
      data: {
        status: InvoiceStatus.PAID,
        paidValue: paidValue,
        paidAt: paidAt,
        paymentMethod: data.paymentMethod,
        notes: data.notes ? `${invoice.notes || ''}\n[Pagamento] ${data.notes}`.trim() : invoice.notes,
      },
      include: {
        contract: true,
        property: true,
        tenant: true,
        owner: true,
      },
    });

    return this.serializeInvoice(updated);
  }

  async cancel(id: string, data: CancelInvoiceDto, userId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Não é possível cancelar uma fatura já paga');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: BigInt(id) },
      data: {
        status: InvoiceStatus.CANCELED,
        notes: data.reason ? `${invoice.notes || ''}\n[Cancelamento] ${data.reason}`.trim() : invoice.notes,
      },
      include: {
        contract: true,
        property: true,
        tenant: true,
        owner: true,
      },
    });

    return this.serializeInvoice(updated);
  }

  async resendToTenant(id: string, email?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
      include: {
        tenant: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    const targetEmail = email || invoice.tenant?.email;
    if (!targetEmail) {
      throw new BadRequestException('Email do inquilino não encontrado');
    }

    // Here you would integrate with your email service
    // For now, we just update the emailSentAt timestamp
    await this.prisma.invoice.update({
      where: { id: BigInt(id) },
      data: {
        emailSentAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Fatura reenviada para ${targetEmail}`,
    };
  }

  async getStatistics(params: { agencyId?: string; createdById?: string; userId?: string }) {
    const { agencyId, createdById, userId } = params;

    const where: any = {};
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (createdById) where.createdBy = BigInt(createdById);
    if (!agencyId && !createdById && userId) {
      where.OR = [
        { tenantId: BigInt(userId) },
        { ownerId: BigInt(userId) },
        { createdBy: BigInt(userId) },
      ];
    }

    const [total, pending, paid, overdue, canceled] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.invoice.count({ where: { ...where, status: 'PAID' } }),
      this.prisma.invoice.count({ where: { ...where, status: 'OVERDUE' } }),
      this.prisma.invoice.count({ where: { ...where, status: 'CANCELED' } }),
    ]);

    // Calculate totals
    const pendingSum = await this.prisma.invoice.aggregate({
      where: { ...where, status: 'PENDING' },
      _sum: { updatedValue: true },
    });

    const paidSum = await this.prisma.invoice.aggregate({
      where: { ...where, status: 'PAID' },
      _sum: { paidValue: true },
    });

    const overdueSum = await this.prisma.invoice.aggregate({
      where: { ...where, status: 'OVERDUE' },
      _sum: { updatedValue: true },
    });

    return {
      total,
      byStatus: {
        pending,
        paid,
        overdue,
        canceled,
      },
      totals: {
        pending: pendingSum._sum.updatedValue ? Number(pendingSum._sum.updatedValue) : 0,
        paid: paidSum._sum.paidValue ? Number(paidSum._sum.paidValue) : 0,
        overdue: overdueSum._sum.updatedValue ? Number(overdueSum._sum.updatedValue) : 0,
      },
    };
  }

  async downloadInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    // Return boleto URL or payment link
    return {
      boletoUrl: invoice.boletoUrl,
      paymentLink: invoice.paymentLink,
      pixQrCode: invoice.pixQrCode,
      pixCopyPaste: invoice.pixCopyPaste,
      barcode: invoice.barcode,
      boletoDigitableLine: invoice.boletoDigitableLine,
    };
  }

  async downloadReceipt(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: BigInt(id) },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    if (invoice.status !== 'PAID') {
      throw new BadRequestException('Comprovante disponível apenas para faturas pagas');
    }

    return {
      receiptUrl: invoice.receiptUrl,
      invoiceNumber: invoice.invoiceNumber,
      paidAt: invoice.paidAt,
      paidValue: invoice.paidValue ? Number(invoice.paidValue) : null,
      paymentMethod: invoice.paymentMethod,
    };
  }

  // Update overdue invoices (can be called by a cron job)
  async updateOverdueInvoices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updated = await this.prisma.invoice.updateMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: today,
        },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    return {
      updated: updated.count,
    };
  }
}
