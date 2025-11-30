import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreatePaymentDto, PaymentType } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, role: string, userAgencyId?: string, userBrokerId?: string) {
    try {
      const where: any = {};

      // CEO can see all payments
      if (role === 'CEO') {
        // No additional filtering - can see all payments
      }
      // ADMIN sees only payments for properties they created (each admin is independent)
      else if (role === 'ADMIN') {
        where.property = {
          createdBy: BigInt(userId),
        };
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
      // INDEPENDENT_OWNER can only see payments for properties they created
      else if (role === 'INDEPENDENT_OWNER') {
        where.property = {
          createdBy: BigInt(userId),
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

      const payments = await this.prisma.payment.findMany({
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
      });

      return payments.map(payment => ({
        ...payment,
        id: payment.id.toString(),
        propertyId: payment.propertyId?.toString(),
        contractId: payment.contratoId?.toString(),
        userId: payment.userId?.toString(),
        agencyId: payment.agencyId?.toString() || null,
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

  async findByProperty(propertyId: string, userId: string, role: string) {
    try {
      const payments = await this.prisma.payment.findMany({
        where: { propertyId: BigInt(propertyId) },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return payments.map(payment => ({
        id: payment.id.toString(),
        valorPago: payment.valorPago?.toString(),
        dataPagamento: payment.dataPagamento?.toISOString(),
        contratoId: payment.contratoId?.toString() || null,
        propertyId: payment.propertyId?.toString(),
        userId: payment.userId?.toString(),
        agencyId: payment.agencyId?.toString() || null,
        tipo: payment.tipo,
        description: payment.description,
        dueDate: payment.dueDate?.toISOString() || null,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt?.toISOString() || null,
      }));
    } catch (error: any) {
      console.error('Error in findByProperty service:', error);
      throw error;
    }
  }

  async findOne(paymentId: string, userId: string, role: string) {
    const payment = await this.prisma.payment.findUnique({
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
      throw new NotFoundException('Payment not found');
    }

    // Check access permissions
    if (role === 'PROPRIETARIO' || role === 'GESTOR') {
      if (payment.property?.ownerId?.toString() !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER checks by createdBy field
      const property = await this.prisma.property.findUnique({
        where: { id: payment.propertyId },
        select: { createdBy: true },
      });
      if (property?.createdBy?.toString() !== userId) {
        throw new ForbiddenException('Access denied');
      }
    } else if (role === 'INQUILINO') {
      if (payment.userId?.toString() !== userId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return {
      ...payment,
      id: payment.id.toString(),
      propertyId: payment.propertyId?.toString(),
      contractId: payment.contratoId?.toString(),
      userId: payment.userId?.toString(),
      agencyId: payment.agencyId?.toString() || null,
      property: payment.property ? {
        ...payment.property,
        id: payment.property.id.toString(),
        ownerId: payment.property.ownerId?.toString(),
      } : null,
      contract: payment.contract ? {
        ...payment.contract,
        id: payment.contract.id.toString(),
      } : null,
      user: payment.user ? {
        ...payment.user,
        id: payment.user.id.toString(),
      } : null,
    };
  }

  async create(userId: string, data: CreatePaymentDto) {
    try {
      console.log('Creating payment with data:', JSON.stringify(data));
      console.log('User ID:', userId);

      // Verify property exists
      const property = await this.prisma.property.findUnique({
        where: { id: BigInt(data.propertyId) },
      });

      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // Verify contract exists if provided
      if (data.contratoId) {
        const contract = await this.prisma.contract.findUnique({
          where: { id: BigInt(data.contratoId) },
        });

        if (!contract) {
          throw new NotFoundException('Contract not found');
        }
      }

      const payment = await this.prisma.payment.create({
        data: {
          valorPago: data.valorPago,
          dataPagamento: new Date(data.dataPagamento),
          contratoId: data.contratoId ? BigInt(data.contratoId) : null,
          propertyId: BigInt(data.propertyId),
          userId: BigInt(userId),
          agencyId: property.agencyId,
          tipo: data.tipo,
          comprovante: data.comprovante ? Buffer.from(data.comprovante, 'base64') : null,
          description: data.description || null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: data.status || 'PENDING',
          paymentMethod: data.paymentMethod || null,
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

      // Update contract's last payment date if contract exists
      if (data.contratoId) {
        await this.prisma.contract.update({
          where: { id: BigInt(data.contratoId) },
          data: {
            lastPaymentDate: new Date(data.dataPagamento),
          },
        });
      }

      // Update property's next due date if dueDate is provided
      if (data.dueDate) {
        await this.prisma.property.update({
          where: { id: BigInt(data.propertyId) },
          data: {
            nextDueDate: new Date(data.dueDate),
          },
        });
      }

      return {
        id: payment.id.toString(),
        valorPago: payment.valorPago?.toString(),
        dataPagamento: payment.dataPagamento?.toISOString(),
        contratoId: payment.contratoId?.toString() || null,
        propertyId: payment.propertyId?.toString(),
        userId: payment.userId?.toString(),
        agencyId: payment.agencyId?.toString() || null,
        tipo: payment.tipo,
        description: payment.description,
        dueDate: payment.dueDate?.toISOString() || null,
        status: payment.status,
        property: payment.property ? {
          id: payment.property.id.toString(),
          name: payment.property.name,
          address: payment.property.address,
        } : null,
        contract: payment.contract ? {
          id: payment.contract.id.toString(),
          startDate: payment.contract.startDate?.toISOString(),
          endDate: payment.contract.endDate?.toISOString(),
        } : null,
        user: payment.user ? {
          id: payment.user.id.toString(),
          name: payment.user.name,
          email: payment.user.email,
        } : null,
      };
    } catch (error: any) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  async update(paymentId: string, userId: string, role: string, data: UpdatePaymentDto) {
    const existing = await this.prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    // Check permissions
    if (role !== 'ADMIN' && role !== 'CEO' && existing.property?.ownerId?.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const payment = await this.prisma.payment.update({
      where: { id: BigInt(paymentId) },
      data: {
        valorPago: data.valorPago,
        dataPagamento: data.dataPagamento ? new Date(data.dataPagamento) : undefined,
        contratoId: data.contratoId ? BigInt(data.contratoId) : undefined,
        propertyId: data.propertyId ? BigInt(data.propertyId) : undefined,
        tipo: data.tipo,
      },
    });

    return {
      id: payment.id.toString(),
      valorPago: payment.valorPago,
      dataPagamento: payment.dataPagamento,
      tipo: payment.tipo,
      propertyId: payment.propertyId?.toString(),
      contractId: payment.contratoId?.toString(),
      userId: payment.userId?.toString(),
      agencyId: payment.agencyId?.toString() || null,
    };
  }

  async remove(paymentId: string, userId: string, role: string) {
    const existing = await this.prisma.payment.findUnique({
      where: { id: BigInt(paymentId) },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    // Check permissions
    if (role !== 'ADMIN' && role !== 'CEO' && existing.property?.ownerId?.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.payment.delete({
      where: { id: BigInt(paymentId) },
    });

    return { success: true };
  }

  async getAnnualReport(userId: string, role: string, year?: number, userAgencyId?: string) {
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

      // CEO and LEGAL_AUDITOR can see all payments
      if (role === 'CEO' || role === 'LEGAL_AUDITOR') {
        // No additional filtering - can see all payments
      }
      // ADMIN sees only payments for properties they created
      else if (role === 'ADMIN') {
        where.property = {
          createdBy: BigInt(userId),
        };
      }
      // PROPRIETARIO can only see payments for their properties
      else if (role === 'PROPRIETARIO' || role === 'GESTOR') {
        where.property = {
          ownerId: BigInt(userId),
        };
      }
      // INDEPENDENT_OWNER can only see payments for properties they created
      else if (role === 'INDEPENDENT_OWNER') {
        where.property = {
          createdBy: BigInt(userId),
        };
      }
      // INQUILINO can only see their own payments
      else if (role === 'INQUILINO') {
        where.userId = BigInt(userId);
      }
      // AGENCY_MANAGER can see all payments in their agency
      else if (role === 'AGENCY_MANAGER' && userAgencyId) {
        where.agencyId = BigInt(userAgencyId);
      }
      // Other roles have no access
      else {
        where.id = BigInt(-1); // This will return no results
      }

      // Use parallel queries for better performance
      const [aggregateResult, totalCount] = await Promise.all([
        // Get total sum
        this.prisma.payment.aggregate({
          where,
          _sum: {
            valorPago: true,
          },
        }),
        // Get count
        this.prisma.payment.count({ where }),
      ]);

      // Get payments only with necessary fields for monthly grouping
      // Limit to essential data to reduce memory and transfer time
      const payments = await this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          dataPagamento: true,
          valorPago: true,
          tipo: true,
        },
        orderBy: { dataPagamento: 'asc' },
      });

      // Group by month in memory (faster than multiple DB queries)
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
        } as Record<string, number>,
      }));

      payments.forEach(payment => {
        const month = new Date(payment.dataPagamento).getMonth();
        const valor = Number(payment.valorPago) || 0;
        monthlyData[month].total += valor;
        monthlyData[month].count += 1;
        const paymentType = payment.tipo as string;
        if (monthlyData[month].byType[paymentType] !== undefined) {
          monthlyData[month].byType[paymentType] += valor;
        } else {
          monthlyData[month].byType.OUTROS += valor;
        }
      });

      const totalYear = Number(aggregateResult._sum.valorPago) || 0;

      return {
        year: targetYear,
        total: totalYear,
        totalPayments: totalCount,
        monthly: monthlyData,
        // Don't return all payments - only return summary data for chart
        // This significantly reduces response size and improves performance
        payments: [],
      };
    } catch (error: any) {
      console.error('Error in getAnnualReport service:', error);
      throw error;
    }
  }
}
