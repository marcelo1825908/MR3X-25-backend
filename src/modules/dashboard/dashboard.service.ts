import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private buildDashboardResponse(
    properties: any[],
    contracts: any[],
    paymentsThisMonth: any[],
    pendingContracts: any[],
    recentPayments: any[],
  ) {
    const now = new Date();

    const totalProperties = properties.length;
    const occupiedProperties = properties.filter((p: any) => p.status === 'ALUGADO').length;
    const availableProperties = properties.filter((p: any) => p.status === 'DISPONIVEL').length;
    const maintenanceProperties = properties.filter((p: any) => p.status === 'MANUTENCAO').length;
    const pendingUnits = properties.filter((p: any) => p.status === 'PENDENTE').length;
    const overdueUnits = properties.filter((p: any) => p.status === 'ALUGADO' && p.nextDueDate && p.nextDueDate < now).length;
    const onTimeUnits = properties.filter((p: any) => p.status === 'ALUGADO' && p.nextDueDate && p.nextDueDate >= now).length;

    const monthlyRevenue = paymentsThisMonth.reduce((sum: number, payment: any) => {
      return sum + Number(payment.valorPago || 0);
    }, 0);

    const overdueValue = pendingContracts.reduce((sum: number, contract: any) => {
      return sum + Number(contract.monthlyRent || 0);
    }, 0);

    const overview = {
      totalProperties,
      occupiedProperties,
      availableProperties,
      maintenanceProperties,
      activeContracts: contracts.filter((c: any) => c.status === 'ATIVO').length,
      monthlyRevenue,
      pendingPayments: pendingContracts.length,
      receivedValue: monthlyRevenue,
      overdueValue,
      vacantUnits: availableProperties,
      overdueUnits,
      onTimeUnits,
      pendingUnits,
    };

    const mappedPending = pendingContracts.map((contract: any) => ({
      contractId: contract.id.toString(),
      property: contract.property
        ? {
            id: contract.property.id.toString(),
            name: contract.property.name,
            address: contract.property.address,
          }
        : null,
      tenant: contract.tenantUser
        ? {
            id: contract.tenantUser.id.toString(),
            name: contract.tenantUser.name,
            email: contract.tenantUser.email,
            phone: contract.tenantUser.phone,
          }
        : null,
      monthlyRent: contract.monthlyRent,
      lastPaymentDate: contract.lastPaymentDate,
      daysOverdue: contract.lastPaymentDate
        ? Math.floor((now.getTime() - contract.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    const mappedRecent = recentPayments.map((payment: any) => ({
      id: payment.id.toString(),
      amount: payment.valorPago,
      date: payment.dataPagamento,
      type: payment.tipo,
      property: payment.property
        ? {
            id: payment.property.id.toString(),
            name: payment.property.name,
            address: payment.property.address,
          }
        : null,
      tenant: payment.user
        ? {
            id: payment.user.id.toString(),
            name: payment.user.name,
          }
        : null,
      agency: payment.agency
        ? {
            id: payment.agency.id.toString(),
            name: payment.agency.name,
          }
        : null,
    }));

    return {
      overview,
      pendingPayments: mappedPending,
      recentPayments: mappedRecent,
    };
  }

  private emptyDashboard() {
    return this.buildDashboardResponse([], [], [], [], []);
  }

  async getCEODashboard() {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Platform-wide statistics
      const totalAgencies = await this.prisma.agency.count({
        where: { status: 'ACTIVE' },
      }).catch(() => 0);

      const totalUsers = await this.prisma.user.count({
        where: { status: 'ACTIVE' },
      }).catch(() => 0);

      const totalProperties = await this.prisma.property.count({
        where: { deleted: false },
      }).catch(() => 0);

      const occupiedProperties = await this.prisma.property.count({
        where: { deleted: false, status: 'ALUGADO' },
      }).catch(() => 0);

      const availableProperties = await this.prisma.property.count({
        where: { deleted: false, status: 'DISPONIVEL' },
      }).catch(() => 0);

      const activeContracts = await this.prisma.contract.count({
        where: { deleted: false, status: 'ATIVO' },
      }).catch(() => 0);

      // Calculate monthly revenue (all payments this month)
      const paymentsThisMonth = await this.prisma.payment.findMany({
        where: {
          dataPagamento: {
            gte: firstDayOfMonth,
          },
        },
      }).catch(() => []);

      const monthlyRevenue = (paymentsThisMonth as any[]).reduce((sum: number, p: any) => {
        const value = Number(p.valorPago) || 0;
        return sum + value;
      }, 0);

      // Calculate MR3X platform fee (2% of revenue)
      const platformFee = Number(monthlyRevenue) * 0.02;

      // Get overdue properties
      const overdueProperties = await this.prisma.property.findMany({
        where: {
          deleted: false,
          status: 'ALUGADO',
          nextDueDate: {
            lt: now,
          },
        },
      }).catch(() => []);

      const overdueCount = overdueProperties.length;

      // Calculate overdue revenue
      const overdueRevenue = (overdueProperties as any[]).reduce((sum: number, prop: any) => {
        const rent = Number(prop.monthlyRent) || 0;
        return sum + rent;
      }, 0);

      // Calculate received revenue (paid this month)
      const receivedRevenue = monthlyRevenue;

      // Get pending payments count
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const pendingPayments = await this.prisma.contract.count({
        where: {
          deleted: false,
          status: 'ATIVO',
          OR: [
            { lastPaymentDate: null },
            { lastPaymentDate: { lt: thirtyDaysAgo } },
          ],
        },
      }).catch(() => 0);

      // Get recent payments
      const recentPayments = await this.prisma.payment.findMany({
        orderBy: {
          dataPagamento: 'desc',
        },
        take: 10,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          agency: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }).catch(() => []);

      // Get top agencies by property count
      const agenciesWithStats = await this.prisma.agency.findMany({
        where: { status: 'ACTIVE' },
        include: {
          _count: {
            select: {
              properties: true,
              users: true,
              contracts: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }).catch(() => []);

      // Calculate default rate
      const totalDueProperties = await this.prisma.property.count({
        where: {
          deleted: false,
          status: 'ALUGADO',
          nextDueDate: { not: null },
        },
      }).catch(() => 0);
      const defaultRate = totalDueProperties > 0 ? (overdueCount / totalDueProperties) * 100 : 0;

      // Property status breakdown
      const maintenanceCount = await this.prisma.property.count({
        where: { deleted: false, status: 'MANUTENCAO' },
      }).catch(() => 0);

      const propertyStatusCounts = {
        available: availableProperties,
        occupied: occupiedProperties,
        overdue: overdueCount,
        maintenance: maintenanceCount,
      };

      return {
        overview: {
          totalAgencies,
          totalUsers,
          totalProperties,
          occupiedProperties,
          availableProperties,
          activeContracts,
          monthlyRevenue,
          platformFee,
          overdueCount,
          overdueRevenue,
          receivedRevenue,
          pendingPayments,
          defaultRate: parseFloat(defaultRate.toFixed(2)),
        },
        propertyStatus: propertyStatusCounts,
        topAgencies: agenciesWithStats.map((agency: any) => ({
          id: agency.id.toString(),
          name: agency.name,
          propertyCount: agency._count.properties,
          userCount: agency._count.users,
          contractCount: agency._count.contracts,
          plan: agency.plan,
        })),
        recentPayments: recentPayments.map((payment: any) => ({
          id: payment.id.toString(),
          amount: payment.valorPago,
          date: payment.dataPagamento,
          type: payment.tipo,
          property: payment.property || null,
          tenant: payment.user || null,
          agency: payment.agency || null,
        })),
        pendingPayments: await this.getPendingPaymentsForCEO().catch(() => []),
      };
    } catch (error: any) {
      console.error('Error in getCEODashboard:', error);
      throw error;
    }
  }

  private async getPendingPaymentsForCEO() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const pendingContracts = await this.prisma.contract.findMany({
        where: {
          deleted: false,
          status: 'ATIVO',
          OR: [
            { lastPaymentDate: null },
            { lastPaymentDate: { lt: thirtyDaysAgo } },
          ],
        },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          agency: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: 10,
      });

      return pendingContracts.map((contract: any) => ({
        contractId: contract.id.toString(),
        property: contract.property || null,
        tenant: contract.tenantUser || null,
        agency: contract.agency || null,
        monthlyRent: contract.monthlyRent,
        lastPaymentDate: contract.lastPaymentDate,
        daysOverdue: contract.lastPaymentDate
          ? Math.floor((now.getTime() - contract.lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      }));
    } catch (error: any) {
      console.error('Error in getPendingPaymentsForCEO:', error);
      return [];
    }
  }

  // Dashboard for ADMIN users - shows only data they created (each admin is independent)
  async getAdminDashboard(userId: string) {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const adminId = BigInt(userId);

      // Properties created by this admin
      const [properties, contracts, paymentsThisMonth, recentPayments, agencies] = await Promise.all([
        this.prisma.property.findMany({
          where: {
            deleted: false,
            createdBy: adminId,
          },
          select: {
            id: true,
            name: true,
            address: true,
            status: true,
            monthlyRent: true,
            nextDueDate: true,
            dueDay: true,
          },
        }),
        this.prisma.contract.findMany({
          where: {
            deleted: false,
            property: { createdBy: adminId },
          },
          include: {
            property: {
              select: {
                id: true,
                name: true,
                address: true,
                status: true,
                nextDueDate: true,
              },
            },
            tenantUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        }),
        this.prisma.payment.findMany({
          where: {
            property: { createdBy: adminId },
            dataPagamento: { gte: firstDayOfMonth },
          },
          select: { valorPago: true },
        }),
        this.prisma.payment.findMany({
          where: {
            property: { createdBy: adminId },
          },
          orderBy: { dataPagamento: 'desc' },
          take: 10,
          include: {
            property: {
              select: { id: true, name: true, address: true },
            },
            user: {
              select: { id: true, name: true },
            },
          },
        }),
        // Get agencies that have properties created by this admin
        this.prisma.agency.findMany({
          where: {
            status: 'ACTIVE',
            properties: {
              some: {
                createdBy: adminId,
              },
            },
          },
          include: {
            _count: {
              select: {
                properties: true,
                users: true,
                contracts: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

      const pendingContracts = contracts.filter((contract: any) => {
        if (contract.status !== 'ATIVO') return false;
        if (!contract.lastPaymentDate) return true;
        return contract.lastPaymentDate < thirtyDaysAgo;
      });

      // Build base dashboard response
      const baseDashboard = this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);

      // Add topAgencies for ADMIN
      const topAgencies = agencies.map((agency: any) => ({
        id: agency.id.toString(),
        name: agency.name,
        propertyCount: agency._count.properties,
        userCount: agency._count.users,
        contractCount: agency._count.contracts,
        plan: agency.plan,
      }));

      return {
        ...baseDashboard,
        topAgencies,
      };
    } catch (error: any) {
      console.error('Error in getAdminDashboard:', error);
      return this.emptyDashboard();
    }
  }

  // Dashboard for INDEPENDENT_OWNER - shows only properties they created (by createdBy, not ownerId)
  async getIndependentOwnerDashboard(userId: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const creatorId = BigInt(userId);

    const [properties, contracts, paymentsThisMonth, recentPayments] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          createdBy: creatorId,
          deleted: false,
        },
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          monthlyRent: true,
          nextDueDate: true,
          dueDay: true,
        },
      }),
      this.prisma.contract.findMany({
        where: {
          deleted: false,
          property: {
            createdBy: creatorId,
          },
        },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              status: true,
              nextDueDate: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          property: {
            createdBy: creatorId,
          },
          dataPagamento: {
            gte: firstDayOfMonth,
          },
        },
        select: {
          valorPago: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          property: {
            createdBy: creatorId,
          },
          dataPagamento: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: {
          dataPagamento: 'desc',
        },
        take: 10,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const pendingContracts = contracts.filter((contract: any) => {
      if (contract.status !== 'ATIVO') return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }

  async getOwnerDashboard(userId: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [properties, contracts, paymentsThisMonth, recentPayments] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          ownerId: BigInt(userId),
          deleted: false,
        },
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          monthlyRent: true,
          nextDueDate: true,
          dueDay: true,
        },
      }),
      this.prisma.contract.findMany({
        where: {
          deleted: false,
          property: {
            ownerId: BigInt(userId),
          },
        },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              status: true,
              nextDueDate: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          property: {
            ownerId: BigInt(userId),
          },
          dataPagamento: {
            gte: firstDayOfMonth,
          },
        },
        select: {
          valorPago: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          property: {
            ownerId: BigInt(userId),
          },
          dataPagamento: {
            gte: thirtyDaysAgo,
          },
        },
        orderBy: {
          dataPagamento: 'desc',
        },
        take: 10,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const pendingContracts = contracts.filter((contract: any) => {
      if (contract.status !== 'ATIVO') return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }

  async getTenantDashboard(userId: string) {
    // Get tenant's property
    const property = await this.prisma.property.findFirst({
      where: {
        tenantId: BigInt(userId),
        deleted: false,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    // Get active contract
    const contract = await this.prisma.contract.findFirst({
      where: {
        tenantId: BigInt(userId),
        status: 'ATIVO',
        deleted: false,
      },
    });

    // Get payment history
    const payments = await this.prisma.payment.findMany({
      where: {
        userId: BigInt(userId),
      },
      orderBy: {
        dataPagamento: 'desc',
      },
      take: 12,
    });

    // Calculate next due date
    let nextDueDate: Date | null = null;
    let daysUntilDue: number | null = null;

    if (property?.nextDueDate) {
      nextDueDate = property.nextDueDate;
      const now = new Date();
      daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      property: property ? {
        id: property.id.toString(),
        name: property.name,
        address: property.address,
        monthlyRent: property.monthlyRent,
        nextDueDate,
        daysUntilDue,
        owner: property.owner,
      } : null,
      contract: contract ? {
        id: contract.id.toString(),
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyRent: contract.monthlyRent,
        status: contract.status,
        lastPaymentDate: contract.lastPaymentDate,
      } : null,
      paymentHistory: payments.map((payment: any) => ({
        id: payment.id.toString(),
        amount: payment.valorPago,
        date: payment.dataPagamento,
        type: payment.tipo,
      })),
    };
  }

  async getTenantDocuments(userId: string) {
    // Get tenant's property
    const property = await this.prisma.property.findFirst({
      where: {
        tenantId: BigInt(userId),
        deleted: false,
      },
    });

    if (!property) {
      return [];
    }

    // Get documents associated with the property
    const documents = await this.prisma.document.findMany({
      where: {
        propertyId: property.id,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return documents.map((doc: any) => ({
      id: doc.id.toString(),
      name: doc.name,
      url: doc.url,
      uploadedAt: doc.uploadedAt,
    }));
  }

  async getDueDates(userId: string, role?: string, userAgencyId?: string | null, userBrokerId?: string | null) {
    // CEO should see all properties, ADMIN sees only properties they created
    const whereClause: any = {
      deleted: false,
      status: 'ALUGADO',
      nextDueDate: { not: null },
    };

    if (role === 'CEO') {
      // no extra filter - sees all
    } else if (role === 'ADMIN') {
      // ADMIN sees only properties they created
      whereClause.createdBy = BigInt(userId);
    } else if (role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER sees only properties they created
      whereClause.createdBy = BigInt(userId);
    } else if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId) {
        return [];
      }
      whereClause.agencyId = BigInt(userAgencyId);
    } else if (role === 'AGENCY_MANAGER') {
      whereClause.createdBy = BigInt(userId);
      if (userAgencyId) {
        whereClause.agencyId = BigInt(userAgencyId);
      }
    } else if (role === 'BROKER') {
      const brokerFilterId = userBrokerId ? BigInt(userBrokerId) : BigInt(userId);
      whereClause.brokerId = brokerFilterId;
    } else {
      whereClause.ownerId = BigInt(userId);
    }

    const includeClause: any = {
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    };

    // Include agency for CEO/ADMIN
    if (role === 'CEO' || role === 'ADMIN' || role === 'AGENCY_ADMIN') {
      includeClause.agency = {
        select: {
          id: true,
          name: true,
        },
      };
    }

    const properties = await this.prisma.property.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: {
        nextDueDate: 'asc',
      },
    });

    const now = new Date();

    return properties.map((property: any) => {
      const daysUntilDue = property.nextDueDate
        ? Math.ceil((property.nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        propertyId: property.id.toString(),
        propertyName: property.name,
        propertyAddress: property.address,
        tenant: property.tenant,
        agency: property.agency || null,
        nextDueDate: property.nextDueDate,
        dueDay: property.dueDay,
        daysUntilDue,
        status: daysUntilDue !== null
          ? daysUntilDue < 0 ? 'overdue'
          : daysUntilDue <= 7 ? 'upcoming'
          : 'ok'
          : 'unknown',
        monthlyRent: property.monthlyRent,
      };
    });
  }

  async getAgencyAdminDashboard(_userId: string, userAgencyId?: string | null) {
    if (!userAgencyId) {
      return this.emptyDashboard();
    }

    const agencyId = BigInt(userAgencyId);
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [properties, contracts, paymentsThisMonth, recentPayments] = await Promise.all([
      this.prisma.property.findMany({
        where: {
          deleted: false,
          agencyId,
        },
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          monthlyRent: true,
          nextDueDate: true,
          dueDay: true,
        },
      }),
      this.prisma.contract.findMany({
        where: {
          deleted: false,
          agencyId,
        },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              status: true,
              nextDueDate: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          agencyId,
          dataPagamento: {
            gte: firstDayOfMonth,
          },
        },
        select: {
          valorPago: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          agencyId,
        },
        orderBy: {
          dataPagamento: 'desc',
        },
        take: 10,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          agency: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const pendingContracts = contracts.filter((contract: any) => {
      if (contract.status !== 'ATIVO') return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }

  async getManagerDashboard(userId: string, userAgencyId?: string | null) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const propertyWhere: any = {
      deleted: false,
      createdBy: BigInt(userId),
    };
    if (userAgencyId) {
      propertyWhere.agencyId = BigInt(userAgencyId);
    }

    const contractWhere: any = {
      deleted: false,
      property: {
        createdBy: BigInt(userId),
      },
    };
    if (userAgencyId) {
      contractWhere.property.agencyId = BigInt(userAgencyId);
    }

    const paymentWhere: any = {
      dataPagamento: {
        gte: firstDayOfMonth,
      },
      property: {
        createdBy: BigInt(userId),
      },
    };
    if (userAgencyId) {
      paymentWhere.property.agencyId = BigInt(userAgencyId);
    }

    const recentPaymentWhere: any = {
      property: {
        createdBy: BigInt(userId),
      },
    };
    if (userAgencyId) {
      recentPaymentWhere.property.agencyId = BigInt(userAgencyId);
    }

    const [properties, contracts, paymentsThisMonth, recentPayments] = await Promise.all([
      this.prisma.property.findMany({
        where: propertyWhere,
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          monthlyRent: true,
          nextDueDate: true,
          dueDay: true,
        },
      }),
      this.prisma.contract.findMany({
        where: contractWhere,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              status: true,
              nextDueDate: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          valorPago: true,
        },
      }),
      this.prisma.payment.findMany({
        where: recentPaymentWhere,
        orderBy: {
          dataPagamento: 'desc',
        },
        take: 10,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const pendingContracts = contracts.filter((contract: any) => {
      if (contract.status !== 'ATIVO') return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }

  async getBrokerDashboard(userId: string, userAgencyId?: string | null, userBrokerId?: string | null) {
    const brokerFilterId = userBrokerId ? BigInt(userBrokerId) : BigInt(userId);
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const propertyWhere: any = {
      deleted: false,
      brokerId: brokerFilterId,
    };
    if (userAgencyId) {
      propertyWhere.agencyId = BigInt(userAgencyId);
    }

    const paymentWhere: any = {
      dataPagamento: {
        gte: firstDayOfMonth,
      },
      property: {
        brokerId: brokerFilterId,
      },
    };
    if (userAgencyId) {
      paymentWhere.property.agencyId = BigInt(userAgencyId);
    }

    const recentPaymentWhere: any = {
      property: {
        brokerId: brokerFilterId,
      },
    };
    if (userAgencyId) {
      recentPaymentWhere.property.agencyId = BigInt(userAgencyId);
    }

    const [properties, contracts, paymentsThisMonth, recentPayments] = await Promise.all([
      this.prisma.property.findMany({
        where: propertyWhere,
        select: {
          id: true,
          name: true,
          address: true,
          status: true,
          monthlyRent: true,
          nextDueDate: true,
          dueDay: true,
        },
      }),
      this.prisma.contract.findMany({
        where: {
          deleted: false,
          property: {
            brokerId: brokerFilterId,
            ...(userAgencyId ? { agencyId: BigInt(userAgencyId) } : {}),
          },
        },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              status: true,
              nextDueDate: true,
            },
          },
          tenantUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          valorPago: true,
        },
      }),
      this.prisma.payment.findMany({
        where: recentPaymentWhere,
        orderBy: {
          dataPagamento: 'desc',
        },
        take: 10,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const pendingContracts = contracts.filter((contract: any) => {
      if (contract.status !== 'ATIVO') return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }
}
