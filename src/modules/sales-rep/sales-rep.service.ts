import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class SalesRepService {
  constructor(private prisma: PrismaService) {}

  async getStats(salesRepId: bigint) {
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const prospects = await this.prisma.salesProspect.findMany({
      where: { salesRepId },
    });

    const leadsInProgress = prospects.filter(p =>
      !['closed_won', 'closed_lost'].includes(p.status)
    ).length;

    const conversions = prospects.filter(p => p.status === 'closed_won').length;
    const totalProspects = prospects.length;

    const proposals = await this.prisma.salesProposal.findMany({
      where: { salesRepId },
    });

    const proposalsSent = proposals.filter(p => p.status !== 'draft').length;
    const proposalsAccepted = proposals.filter(p => p.status === 'accepted').length;
    const proposalsPending = proposals.filter(p => ['sent', 'viewed'].includes(p.status)).length;
    const proposalsRejected = proposals.filter(p => p.status === 'rejected').length;

    const expectedRevenue = prospects
      .filter(p => !['closed_won', 'closed_lost'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.estimatedValue || 0) * (p.probability || 20) / 100, 0);

    const commissions = await this.prisma.salesCommission.findMany({
      where: { salesRepId },
    });

    const commissionEarned = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.commissionValue), 0);

    const commissionPending = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.commissionValue), 0);

    const goal = await this.prisma.salesGoal.findUnique({
      where: {
        salesRepId_month: {
          salesRepId,
          month: currentMonth,
        },
      },
    });

    const monthlyTarget = goal?.targetConversions || 15;
    const monthlyAchieved = goal?.achievedConversions || conversions;

    const conversionRate = totalProspects > 0
      ? ((conversions / totalProspects) * 100).toFixed(1)
      : 0;

    const closedDeals = commissions.filter(c => c.status === 'paid');
    const avgTicket = closedDeals.length > 0
      ? closedDeals.reduce((sum, c) => sum + Number(c.dealValue), 0) / closedDeals.length
      : 0;

    const weeklyPerformance = await this.getWeeklyPerformance(salesRepId);

    const pipelineData = this.getPipelineData(prospects);

    const recentLeads = await this.getRecentLeads(salesRepId);

    const topProspects = await this.getTopProspects(salesRepId);

    return {
      leadsInProgress,
      conversions,
      monthlyTarget,
      monthlyAchieved,
      totalProspects,
      proposalsSent,
      proposalsAccepted,
      proposalsPending,
      proposalsRejected,
      expectedRevenue,
      commissionEarned,
      commissionPending,
      avgTicket,
      conversionRate: Number(conversionRate),
      weeklyPerformance,
      pipelineData,
      recentLeads,
      topProspects,
    };
  }

  private async getWeeklyPerformance(salesRepId: bigint) {
    const weeks: { week: string; leads: number; conversions: number }[] = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const leads = await this.prisma.salesProspect.count({
        where: {
          salesRepId,
          createdAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });

      const conversions = await this.prisma.salesProspect.count({
        where: {
          salesRepId,
          status: 'closed_won',
          convertedAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });

      weeks.push({
        week: `Sem ${4 - i}`,
        leads,
        conversions,
      });
    }

    return weeks;
  }

  private getPipelineData(prospects: any[]) {
    const stages = [
      { name: 'Prospecção', status: 'prospecting', color: '#3B82F6' },
      { name: 'Qualificação', status: 'qualification', color: '#F59E0B' },
      { name: 'Proposta Enviada', status: 'proposal_sent', color: '#8B5CF6' },
      { name: 'Negociação', status: 'negotiation', color: '#10B981' },
      { name: 'Fechado Ganho', status: 'closed_won', color: '#22C55E' },
      { name: 'Fechado Perdido', status: 'closed_lost', color: '#EF4444' },
    ];

    return stages.map(stage => ({
      name: stage.name,
      value: prospects.filter(p => p.status === stage.status).length,
      color: stage.color,
    }));
  }

  private async getRecentLeads(salesRepId: bigint) {
    const prospects = await this.prisma.salesProspect.findMany({
      where: { salesRepId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return prospects.map(p => ({
      id: Number(p.id),
      name: p.name,
      contact: p.contactName,
      status: p.status,
      value: Number(p.estimatedValue || 0),
      date: p.createdAt.toISOString().split('T')[0],
    }));
  }

  private async getTopProspects(salesRepId: bigint) {
    const prospects = await this.prisma.salesProspect.findMany({
      where: {
        salesRepId,
        status: {
          notIn: ['closed_won', 'closed_lost'],
        },
        estimatedValue: { gt: 0 },
      },
      orderBy: [
        { probability: 'desc' },
        { estimatedValue: 'desc' },
      ],
      take: 5,
    });

    return prospects.map(p => ({
      name: p.name,
      value: Number(p.estimatedValue || 0),
      probability: p.probability || 20,
    }));
  }

  async getProspects(salesRepId: bigint) {
    const prospects = await this.prisma.salesProspect.findMany({
      where: { salesRepId },
      orderBy: { createdAt: 'desc' },
    });

    return prospects.map(p => ({
      id: String(p.id),
      name: p.name,
      contactName: p.contactName,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      address: p.address,
      city: p.city,
      state: p.state,
      status: p.status,
      notes: p.notes,
      lastContactAt: p.lastContactAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
      source: p.source,
      estimatedValue: Number(p.estimatedValue || 0),
    }));
  }

  async createProspect(salesRepId: bigint, data: any) {
    const prospect = await this.prisma.salesProspect.create({
      data: {
        salesRepId,
        name: data.name,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        city: data.city,
        state: data.state,
        cnpj: data.cnpj,
        status: 'prospecting',
        stage: 'prospecting',
        source: data.source,
        estimatedValue: data.estimatedValue,
        notes: data.notes,
      },
    });

    return {
      id: String(prospect.id),
      ...data,
      status: 'prospecting',
      createdAt: prospect.createdAt.toISOString(),
      lastContactAt: null,
    };
  }

  async updateProspect(id: string, data: any) {
    const prospect = await this.prisma.salesProspect.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        city: data.city,
        state: data.state,
        cnpj: data.cnpj,
        source: data.source,
        estimatedValue: data.estimatedValue,
        notes: data.notes,
        lastContactAt: data.lastContactAt ? new Date(data.lastContactAt) : undefined,
      },
    });

    return { id, ...data, updatedAt: prospect.updatedAt.toISOString() };
  }

  async updateProspectStatus(id: string, status: string) {
    const updateData: any = {
      status,
      stage: status,
    };

    if (status === 'closed_won') {
      updateData.convertedAt = new Date();
    } else if (status === 'closed_lost') {
      updateData.lostAt = new Date();
    }

    const prospect = await this.prisma.salesProspect.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return { id, status, updatedAt: prospect.updatedAt.toISOString() };
  }

  async deleteProspect(id: string) {
    await this.prisma.salesProspect.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: 'Prospect deleted successfully' };
  }

  async getProposals(salesRepId: bigint) {
    const proposals = await this.prisma.salesProposal.findMany({
      where: { salesRepId },
      include: { prospect: true },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map(p => ({
      id: String(p.id),
      prospectId: String(p.prospectId),
      prospectName: p.prospect.name,
      title: p.title,
      planType: p.planType,
      value: Number(p.value),
      discount: Number(p.discount || 0),
      finalValue: Number(p.finalValue),
      status: p.status,
      validUntil: p.validUntil.toISOString(),
      sentAt: p.sentAt?.toISOString() || null,
      viewedAt: p.viewedAt?.toISOString() || null,
      respondedAt: p.respondedAt?.toISOString() || null,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
      items: p.items ? JSON.parse(p.items) : [],
    }));
  }

  async createProposal(salesRepId: bigint, data: any) {
    const finalValue = data.value * (1 - (data.discount || 0) / 100);

    const proposal = await this.prisma.salesProposal.create({
      data: {
        salesRepId,
        prospectId: BigInt(data.prospectId),
        title: data.title,
        planType: data.planType,
        value: data.value,
        discount: data.discount || 0,
        finalValue,
        status: 'draft',
        validUntil: new Date(data.validUntil),
        notes: data.notes,
        items: data.items ? JSON.stringify(data.items) : null,
      },
    });

    return {
      id: String(proposal.id),
      ...data,
      finalValue,
      status: 'draft',
      createdAt: proposal.createdAt.toISOString(),
    };
  }

  async updateProposal(id: string, data: any) {
    const finalValue = data.value * (1 - (data.discount || 0) / 100);

    const proposal = await this.prisma.salesProposal.update({
      where: { id: BigInt(id) },
      data: {
        title: data.title,
        planType: data.planType,
        value: data.value,
        discount: data.discount || 0,
        finalValue,
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        notes: data.notes,
        items: data.items ? JSON.stringify(data.items) : undefined,
      },
    });

    return { id, ...data, finalValue, updatedAt: proposal.updatedAt.toISOString() };
  }

  async sendProposal(id: string) {
    const proposal = await this.prisma.salesProposal.update({
      where: { id: BigInt(id) },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });

    await this.prisma.salesProspect.update({
      where: { id: proposal.prospectId },
      data: {
        status: 'proposal_sent',
        stage: 'proposal_sent',
      },
    });

    return {
      id,
      status: 'sent',
      sentAt: proposal.sentAt?.toISOString(),
    };
  }

  async deleteProposal(id: string) {
    await this.prisma.salesProposal.delete({
      where: { id: BigInt(id) },
    });
    return { success: true, message: 'Proposal deleted successfully' };
  }

  async getPipeline(salesRepId: bigint) {
    const prospects = await this.prisma.salesProspect.findMany({
      where: {
        salesRepId,
        status: { notIn: ['closed_won', 'closed_lost'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const activities = await this.prisma.salesActivity.findMany({
      where: {
        salesRepId,
        prospectId: { in: prospects.map(p => p.id) },
      },
      orderBy: { date: 'desc' },
    });

    const activityMap = new Map();
    activities.forEach(a => {
      if (!activityMap.has(String(a.prospectId))) {
        activityMap.set(String(a.prospectId), a);
      }
    });

    return prospects.map(p => {
      const lastActivity = activityMap.get(String(p.id));
      const daysInStage = Math.floor(
        (new Date().getTime() - p.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: String(p.id),
        prospectName: p.name,
        contactName: p.contactName,
        contactEmail: p.contactEmail,
        contactPhone: p.contactPhone,
        stage: p.stage,
        value: Number(p.estimatedValue || 0),
        probability: p.probability || 20,
        daysInStage,
        lastActivity: lastActivity?.title || 'Nenhuma atividade',
        nextAction: p.nextAction || 'Definir próxima ação',
        nextActionDate: p.nextActionDate?.toISOString() || null,
      };
    });
  }

  async updatePipelineStage(id: string, stage: string) {
    const prospect = await this.prisma.salesProspect.update({
      where: { id: BigInt(id) },
      data: {
        stage,
        status: stage,
      },
    });

    return { id, stage, updatedAt: prospect.updatedAt.toISOString() };
  }

  async getMetrics(salesRepId: bigint) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const startOfThisMonth = new Date(currentYear, currentMonth, 1);
    const endOfThisMonth = new Date(currentYear, currentMonth + 1, 0);
    const startOfLastMonth = new Date(lastMonthYear, lastMonth, 1);
    const endOfLastMonth = new Date(lastMonthYear, lastMonth + 1, 0);

    const totalLeads = await this.prisma.salesProspect.count({
      where: { salesRepId },
    });

    const leadsThisMonth = await this.prisma.salesProspect.count({
      where: {
        salesRepId,
        createdAt: { gte: startOfThisMonth, lte: endOfThisMonth },
      },
    });

    const leadsLastMonth = await this.prisma.salesProspect.count({
      where: {
        salesRepId,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    });

    const leadsGrowth = leadsLastMonth > 0
      ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth * 100).toFixed(1)
      : 0;

    const totalConversions = await this.prisma.salesProspect.count({
      where: { salesRepId, status: 'closed_won' },
    });

    const conversionsThisMonth = await this.prisma.salesProspect.count({
      where: {
        salesRepId,
        status: 'closed_won',
        convertedAt: { gte: startOfThisMonth, lte: endOfThisMonth },
      },
    });

    const conversionsLastMonth = await this.prisma.salesProspect.count({
      where: {
        salesRepId,
        status: 'closed_won',
        convertedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    });

    const conversionsGrowth = conversionsLastMonth > 0
      ? ((conversionsThisMonth - conversionsLastMonth) / conversionsLastMonth * 100).toFixed(1)
      : 0;

    const conversionRate = totalLeads > 0
      ? ((totalConversions / totalLeads) * 100).toFixed(1)
      : 0;

    const commissions = await this.prisma.salesCommission.findMany({
      where: { salesRepId },
    });

    const totalRevenue = commissions.reduce((sum, c) => sum + Number(c.dealValue), 0);

    const commissionsThisMonth = commissions.filter(c => {
      const closedDate = new Date(c.closedAt);
      return closedDate >= startOfThisMonth && closedDate <= endOfThisMonth;
    });

    const commissionsLastMonth = commissions.filter(c => {
      const closedDate = new Date(c.closedAt);
      return closedDate >= startOfLastMonth && closedDate <= endOfLastMonth;
    });

    const revenueThisMonth = commissionsThisMonth.reduce((sum, c) => sum + Number(c.dealValue), 0);
    const revenueLastMonth = commissionsLastMonth.reduce((sum, c) => sum + Number(c.dealValue), 0);

    const revenueGrowth = revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100).toFixed(1)
      : 0;

    const activeProspects = await this.prisma.salesProspect.findMany({
      where: {
        salesRepId,
        status: { notIn: ['closed_won', 'closed_lost'] },
      },
    });

    const expectedRevenue = activeProspects.reduce(
      (sum, p) => sum + Number(p.estimatedValue || 0) * (p.probability || 20) / 100,
      0
    );

    const avgTicket = commissions.length > 0
      ? totalRevenue / commissions.length
      : 0;

    const monthlyPerformance = await this.getMonthlyPerformance(salesRepId);

    const funnelMetrics = await this.getFunnelMetrics(salesRepId);

    const revenueBySource = await this.getRevenueBySource(salesRepId);

    const goal = await this.prisma.salesGoal.findUnique({
      where: {
        salesRepId_month: {
          salesRepId,
          month: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
        },
      },
    });

    return {
      totalLeads,
      leadsThisMonth,
      leadsLastMonth,
      leadsGrowth: Number(leadsGrowth),
      totalConversions,
      conversionsThisMonth,
      conversionsLastMonth,
      conversionsGrowth: Number(conversionsGrowth),
      conversionRate: Number(conversionRate),
      conversionRateLastMonth: 0,
      conversionRateGrowth: 0,
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      revenueGrowth: Number(revenueGrowth),
      expectedRevenue,
      avgTicket,
      avgTicketLastMonth: 0,
      avgTicketGrowth: 0,
      avgDealCycle: 18,
      avgDealCycleLastMonth: 22,
      avgDealCycleGrowth: -18.2,
      monthlyPerformance,
      funnelMetrics,
      revenueBySource,
      planDistribution: [],
      weeklyActivity: [],
      monthlyGoal: Number(goal?.targetRevenue || 80000),
      yearlyGoal: 800000,
      yearlyAchieved: totalRevenue,
    };
  }

  private async getMonthlyPerformance(salesRepId: bigint) {
    const months: { month: string; leads: number; conversions: number; revenue: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const leads = await this.prisma.salesProspect.count({
        where: {
          salesRepId,
          createdAt: { gte: monthStart, lte: monthEnd },
        },
      });

      const conversions = await this.prisma.salesProspect.count({
        where: {
          salesRepId,
          status: 'closed_won',
          convertedAt: { gte: monthStart, lte: monthEnd },
        },
      });

      const commissions = await this.prisma.salesCommission.findMany({
        where: {
          salesRepId,
          closedAt: { gte: monthStart, lte: monthEnd },
        },
      });

      const revenue = commissions.reduce((sum, c) => sum + Number(c.dealValue), 0);

      const monthName = date.toLocaleString('pt-BR', { month: 'short' });

      months.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        leads,
        conversions,
        revenue,
      });
    }

    return months;
  }

  private async getFunnelMetrics(salesRepId: bigint) {
    const total = await this.prisma.salesProspect.count({
      where: { salesRepId },
    });

    const stages = [
      { stage: 'Prospecção', status: 'prospecting' },
      { stage: 'Qualificação', status: 'qualification' },
      { stage: 'Proposta', status: 'proposal_sent' },
      { stage: 'Negociação', status: 'negotiation' },
      { stage: 'Fechamento', status: 'closed_won' },
    ];

    const funnel: { stage: string; count: number; conversion: number }[] = [];
    for (const s of stages) {
      const count = await this.prisma.salesProspect.count({
        where: { salesRepId, status: s.status },
      });
      funnel.push({
        stage: s.stage,
        count,
        conversion: total > 0 ? Math.round((count / total) * 100) : 0,
      });
    }

    return funnel;
  }

  private async getRevenueBySource(salesRepId: bigint) {
    const sources = ['Indicação', 'Site', 'LinkedIn', 'Eventos', 'Cold Call'];
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'];

    const result: { name: string; value: number; color: string }[] = [];
    for (let i = 0; i < sources.length; i++) {
      const prospects = await this.prisma.salesProspect.findMany({
        where: {
          salesRepId,
          source: sources[i],
          status: 'closed_won',
        },
      });

      const value = prospects.reduce((sum, p) => sum + Number(p.estimatedValue || 0), 0);
      result.push({
        name: sources[i],
        value,
        color: colors[i],
      });
    }

    return result;
  }

  async getCommissions(salesRepId: bigint) {
    const commissions = await this.prisma.salesCommission.findMany({
      where: { salesRepId },
      orderBy: { closedAt: 'desc' },
    });

    return commissions.map(c => ({
      id: String(c.id),
      agencyName: c.agencyName,
      planType: c.planType,
      dealValue: Number(c.dealValue),
      commissionRate: Number(c.commissionRate),
      commissionValue: Number(c.commissionValue),
      status: c.status,
      closedAt: c.closedAt.toISOString(),
      paidAt: c.paidAt?.toISOString() || null,
      paymentMonth: c.paymentMonth,
    }));
  }

  async getCommissionsSummary(salesRepId: bigint) {
    const commissions = await this.prisma.salesCommission.findMany({
      where: { salesRepId },
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const totalEarned = commissions.reduce((sum, c) => sum + Number(c.commissionValue), 0);
    const totalPending = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.commissionValue), 0);
    const totalProcessing = commissions
      .filter(c => c.status === 'processing')
      .reduce((sum, c) => sum + Number(c.commissionValue), 0);
    const totalPaid = commissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + Number(c.commissionValue), 0);

    const thisMonthCommissions = commissions.filter(c => c.paymentMonth === currentMonth);
    const lastMonthCommissions = commissions.filter(c => c.paymentMonth === lastMonth);

    const thisMonth = thisMonthCommissions.reduce((sum, c) => sum + Number(c.commissionValue), 0);
    const lastMonthTotal = lastMonthCommissions.reduce((sum, c) => sum + Number(c.commissionValue), 0);

    const avgCommission = commissions.length > 0 ? totalEarned / commissions.length : 0;
    const commissionRate = commissions.length > 0
      ? commissions.reduce((sum, c) => sum + Number(c.commissionRate), 0) / commissions.length
      : 10;

    const monthlyCommissions = await this.getMonthlyCommissions(salesRepId);

    const byPlan = await this.getCommissionsByPlan(salesRepId);

    return {
      totalEarned,
      totalPending,
      totalProcessing,
      totalPaid,
      thisMonth,
      lastMonth: lastMonthTotal,
      avgCommission,
      totalDeals: commissions.length,
      commissionRate,
      monthlyCommissions,
      byPlan,
    };
  }

  private async getMonthlyCommissions(salesRepId: bigint) {
    const months: { month: string; paid: number; pending: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('pt-BR', { month: 'short' });

      const commissions = await this.prisma.salesCommission.findMany({
        where: {
          salesRepId,
          paymentMonth: monthKey,
        },
      });

      const paid = commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.commissionValue), 0);
      const pending = commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + Number(c.commissionValue), 0);

      months.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        paid,
        pending,
      });
    }

    return months;
  }

  private async getCommissionsByPlan(salesRepId: bigint) {
    const plans = [
      { name: 'Starter', color: '#94A3B8' },
      { name: 'Business', color: '#3B82F6' },
      { name: 'Premium', color: '#8B5CF6' },
      { name: 'Enterprise', color: '#10B981' },
    ];

    const result: { name: string; value: number; color: string }[] = [];
    for (const plan of plans) {
      const commissions = await this.prisma.salesCommission.findMany({
        where: {
          salesRepId,
          planType: plan.name.toLowerCase(),
        },
      });

      const value = commissions.reduce((sum, c) => sum + Number(c.commissionValue), 0);
      result.push({
        name: plan.name,
        value,
        color: plan.color,
      });
    }

    return result;
  }

  async getAgenciesSummary() {
    const agencies = await this.prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        status: true,
        plan: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agencies.map(agency => ({
      id: String(agency.id),
      name: agency.name,
      email: agency.email,
      phone: agency.phone || '',
      city: agency.city || '',
      state: agency.state || '',
      status: agency.status,
      plan: agency.plan,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
      createdAt: agency.createdAt.toISOString(),
    }));
  }

  async getAgenciesMetrics() {
    const agencies = await this.prisma.agency.findMany({
      select: {
        id: true,
        status: true,
        plan: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    const totalAgencies = agencies.length;
    const activeAgencies = agencies.filter(a => a.status === 'ACTIVE').length;
    const inactiveAgencies = agencies.filter(a => a.status === 'INACTIVE').length;

    const planDistribution = agencies.reduce((acc, agency) => {
      acc[agency.plan] = (acc[agency.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalUsers = agencies.reduce((sum, a) => sum + a._count.users, 0);
    const totalProperties = agencies.reduce((sum, a) => sum + a._count.properties, 0);

    const monthlySignups = agencies.reduce((acc, agency) => {
      const month = agency.createdAt.toISOString().slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAgencies,
      activeAgencies,
      inactiveAgencies,
      planDistribution,
      totalUsers,
      totalProperties,
      monthlySignups,
    };
  }
}
