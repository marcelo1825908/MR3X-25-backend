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
    tenantCountOverride?: number,
  ) {
    const now = new Date();

    const totalProperties = properties.length;
    
    // Helper function to check if contract is fully signed
    const isFullySigned = (contract: any): boolean => {
      const hasTenant = !!contract.tenantSignature && !!contract.tenantSignedAt;
      const hasOwner = !!contract.ownerSignature && !!contract.ownerSignedAt;
      const hasAgency = !contract.agencyId || (!!contract.agencySignature && !!contract.agencySignedAt);
      return hasTenant && hasOwner && hasAgency;
    };

    // Separate contracts by status
    const fullySignedContracts = contracts.filter((c: any) => {
      const status = (c.status || '').toUpperCase();
      const isActiveStatus = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
      return isActiveStatus && isFullySigned(c);
    });

    const inNegotiationContracts = contracts.filter((c: any) => {
      const status = (c.status || '').toUpperCase();
      const isPendingStatus = status === 'AGUARDANDO_ASSINATURAS' ||
                             status === 'AGUARDANDO_ASSINATURA' ||
                             status === 'AWAITING_SIGNATURE' ||
                             status === 'AWAITING_SIGNATURES' ||
                             status === 'PENDENTE' ||
                             status === 'PENDING';
      const isActiveButNotSigned = (status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED') && !isFullySigned(c);
      return isPendingStatus || isActiveButNotSigned;
    });

    const activeContractsCount = fullySignedContracts.length;
    
    // Calculate occupied properties - ONLY fully signed contracts
    const propertiesWithFullySignedContracts = new Set(
      fullySignedContracts
        .map((c: any) => c.property?.id || c.propertyId)
        .filter((id: any) => id !== null && id !== undefined)
    );
    const occupiedFromContracts = propertiesWithFullySignedContracts.size;
    
    // Properties in negotiation (contract exists but not fully signed)
    const propertiesInNegotiation = new Set(
      inNegotiationContracts
        .map((c: any) => c.property?.id || c.propertyId)
        .filter((id: any) => id !== null && id !== undefined)
    );
    const inNegotiationCount = propertiesInNegotiation.size;

    // Available properties = total - occupied - in negotiation
    const availableProperties = totalProperties - occupiedFromContracts - inNegotiationCount;
    
    // Occupied properties = only fully signed contracts
    const occupiedProperties = occupiedFromContracts;

    // Calculate unique tenants from fully signed contracts only
    const uniqueTenants = new Set(
      fullySignedContracts
        .map((c: any) => c.tenantUser?.id || c.tenantId)
        .filter((id: any) => id !== null && id !== undefined)
    );
    // Use override if provided (for direct tenant count), otherwise use contract-based count
    const tenantCount = tenantCountOverride !== undefined ? tenantCountOverride : uniqueTenants.size;
    const maintenanceProperties = properties.filter((p: any) =>
      p.status === 'MANUTENCAO' || p.status === 'MAINTENANCE'
    ).length;
    const pendingUnits = properties.filter((p: any) => p.status === 'PENDENTE' || p.status === 'PENDING').length;
    const overdueUnits = properties.filter((p: any) => (p.status === 'ALUGADO' || p.status === 'RENTED') && p.nextDueDate && p.nextDueDate < now).length;
    const onTimeUnits = properties.filter((p: any) => (p.status === 'ALUGADO' || p.status === 'RENTED') && p.nextDueDate && p.nextDueDate >= now).length;

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
      inNegotiationProperties: inNegotiationCount,
      maintenanceProperties,
      activeContracts: activeContractsCount,
      inNegotiationContracts: inNegotiationContracts.length,
      tenantCount,
      monthlyRevenue,
      pendingPayments: pendingContracts.length,
      receivedValue: monthlyRevenue,
      overdueValue,
      vacantUnits: availableProperties,
      overdueUnits,
      onTimeUnits,
      pendingUnits,
      // Occupancy rate calculation: only fully signed contracts
      occupancyRate: totalProperties > 0 
        ? Math.round((occupiedProperties / totalProperties) * 100) 
        : 0,
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

      const totalAgencies = await this.prisma.agency.count({
        where: { status: 'ACTIVE' },
      }).catch(() => 0);

      const totalIndependentOwners = await this.prisma.user.count({
        where: { 
          status: 'ACTIVE',
          role: 'INDEPENDENT_OWNER',
        },
      }).catch(() => 0);

      const totalUsers = await this.prisma.user.count({
        where: { status: 'ACTIVE' },
      }).catch(() => 0);

      const totalProperties = await this.prisma.property.count({
        where: { deleted: false },
      }).catch(() => 0);

      const occupiedProperties = await this.prisma.property.count({
        where: { deleted: false, status: { in: ['ALUGADO', 'RENTED'] } },
      }).catch(() => 0);

      const availableProperties = await this.prisma.property.count({
        where: { deleted: false, status: { in: ['DISPONIVEL', 'VACANT'] } },
      }).catch(() => 0);

      const activeContracts = await this.prisma.contract.count({
        where: {
          deleted: false,
          status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED', 'PENDENTE', 'PENDING', 'AGUARDANDO_ASSINATURA', 'AWAITING_SIGNATURE'] }
        },
      }).catch(() => 0);

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

      const platformFee = Number(monthlyRevenue) * 0.02;

      // Calculate overdue from active contracts
      const activeContractsList = await this.prisma.contract.findMany({
        where: {
          deleted: false,
          status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED', 'AGUARDANDO_ASSINATURA', 'AWAITING_SIGNATURE', 'PENDENTE', 'PENDING'] },
        },
        include: {
          property: {
            select: {
              dueDay: true,
              nextDueDate: true,
              monthlyRent: true,
            },
          },
        },
      }).catch(() => []);

      // Calculate overdue contracts based on due date
      let overdueCount = 0;
      let overdueRevenue = 0;
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const contract of activeContractsList as any[]) {
        const dueDay = contract.dueDay || contract.property?.dueDay || 1;
        let nextDueDate = contract.property?.nextDueDate;

        // Calculate next due date if not set
        if (!nextDueDate) {
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          nextDueDate = new Date(currentYear, currentMonth, dueDay);
        }

        // Check if overdue (due date has passed)
        if (new Date(nextDueDate) < now) {
          overdueCount++;
          overdueRevenue += Number(contract.monthlyRent || contract.property?.monthlyRent || 0);
        }
      }

      const receivedRevenue = monthlyRevenue;

      // Pending payments - contracts without recent payment
      const pendingPayments = await this.prisma.contract.count({
        where: {
          deleted: false,
          status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED'] },
          OR: [
            { lastPaymentDate: null },
            { lastPaymentDate: { lt: thirtyDaysAgo } },
          ],
        },
      }).catch(() => 0);

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

      // Default rate is based on active contracts
      const totalActiveContracts = (activeContractsList as any[]).length;
      const defaultRate = totalActiveContracts > 0 ? (overdueCount / totalActiveContracts) * 100 : 0;

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
          totalIndependentOwners,
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

  async getAdminDashboard(userId: string) {
    try {
      // Admin should see CEO-like global data, not just their own created data
      // Use the same logic as CEO dashboard but with Admin permissions
      return this.getCEODashboard();
    } catch (error: any) {
      console.error('Error in getAdminDashboard:', error);
      throw error;
    }
  }

  // Legacy method - keeping for backward compatibility but redirecting to CEO dashboard
  async getAdminDashboardLegacy(userId: string) {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const adminId = BigInt(userId);

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
        const status = (contract.status || '').toUpperCase();
        const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
        if (!isActive) return false;
        if (!contract.lastPaymentDate) return true;
        return contract.lastPaymentDate < thirtyDaysAgo;
      });

      const baseDashboard = this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);

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
      const status = (contract.status || '').toUpperCase();
      const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
      if (!isActive) return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    // Get pending and overdue invoices for accurate pending amount calculation
    const pendingInvoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        OR: [
          { ownerId: creatorId },
          { createdBy: creatorId },
          { 
            contract: {
              property: {
                createdBy: creatorId,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        contractId: true,
        updatedValue: true,
        originalValue: true,
        fine: true,
        interest: true,
        dueDate: true,
        status: true,
        contract: {
          select: {
            id: true,
            tenantId: true,
            propertyId: true,
          },
        },
      },
    });

    // Calculate accurate pending amount from invoices
    const pendingAmount = pendingInvoices.reduce((sum: number, invoice: any) => {
      return sum + Number(invoice.updatedValue || invoice.originalValue || 0);
    }, 0);

    const dashboardResponse = this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
    
    // Override pending amount with accurate calculation from invoices
    return {
      ...dashboardResponse,
      overview: {
        ...dashboardResponse.overview,
        pendingAmount, // Accurate pending amount from invoices
        overdueValue: pendingAmount, // Use same value for consistency
      },
    };
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
      const status = (contract.status || '').toUpperCase();
      const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
      if (!isActive) return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }

  async getTenantDashboard(userId: string) {
    const tenantId = BigInt(userId);
    const now = new Date();
    
    // Get property linked to tenant
    const property = await this.prisma.property.findFirst({
      where: {
        tenantId,
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
        tenantId,
        status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED'] },
        deleted: false,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Get all payments (not just last 12)
    const allPayments = await this.prisma.payment.findMany({
      where: {
        userId: tenantId,
      },
      orderBy: {
        dataPagamento: 'desc',
      },
    });

    // Get recent payments (last 12) for display
    const recentPayments = allPayments.slice(0, 12);

    // Get invoices for financial overview
    const invoices = await this.prisma.invoice.findMany({
      where: {
        contractId: contract?.id,
      },
      orderBy: {
        dueDate: 'desc',
      },
    });

    // Calculate financial overview
    const totalPaid = allPayments
      .filter((p: any) => p.status === 'PAGO' || p.status === 'PAID')
      .reduce((sum: number, p: any) => sum + Number(p.valorPago || 0), 0);

    const pendingInvoices = invoices.filter((inv: any) => 
      ['PENDING', 'OVERDUE'].includes(inv.status)
    );
    const totalPending = pendingInvoices.reduce((sum: number, inv: any) => 
      sum + Number(inv.updatedValue || inv.originalValue || 0), 0
    );

    const overdueInvoices = invoices.filter((inv: any) => 
      inv.status === 'OVERDUE' || (inv.dueDate && new Date(inv.dueDate) < now)
    );
    const totalOverdue = overdueInvoices.reduce((sum: number, inv: any) => 
      sum + Number(inv.updatedValue || inv.originalValue || 0), 0
    );

    const avgPayment = allPayments.length > 0 
      ? totalPaid / allPayments.filter((p: any) => p.status === 'PAGO' || p.status === 'PAID').length 
      : 0;

    // Calculate next due date
    let nextDueDate: Date | null = null;
    let daysUntilDue: number | null = null;
    let upcomingDueDate: Date | null = null;
    let daysUntilUpcoming: number | null = null;

    if (property?.nextDueDate) {
      nextDueDate = property.nextDueDate;
      daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else if (contract) {
      // Calculate from contract dueDay
      const dueDay = contract.dueDay || 1;
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const calculatedDue = new Date(currentYear, currentMonth, dueDay);
      if (calculatedDue < now) {
        nextDueDate = new Date(currentYear, currentMonth + 1, dueDay);
      } else {
        nextDueDate = calculatedDue;
      }
      daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Check for upcoming due date (7 days before)
    if (nextDueDate) {
      const sevenDaysBefore = new Date(nextDueDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (now >= sevenDaysBefore && now < nextDueDate) {
        upcomingDueDate = nextDueDate;
        daysUntilUpcoming = daysUntilDue;
      }
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
        property: contract.property,
      } : null,
      paymentHistory: recentPayments.map((payment: any) => ({
        id: payment.id.toString(),
        amount: payment.valorPago,
        date: payment.dataPagamento,
        type: payment.tipo,
        status: payment.status,
      })),
      financialOverview: {
        totalPaid,
        totalPending,
        totalOverdue,
        averagePayment: avgPayment,
        totalPayments: allPayments.filter((p: any) => p.status === 'PAGO' || p.status === 'PAID').length,
        pendingCount: pendingInvoices.length,
        overdueCount: overdueInvoices.length,
      },
      upcomingDueDate,
      daysUntilUpcoming,
    };
  }

  async getTenantDocuments(userId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        tenantId: BigInt(userId),
        deleted: false,
      },
    });

    if (!property) {
      return [];
    }

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
    // Get due dates from active contracts instead of properties
    const whereClause: any = {
      deleted: false,
      status: { in: ['ATIVO', 'ACTIVE', 'ASSINADO', 'SIGNED', 'AGUARDANDO_ASSINATURA', 'AWAITING_SIGNATURE', 'PENDENTE', 'PENDING'] },
    };

    if (role === 'CEO') {
      // CEO sees all contracts
    } else if (role === 'ADMIN') {
      whereClause.property = { createdBy: BigInt(userId) };
    } else if (role === 'INDEPENDENT_OWNER') {
      whereClause.property = { createdBy: BigInt(userId) };
    } else if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId) {
        return [];
      }
      whereClause.agencyId = BigInt(userAgencyId);
    } else if (role === 'AGENCY_MANAGER') {
      whereClause.property = { createdBy: BigInt(userId) };
      if (userAgencyId) {
        whereClause.agencyId = BigInt(userAgencyId);
      }
    } else if (role === 'BROKER') {
      const brokerFilterId = userBrokerId ? BigInt(userBrokerId) : BigInt(userId);
      whereClause.property = { brokerId: brokerFilterId };
    } else {
      whereClause.property = { ownerId: BigInt(userId) };
    }

    const includeClause: any = {
      property: {
        select: {
          id: true,
          name: true,
          address: true,
          dueDay: true,
          nextDueDate: true,
          monthlyRent: true,
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
    };

    if (role === 'CEO' || role === 'ADMIN' || role === 'AGENCY_ADMIN') {
      includeClause.agency = {
        select: {
          id: true,
          name: true,
        },
      };
    }

    const contracts = await this.prisma.contract.findMany({
      where: whereClause,
      include: includeClause,
      orderBy: {
        startDate: 'asc',
      },
    });

    const now = new Date();

    return contracts.map((contract: any) => {
      // Calculate next due date based on contract's dueDay or property's dueDay
      const dueDay = contract.dueDay || contract.property?.dueDay || 1;
      let nextDueDate = contract.property?.nextDueDate;

      // If no nextDueDate on property, calculate based on dueDay
      if (!nextDueDate) {
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        nextDueDate = new Date(currentYear, currentMonth, dueDay);
        if (nextDueDate < now) {
          nextDueDate = new Date(currentYear, currentMonth + 1, dueDay);
        }
      }

      const daysUntilDue = nextDueDate
        ? Math.ceil((new Date(nextDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        propertyId: contract.property?.id?.toString() || contract.propertyId?.toString(),
        propertyName: contract.property?.name || 'N/A',
        propertyAddress: contract.property?.address || 'N/A',
        tenant: contract.tenantUser ? {
          id: contract.tenantUser.id.toString(),
          name: contract.tenantUser.name,
          email: contract.tenantUser.email,
          phone: contract.tenantUser.phone,
        } : null,
        agency: contract.agency || null,
        nextDueDate,
        dueDay,
        daysUntilDue,
        status: daysUntilDue !== null
          ? daysUntilDue < 0 ? 'overdue'
          : daysUntilDue <= 7 ? 'upcoming'
          : 'ok'
          : 'unknown',
        monthlyRent: contract.monthlyRent || contract.property?.monthlyRent,
        contractId: contract.id.toString(),
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

    const [properties, contracts, paymentsThisMonth, recentPayments, tenantCount] = await Promise.all([
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
      // Count all tenants registered in the agency
      this.prisma.user.count({
        where: {
          agencyId,
          role: 'INQUILINO',
          status: 'ACTIVE',
        },
      }),
    ]);

    const pendingContracts = contracts.filter((contract: any) => {
      const status = (contract.status || '').toUpperCase();
      const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
      if (!isActive) return false;
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments, tenantCount);
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
        select: {
          id: true,
          status: true,
          monthlyRent: true,
          lastPaymentDate: true,
          startDate: true,
          endDate: true,
          tenantSignature: true,
          tenantSignedAt: true,
          ownerSignature: true,
          ownerSignedAt: true,
          agencyId: true,
          agencySignature: true,
          agencySignedAt: true,
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
      const status = (contract.status || '').toUpperCase();
      const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
      if (!isActive) return false;
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
        select: {
          id: true,
          status: true,
          monthlyRent: true,
          lastPaymentDate: true,
          startDate: true,
          endDate: true,
          tenantSignature: true,
          tenantSignedAt: true,
          ownerSignature: true,
          ownerSignedAt: true,
          agencyId: true,
          agencySignature: true,
          agencySignedAt: true,
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

    // Helper function to check if contract is fully signed
    const isFullySigned = (contract: any): boolean => {
      const hasTenant = !!contract.tenantSignature && !!contract.tenantSignedAt;
      const hasOwner = !!contract.ownerSignature && !!contract.ownerSignedAt;
      const hasAgency = !contract.agencyId || (!!contract.agencySignature && !!contract.agencySignedAt);
      return hasTenant && hasOwner && hasAgency;
    };

    // Pending contracts: fully signed AND active AND overdue
    const pendingContracts = contracts.filter((contract: any) => {
      const status = (contract.status || '').toUpperCase();
      const isActive = status === 'ATIVO' || status === 'ACTIVE' || status === 'ASSINADO' || status === 'SIGNED';
      if (!isActive) return false;
      if (!isFullySigned(contract)) return false; // Only count fully signed contracts
      if (!contract.lastPaymentDate) return true;
      return contract.lastPaymentDate < thirtyDaysAgo;
    });

    return this.buildDashboardResponse(properties, contracts, paymentsThisMonth, pendingContracts, recentPayments);
  }

  async getTenantAlerts(userId: string) {
    try {
      const tenantId = BigInt(userId);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get tenant's contract and property
      const contract = await this.prisma.contract.findFirst({
        where: {
          tenantId,
          status: 'ATIVO',
          deleted: false,
        },
        include: {
          property: true,
        },
      });

      // Check for overdue payments
      let hasOverduePayment = false;
      let overdueAmount = 0;
      let overdueDays = 0;

      if (contract?.property?.nextDueDate) {
        const dueDate = new Date(contract.property.nextDueDate);
        if (dueDate < now) {
          hasOverduePayment = true;
          overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          overdueAmount = Number(contract.monthlyRent || 0);
        }
      }

      const isSeverelyOverdue = overdueDays > 30;

      // Get active extrajudicial notifications for this tenant (excluding already signed)
      const extrajudicialNotifications = await this.prisma.extrajudicialNotification.findMany({
        where: {
          debtorId: tenantId,
          status: {
            in: ['ENVIADO', 'AGUARDANDO_ENVIO', 'VISUALIZADO', 'GERADO'],
          },
          debtorSignedAt: null, // Exclude notifications already signed by debtor
        },
        select: {
          id: true,
          type: true,
          status: true,
          priority: true,
          principalAmount: true,
          deadlineDate: true,
          viewedAt: true,
          creditorName: true,
          debtorSignedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const hasActiveExtrajudicial = extrajudicialNotifications.length > 0;

      // Get pending agreements for this tenant
      const pendingAgreements = await this.prisma.agreement.findMany({
        where: {
          tenantId,
          status: 'AGUARDANDO_ASSINATURA',
        },
        select: {
          id: true,
          type: true,
          status: true,
          negotiatedAmount: true,
          effectiveDate: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const hasPendingAgreement = pendingAgreements.length > 0;

      // Determine if immediate action is required
      const requiresImmediateAction =
        hasActiveExtrajudicial ||
        (isSeverelyOverdue && !hasPendingAgreement);

      return {
        hasOverduePayment,
        overdueAmount,
        overdueDays,
        hasActiveExtrajudicial,
        extrajudicialNotifications: extrajudicialNotifications.map((n: any) => ({
          id: n.id.toString(),
          type: n.type,
          status: n.status,
          priority: n.priority,
          principalAmount: n.principalAmount ? Number(n.principalAmount) : null,
          deadlineDate: n.deadlineDate,
          viewedAt: n.viewedAt,
          creditorName: n.creditorName,
          debtorSignedAt: n.debtorSignedAt,
        })),
        hasPendingAgreement,
        pendingAgreements: pendingAgreements.map((a: any) => ({
          id: a.id.toString(),
          type: a.type,
          status: a.status,
          totalAmount: a.negotiatedAmount ? Number(a.negotiatedAmount) : null,
          effectiveDate: a.effectiveDate,
        })),
        isSeverelyOverdue,
        requiresImmediateAction,
      };
    } catch (error: any) {
      console.error('Error in getTenantAlerts:', error);
      return {
        hasOverduePayment: false,
        overdueAmount: 0,
        overdueDays: 0,
        hasActiveExtrajudicial: false,
        extrajudicialNotifications: [],
        hasPendingAgreement: false,
        pendingAgreements: [],
        isSeverelyOverdue: false,
        requiresImmediateAction: false,
      };
    }
  }

  async acknowledgeExtrajudicial(
    userId: string,
    notificationId: string,
    data: {
      acknowledgmentType: 'DASHBOARD_VIEW' | 'CLICK' | 'SIGNATURE';
      ipAddress?: string;
      geoLat?: number;
      geoLng?: number;
      geoConsent?: boolean;
      userAgent?: string;
      signature?: string;
    },
  ) {
    try {
      const notification = await this.prisma.extrajudicialNotification.findUnique({
        where: { id: BigInt(notificationId) },
      });

      if (!notification) {
        throw new Error('Notificação não encontrada');
      }

      // Update the notification with acknowledgment info
      // If notification is in RASCUNHO or GERADO status, promote to ENVIADO first (simulating send)
      // Then set to VISUALIZADO since tenant is acknowledging they've seen it
      let newStatus = 'VISUALIZADO';
      if (notification.status === 'RASCUNHO' || notification.status === 'GERADO') {
        // Also set sentAt to mark when it was effectively "sent" (via dashboard view)
        newStatus = 'VISUALIZADO';
      }

      const updateData: any = {
        viewedAt: notification.viewedAt || new Date(),
        viewedIP: data.ipAddress || null,
        viewedUserAgent: data.userAgent || null,
        status: newStatus,
        // If notification was never formally sent, mark it as sent now
        sentAt: notification.sentAt || new Date(),
      };

      // If signature provided, update debtor signature
      if (data.signature) {
        updateData.debtorSignature = data.signature;
        updateData.debtorSignedAt = new Date();
        updateData.debtorSignedIP = data.ipAddress || null;
        updateData.debtorSignedAgent = data.userAgent || null;
        if (data.geoLat && data.geoLng) {
          updateData.debtorGeoLat = data.geoLat;
          updateData.debtorGeoLng = data.geoLng;
        }
      }

      const updated = await this.prisma.extrajudicialNotification.update({
        where: { id: BigInt(notificationId) },
        data: updateData,
      });

      // Create audit log entry
      await this.prisma.auditLog.create({
        data: {
          event: 'EXTRAJUDICIAL_ACKNOWLEDGE',
          entity: 'extrajudicial_notification',
          entityId: BigInt(notificationId),
          userId: BigInt(userId),
          ip: data.ipAddress || null,
          userAgent: data.userAgent || null,
          dataAfter: JSON.stringify({
            acknowledgmentType: data.acknowledgmentType,
            viewedAt: new Date().toISOString(),
            ipAddress: data.ipAddress,
            geoLat: data.geoLat,
            geoLng: data.geoLng,
            geoConsent: data.geoConsent,
          }),
        },
      });

      return {
        success: true,
        viewedAt: updateData.viewedAt,
        notification: {
          id: updated.id.toString(),
          status: updated.status,
        },
      };
    } catch (error: any) {
      console.error('Error in acknowledgeExtrajudicial:', error);
      throw error;
    }
  }

  async acknowledgeBanner(
    userId: string,
    data: {
      type: 'UPCOMING_DUE' | 'OVERDUE' | 'EXTRAJUDICIAL' | 'AGREEMENT';
      itemId?: string;
      ipAddress: string;
      userAgent: string;
    },
  ) {
    try {
      const tenantId = BigInt(userId);
      const now = new Date();

      // Create audit log entry for banner acknowledgment
      await this.prisma.auditLog.create({
        data: {
          event: 'TENANT_BANNER_ACKNOWLEDGED',
          entity: 'banner',
          entityId: data.itemId ? BigInt(data.itemId) : BigInt(0),
          userId: tenantId,
          ip: data.ipAddress || null,
          userAgent: data.userAgent || null,
          dataAfter: JSON.stringify({
            bannerType: data.type,
            itemId: data.itemId,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            acknowledgedAt: now.toISOString(),
            legalPurpose: 'Proof of tenant acknowledgment for legal validity',
          }),
        },
      });

      return {
        success: true,
        message: 'Ciência do banner registrada com sucesso',
        timestamp: now,
        legalNote: 'Este registro serve como comprovação legal de ciência e notificação.',
      };
    } catch (error: any) {
      console.error('Error in acknowledgeBanner:', error);
      throw error;
    }
  }

  async getBillingData() {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all agencies with payment data
      const agencies = await this.prisma.agency.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          cnpj: true,
          email: true,
          plan: true,
          totalSpent: true,
          lastPaymentAt: true,
          lastPaymentAmount: true,
          subscriptionStatus: true,
          createdAt: true,
        },
        orderBy: { lastPaymentAt: 'desc' },
      });

      // Get all microtransactions
      const allMicrotransactions = await this.prisma.microtransaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          agency: {
            select: { id: true, name: true, plan: true },
          },
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // Calculate statistics from agencies
      const totalAgencyRevenue = agencies.reduce((sum, a) => sum + Number(a.totalSpent || 0), 0);

      // This month revenue from agencies
      const thisMonthAgencyPayments = agencies.filter(a =>
        a.lastPaymentAt && new Date(a.lastPaymentAt) >= firstDayOfMonth
      );
      const thisMonthAgencyRevenue = thisMonthAgencyPayments.reduce(
        (sum, a) => sum + Number(a.lastPaymentAmount || 0), 0
      );

      // Microtransaction stats
      const paidTransactions = allMicrotransactions.filter(m => m.status === 'PAID');
      const pendingTransactions = allMicrotransactions.filter(m => m.status === 'PENDING');
      const overdueTransactions = allMicrotransactions.filter(m =>
        m.status === 'PENDING' && new Date(m.createdAt) < thirtyDaysAgo
      );

      const microRevenue = paidTransactions.reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const thisMonthMicroPaid = paidTransactions.filter(m =>
        m.paidAt && new Date(m.paidAt) >= firstDayOfMonth
      );
      const thisMonthMicroRevenue = thisMonthMicroPaid.reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const pendingAmount = pendingTransactions.reduce((sum, m) => sum + Number(m.amount || 0), 0);
      const overdueAmount = overdueTransactions.reduce((sum, m) => sum + Number(m.amount || 0), 0);

      // Build invoices list from both agencies and microtransactions
      const invoices: any[] = [];

      // Add agency payment records
      agencies.forEach(agency => {
        if (agency.lastPaymentAt && Number(agency.lastPaymentAmount || 0) > 0) {
          invoices.push({
            id: `AGY-${agency.id.toString().padStart(6, '0')}`,
            transactionId: agency.id.toString(),
            agencyName: agency.name,
            agencyId: agency.id.toString(),
            plan: agency.plan || 'FREE',
            type: 'PLAN_SUBSCRIPTION',
            description: `Assinatura do plano ${agency.plan || 'FREE'}`,
            amount: Number(agency.lastPaymentAmount || 0),
            issueDate: agency.lastPaymentAt,
            dueDate: null,
            status: 'paid',
            paymentDate: agency.lastPaymentAt,
            asaasPaymentId: null,
          });
        }
      });

      // Add microtransaction records
      allMicrotransactions.forEach(m => {
        const isOverdue = m.status === 'PENDING' && new Date(m.createdAt) < thirtyDaysAgo;
        invoices.push({
          id: `TXN-${m.id.toString().padStart(6, '0')}`,
          transactionId: m.id.toString(),
          agencyName: m.agency?.name || m.user?.name || 'N/A',
          agencyId: m.agency?.id?.toString() || m.userId?.toString() || null,
          plan: m.agency?.plan || 'N/A',
          type: m.type,
          description: m.description,
          amount: Number(m.amount || 0),
          issueDate: m.createdAt,
          dueDate: null,
          status: m.status === 'PAID' ? 'paid' : (isOverdue ? 'overdue' : 'pending'),
          paymentDate: m.paidAt,
          asaasPaymentId: m.asaasPaymentId,
        });
      });

      // Sort invoices by date (most recent first)
      invoices.sort((a, b) => {
        const dateA = new Date(a.paymentDate || a.issueDate).getTime();
        const dateB = new Date(b.paymentDate || b.issueDate).getTime();
        return dateB - dateA;
      });

      const paidInvoices = invoices.filter(i => i.status === 'paid');
      const pendingInvoices = invoices.filter(i => i.status === 'pending');
      const overdueInvoices = invoices.filter(i => i.status === 'overdue');

      return {
        stats: {
          totalRevenue: totalAgencyRevenue + microRevenue,
          thisMonth: thisMonthAgencyRevenue + thisMonthMicroRevenue,
          pending: pendingAmount,
          overdue: overdueAmount,
          paid: totalAgencyRevenue + microRevenue,
          currentMonth: currentMonthName,
        },
        invoices,
        summary: {
          totalTransactions: invoices.length,
          paidCount: paidInvoices.length,
          pendingCount: pendingInvoices.length,
          overdueCount: overdueInvoices.length,
        },
        agencies: {
          total: agencies.length,
          withPayments: agencies.filter(a => a.lastPaymentAt).length,
        },
      };
    } catch (error: any) {
      console.error('Error in getBillingData:', error);
      throw error;
    }
  }

  async getPlatformRevenue() {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const agencies = await this.prisma.agency.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          cnpj: true,
          email: true,
          plan: true,
          subscriptionStatus: true,
          totalSpent: true,
          lastPaymentAt: true,
          lastPaymentAmount: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          nextBillingDate: true,
          createdAt: true,
          _count: {
            select: {
              properties: true,
              contracts: true,
              users: true,
            },
          },
        },
        orderBy: { totalSpent: 'desc' },
      });

      const independentOwners = await this.prisma.user.findMany({
        where: {
          role: 'INDEPENDENT_OWNER',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          document: true,
          plan: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const agencyMicrotransactionsThisMonth = await this.prisma.microtransaction.findMany({
        where: {
          agencyId: { not: null },
          createdAt: { gte: firstDayOfMonth },
          status: 'PAID',
        },
        include: {
          agency: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const ownerMicrotransactionsThisMonth = await this.prisma.microtransaction.findMany({
        where: {
          userId: { not: null },
          agencyId: null,
          createdAt: { gte: firstDayOfMonth },
          status: 'PAID',
        },
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalAgencyRevenue = agencies.reduce((sum, a) => sum + Number(a.totalSpent || 0), 0);
      const monthlyAgencyMicrotransactions = agencyMicrotransactionsThisMonth.reduce(
        (sum, m) => sum + Number(m.amount || 0),
        0
      );
      const monthlyOwnerMicrotransactions = ownerMicrotransactionsThisMonth.reduce(
        (sum, m) => sum + Number(m.amount || 0),
        0
      );

      const agencyPlanCounts: Record<string, number> = {};
      const ownerPlanCounts: Record<string, number> = {};

      agencies.forEach(a => {
        agencyPlanCounts[a.plan || 'FREE'] = (agencyPlanCounts[a.plan || 'FREE'] || 0) + 1;
      });

      independentOwners.forEach(o => {
        ownerPlanCounts[o.plan || 'FREE'] = (ownerPlanCounts[o.plan || 'FREE'] || 0) + 1;
      });

      const recentAgencyPayments = agencies
        .filter(a => a.lastPaymentAt)
        .sort((a, b) => new Date(b.lastPaymentAt!).getTime() - new Date(a.lastPaymentAt!).getTime())
        .slice(0, 10)
        .map(a => ({
          id: a.id.toString(),
          type: 'agency' as const,
          name: a.name,
          email: a.email,
          plan: a.plan,
          amount: Number(a.lastPaymentAmount || 0),
          date: a.lastPaymentAt,
          totalSpent: Number(a.totalSpent || 0),
        }));

      const formattedAgencies = agencies.map(a => ({
        id: a.id.toString(),
        name: a.name,
        cnpj: a.cnpj,
        email: a.email,
        plan: a.plan || 'FREE',
        subscriptionStatus: a.subscriptionStatus || 'ACTIVE',
        totalSpent: Number(a.totalSpent || 0),
        lastPaymentAt: a.lastPaymentAt,
        lastPaymentAmount: Number(a.lastPaymentAmount || 0),
        nextBillingDate: a.nextBillingDate,
        createdAt: a.createdAt,
        stats: {
          properties: a._count.properties,
          contracts: a._count.contracts,
          users: a._count.users,
        },
      }));

      const formattedOwners = independentOwners.map(o => ({
        id: o.id.toString(),
        name: o.name,
        email: o.email,
        document: o.document,
        plan: o.plan || 'FREE',
        createdAt: o.createdAt,
      }));

      return {
        summary: {
          totalAgencies: agencies.length,
          totalIndependentOwners: independentOwners.length,
          totalAgencyRevenue,
          monthlyAgencyMicrotransactions,
          monthlyOwnerMicrotransactions,
          totalMonthlyRevenue: monthlyAgencyMicrotransactions + monthlyOwnerMicrotransactions,
        },
        planDistribution: {
          agencies: agencyPlanCounts,
          independentOwners: ownerPlanCounts,
        },
        agencies: formattedAgencies,
        independentOwners: formattedOwners,
        recentPayments: recentAgencyPayments,
        microtransactions: {
          agencies: agencyMicrotransactionsThisMonth.map(m => ({
            id: m.id.toString(),
            type: m.type,
            amount: Number(m.amount || 0),
            status: m.status,
            description: m.description,
            paidAt: m.paidAt,
            createdAt: m.createdAt,
            agency: m.agency ? {
              id: m.agency.id.toString(),
              name: m.agency.name,
            } : null,
          })),
          owners: ownerMicrotransactionsThisMonth
            .filter(m => m.user?.role === 'INDEPENDENT_OWNER')
            .map(m => ({
              id: m.id.toString(),
              type: m.type,
              amount: Number(m.amount || 0),
              status: m.status,
              description: m.description,
              paidAt: m.paidAt,
              createdAt: m.createdAt,
              owner: m.user ? {
                id: m.user.id.toString(),
                name: m.user.name,
              } : null,
            })),
        },
      };
    } catch (error: any) {
      console.error('Error in getPlatformRevenue:', error);
      throw error;
    }
  }
}
