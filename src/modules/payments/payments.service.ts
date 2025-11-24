import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import { PaymentCreateDTO, PaymentUpdateDTO } from './payments.dto';
import { createAuditLog } from '../../shared/utils/audit-logger';

export class PaymentsService {
  async getPayments(userId: string, role: string, userAgencyId?: string, userBrokerId?: string) {
    try {
      const where: any = {};

      // CEO and ADMIN can see all payments
      if (role === 'CEO' || role === 'ADMIN') {
        // No additional filtering - can see all payments
      }
      // AGENCY_MANAGER can see all payments in their agency
      else if (role === 'AGENCY_MANAGER' && userAgencyId) {
        where.agencyId = BigInt(userAgencyId);
      }
      // BROKER can see payments for properties assigned to them or their agency
      else if (role === 'BROKER') {
        if (userBrokerId) {
          where.property = {
            brokerId: BigInt(userBrokerId),
          };
        } else if (userAgencyId) {
          where.agencyId = BigInt(userAgencyId);
        }
      }
      // PROPRIETARIO can only see payments for their properties
      else if (role === 'PROPRIETARIO') {
        where.property = {
          ownerId: BigInt(userId),
        };
      }
      // INDEPENDENT_OWNER can only see payments for their properties
      else if (role === 'INDEPENDENT_OWNER') {
        where.property = {
          ownerId: BigInt(userId),
        };
      }
      // INQUILINO can only see their own payments
      else if (role === 'INQUILINO') {
        where.userId = BigInt(userId);
      }
      // LEGAL_AUDITOR can see all payments (read-only)
      else if (role === 'LEGAL_AUDITOR') {
        // No additional filtering - can see all payments
      }
      // Other roles have no access
      else {
        where.id = BigInt(-1); // This will return no results
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          contract: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          agency: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { dataPagamento: 'desc' },
      }).catch(() => []);

      return payments.map(payment => ({
        ...payment,
        id: payment.id.toString(),
        propertyId: payment.propertyId.toString(),
        contractId: payment.contratoId.toString(),
        userId: payment.userId.toString(),
        agencyId: payment.agencyId ? payment.agencyId.toString() : null,
        property: payment.property ? {
          ...payment.property,
          id: payment.property.id.toString(),
        } : null,
        contract: payment.contract ? {
          ...payment.contract,
          id: payment.contract.id.toString(),
        } : null,
        user: payment.user ? {
          ...payment.user,
          id: payment.user.id.toString(),
        } : null,
        agency: payment.agency ? {
          ...payment.agency,
          id: payment.agency.id.toString(),
        } : null,
      }));
    } catch (error: any) {
      console.error('Error in getPayments service:', error);
      throw error;
    }
  }

  async getPaymentById(paymentId: string, userId: string, role: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            ownerId: true,
          },
        },
        contract: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Check access permissions
    if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER' || role === 'GESTOR') {
      if (payment.property.ownerId.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'INQUILINO') {
      if (payment.userId.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    }

    return payment;
  }

  async createPayment(userId: string, data: PaymentCreateDTO) {
    // Verify property and contract belong to user or user is tenant
    const property = await prisma.property.findUnique({
      where: { id: BigInt(data.propertyId) },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    const contract = await prisma.contract.findUnique({
      where: { id: BigInt(data.contratoId) },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    // Convert base64 comprovante if provided
    let comprovanteBuffer: Buffer | undefined;
    if (data.comprovante) {
      comprovanteBuffer = Buffer.from(data.comprovante, 'base64');
    }

    const payment = await prisma.payment.create({
      data: {
        valorPago: data.valorPago,
        dataPagamento: new Date(data.dataPagamento),
        contratoId: BigInt(data.contratoId),
        propertyId: BigInt(data.propertyId),
        userId: BigInt(userId),
        tipo: data.tipo,
        comprovante: comprovanteBuffer,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        contract: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update contract's last payment date
    await prisma.contract.update({
      where: { id: BigInt(data.contratoId) },
      data: {
        lastPaymentDate: new Date(data.dataPagamento),
      },
    });

    // Create audit log
    await createAuditLog({
      event: 'PAYMENT_CREATED',
      userId: userId,
      entity: 'PAYMENT',
      entityId: payment.id.toString(),
      dataAfter: {
        amount: payment.valorPago.toString(),
        date: payment.dataPagamento,
        type: payment.tipo,
      },
    });

    return payment;
  }

  async updatePayment(paymentId: string, userId: string, role: string, data: PaymentUpdateDTO) {
    const existing = await prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Payment not found');
    }

    // Check permissions
    if (role !== 'ADMIN' && existing.property.ownerId.toString() !== userId) {
      throw new ForbiddenError('Access denied');
    }

    const dataBefore = {
      amount: existing.valorPago.toString(),
      date: existing.dataPagamento,
      type: existing.tipo,
    };

    const payment = await prisma.payment.update({
      where: { id: BigInt(paymentId) },
      data: {
        valorPago: data.valorPago,
        dataPagamento: data.dataPagamento ? new Date(data.dataPagamento) : undefined,
        contratoId: data.contratoId ? BigInt(data.contratoId) : undefined,
        propertyId: data.propertyId ? BigInt(data.propertyId) : undefined,
        tipo: data.tipo,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        contract: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      event: 'PAYMENT_UPDATED',
      userId: userId,
      entity: 'PAYMENT',
      entityId: payment.id.toString(),
      dataBefore,
      dataAfter: {
        amount: payment.valorPago.toString(),
        date: payment.dataPagamento,
        type: payment.tipo,
      },
    });

    return payment;
  }

  async deletePayment(paymentId: string, userId: string, role: string) {
    const existing = await prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Payment not found');
    }

    // Check permissions
    if (role !== 'ADMIN' && existing.property.ownerId.toString() !== userId) {
      throw new ForbiddenError('Access denied');
    }

    // Create audit log before deletion
    await createAuditLog({
      event: 'PAYMENT_DELETED',
      userId: userId,
      entity: 'PAYMENT',
      entityId: existing.id.toString(),
      dataBefore: {
        amount: existing.valorPago.toString(),
        date: existing.dataPagamento,
        type: existing.tipo,
      },
    });

    await prisma.payment.delete({
      where: { id: BigInt(paymentId) },
    });
  }

  async getAnnualReport(userId: string, role: string, year?: number) {
    try {
      const targetYear = year || new Date().getFullYear();
      const startDate = new Date(targetYear, 0, 1);
      const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

      const where: any = {
        dataPagamento: {
          gte: startDate,
          lte: endDate,
        },
      };

      // CEO and ADMIN can see all payments
      if (role === 'CEO' || role === 'ADMIN' || role === 'LEGAL_AUDITOR') {
        // No additional filtering - can see all payments
      }
      // PROPRIETARIO can only see payments for their properties
      else if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER' || role === 'GESTOR') {
        where.property = {
          ownerId: BigInt(userId),
        };
      }
      // INQUILINO can only see their own payments
      else if (role === 'INQUILINO') {
        where.userId = BigInt(userId);
      }
      // AGENCY_MANAGER can see all payments in their agency
      else if (role === 'AGENCY_MANAGER') {
        // Will need to filter by agency if agencyId is available
      }
      // Other roles have no access
      else {
        where.id = BigInt(-1); // This will return no results
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
        orderBy: { dataPagamento: 'asc' },
      }).catch(() => []);

    // Group by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(targetYear, i, 1).toLocaleDateString('pt-BR', { month: 'long' }),
      total: 0,
      count: 0,
      byType: {
        ALUGUEL: 0,
        CONDOMINIO: 0,
        IPTU: 0,
        OUTROS: 0,
      },
    }));

      payments.forEach(payment => {
        const month = new Date(payment.dataPagamento).getMonth();
        monthlyData[month].total += Number(payment.valorPago) || 0;
        monthlyData[month].count += 1;
        const paymentType = payment.tipo as keyof typeof monthlyData[0]['byType'];
        if (monthlyData[month].byType[paymentType] !== undefined) {
          monthlyData[month].byType[paymentType] += Number(payment.valorPago) || 0;
        } else {
          monthlyData[month].byType.OUTROS += Number(payment.valorPago) || 0;
        }
      });

      const totalYear = payments.reduce((sum, p) => sum + (Number(p.valorPago) || 0), 0);

      return {
        year: targetYear,
        total: totalYear,
        totalPayments: payments.length,
        monthly: monthlyData,
        payments,
      };
    } catch (error: any) {
      console.error('Error in getAnnualReport service:', error);
      throw error;
    }
  }
}

