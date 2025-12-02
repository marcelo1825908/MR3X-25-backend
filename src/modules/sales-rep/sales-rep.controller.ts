import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SalesMessageService } from './sales-message.service';

@Controller('sales-rep')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('REPRESENTATIVE')
export class SalesRepController {
  constructor(private readonly salesMessageService: SalesMessageService) {}
  // ==================== STATS ====================
  @Get('stats')
  async getStats(@Request() req: any) {
    return {
      leadsInProgress: 12,
      conversions: 8,
      monthlyTarget: 15,
      monthlyAchieved: 8,
      totalProspects: 45,
      proposalsSent: 18,
      proposalsAccepted: 8,
      proposalsPending: 6,
      proposalsRejected: 4,
      expectedRevenue: 125000,
      commissionEarned: 8500,
      commissionPending: 3200,
      avgTicket: 15625,
      conversionRate: 44.4,
      weeklyPerformance: [
        { week: 'Sem 1', leads: 10, conversions: 4 },
        { week: 'Sem 2', leads: 12, conversions: 5 },
        { week: 'Sem 3', leads: 8, conversions: 3 },
        { week: 'Sem 4', leads: 15, conversions: 8 },
      ],
      pipelineData: [
        { name: 'Prospecção', value: 15, color: '#3B82F6' },
        { name: 'Qualificação', value: 10, color: '#F59E0B' },
        { name: 'Proposta Enviada', value: 8, color: '#8B5CF6' },
        { name: 'Negociação', value: 5, color: '#10B981' },
        { name: 'Fechado Ganho', value: 8, color: '#22C55E' },
        { name: 'Fechado Perdido', value: 4, color: '#EF4444' },
      ],
      recentLeads: [
        { id: 1, name: 'Imobiliária Centro', contact: 'João Silva', status: 'negotiation', value: 25000, date: '2024-12-01' },
        { id: 2, name: 'Imóveis Premium', contact: 'Maria Santos', status: 'proposal_sent', value: 18000, date: '2024-11-30' },
        { id: 3, name: 'Casa & Lar', contact: 'Pedro Costa', status: 'qualification', value: 12000, date: '2024-11-29' },
        { id: 4, name: 'Invest Imóveis', contact: 'Ana Oliveira', status: 'prospecting', value: 30000, date: '2024-11-28' },
      ],
      topProspects: [
        { name: 'Imobiliária Centro', value: 25000, probability: 80 },
        { name: 'Invest Imóveis', value: 30000, probability: 45 },
        { name: 'Imóveis Premium', value: 18000, probability: 60 },
      ],
    };
  }

  // ==================== PROSPECTS ====================
  @Get('prospects')
  async getProspects(@Request() req: any) {
    return [
      {
        id: '1',
        name: 'Imobiliária Centro',
        contactName: 'João Silva',
        contactEmail: 'joao@imobcentro.com',
        contactPhone: '(11) 99999-1234',
        address: 'Rua das Flores, 123',
        city: 'São Paulo',
        state: 'SP',
        status: 'negotiating',
        notes: 'Interessado no plano Premium',
        lastContactAt: new Date(Date.now() - 86400000).toISOString(),
        createdAt: new Date(Date.now() - 2592000000).toISOString(),
        source: 'Indicação',
        estimatedValue: 25000,
      },
      {
        id: '2',
        name: 'Imóveis Premium',
        contactName: 'Maria Santos',
        contactEmail: 'maria@imoveispremium.com',
        contactPhone: '(11) 98888-5678',
        address: 'Av. Paulista, 1000',
        city: 'São Paulo',
        state: 'SP',
        status: 'interested',
        notes: 'Aguardando proposta formal',
        lastContactAt: new Date(Date.now() - 172800000).toISOString(),
        createdAt: new Date(Date.now() - 3456000000).toISOString(),
        source: 'Site',
        estimatedValue: 18000,
      },
    ];
  }

  @Post('prospects')
  async createProspect(@Request() req: any, @Body() body: any) {
    return {
      id: Math.random().toString(36).substring(7),
      ...body,
      status: 'new',
      createdAt: new Date().toISOString(),
      lastContactAt: null,
    };
  }

  @Put('prospects/:id')
  async updateProspect(@Param('id') id: string, @Body() body: any) {
    return { id, ...body, updatedAt: new Date().toISOString() };
  }

  @Patch('prospects/:id/status')
  async updateProspectStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return { id, status: body.status, updatedAt: new Date().toISOString() };
  }

  @Delete('prospects/:id')
  async deleteProspect(@Param('id') id: string) {
    return { success: true, message: 'Prospect deleted successfully' };
  }

  // ==================== PROPOSALS ====================
  @Get('proposals')
  async getProposals(@Request() req: any) {
    return [
      {
        id: '1',
        prospectId: '1',
        prospectName: 'Imobiliária Centro',
        title: 'Proposta Plano Premium - Imobiliária Centro',
        planType: 'premium',
        value: 2500,
        discount: 10,
        finalValue: 2250,
        status: 'viewed',
        validUntil: new Date(Date.now() + 1209600000).toISOString(),
        sentAt: new Date(Date.now() - 259200000).toISOString(),
        viewedAt: new Date(Date.now() - 172800000).toISOString(),
        respondedAt: null,
        notes: 'Desconto especial para primeiros clientes',
        createdAt: new Date(Date.now() - 345600000).toISOString(),
        items: [
          { name: 'Plano Premium Mensal', description: 'Acesso completo à plataforma', quantity: 1, unitPrice: 2500 },
        ],
      },
      {
        id: '2',
        prospectId: '2',
        prospectName: 'Imóveis Premium',
        title: 'Proposta Plano Business - Imóveis Premium',
        planType: 'business',
        value: 1500,
        discount: 0,
        finalValue: 1500,
        status: 'sent',
        validUntil: new Date(Date.now() + 1728000000).toISOString(),
        sentAt: new Date(Date.now() - 86400000).toISOString(),
        viewedAt: null,
        respondedAt: null,
        notes: '',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        items: [
          { name: 'Plano Business Mensal', description: 'Funcionalidades avançadas', quantity: 1, unitPrice: 1500 },
        ],
      },
    ];
  }

  @Post('proposals')
  async createProposal(@Request() req: any, @Body() body: any) {
    return {
      id: Math.random().toString(36).substring(7),
      ...body,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
  }

  @Put('proposals/:id')
  async updateProposal(@Param('id') id: string, @Body() body: any) {
    return { id, ...body, updatedAt: new Date().toISOString() };
  }

  @Post('proposals/:id/send')
  async sendProposal(@Param('id') id: string) {
    return {
      id,
      status: 'sent',
      sentAt: new Date().toISOString(),
    };
  }

  @Delete('proposals/:id')
  async deleteProposal(@Param('id') id: string) {
    return { success: true, message: 'Proposal deleted successfully' };
  }

  // ==================== PIPELINE ====================
  @Get('pipeline')
  async getPipeline(@Request() req: any) {
    return [
      {
        id: '1',
        prospectName: 'Imobiliária Centro',
        contactName: 'João Silva',
        contactEmail: 'joao@imobcentro.com',
        contactPhone: '(11) 99999-1234',
        stage: 'negotiation',
        value: 25000,
        probability: 80,
        daysInStage: 5,
        lastActivity: 'Reunião de negociação',
        nextAction: 'Enviar contrato',
        nextActionDate: new Date(Date.now() + 345600000).toISOString(),
      },
      {
        id: '2',
        prospectName: 'Imóveis Premium',
        contactName: 'Maria Santos',
        contactEmail: 'maria@imoveispremium.com',
        contactPhone: '(11) 98888-5678',
        stage: 'proposal_sent',
        value: 18000,
        probability: 60,
        daysInStage: 3,
        lastActivity: 'Proposta enviada',
        nextAction: 'Follow-up por telefone',
        nextActionDate: new Date(Date.now() + 172800000).toISOString(),
      },
      {
        id: '3',
        prospectName: 'Casa & Lar Imóveis',
        contactName: 'Pedro Costa',
        contactEmail: 'pedro@casaelar.com',
        contactPhone: '(21) 97777-9012',
        stage: 'qualification',
        value: 12000,
        probability: 40,
        daysInStage: 7,
        lastActivity: 'Ligação de qualificação',
        nextAction: 'Enviar material informativo',
        nextActionDate: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: '4',
        prospectName: 'Invest Imóveis',
        contactName: 'Ana Oliveira',
        contactEmail: 'ana@investimoveis.com',
        contactPhone: '(31) 96666-3456',
        stage: 'prospecting',
        value: 30000,
        probability: 20,
        daysInStage: 2,
        lastActivity: 'Lead recebido',
        nextAction: 'Primeiro contato',
        nextActionDate: new Date().toISOString(),
      },
    ];
  }

  @Patch('pipeline/:id/stage')
  async updatePipelineStage(@Param('id') id: string, @Body() body: { stage: string }) {
    return { id, stage: body.stage, updatedAt: new Date().toISOString() };
  }

  // ==================== METRICS ====================
  @Get('metrics')
  async getMetrics(@Request() req: any) {
    return {
      totalLeads: 45,
      leadsThisMonth: 15,
      leadsLastMonth: 12,
      leadsGrowth: 25,
      totalConversions: 18,
      conversionsThisMonth: 5,
      conversionsLastMonth: 4,
      conversionsGrowth: 25,
      conversionRate: 40,
      conversionRateLastMonth: 33.3,
      conversionRateGrowth: 20.1,
      totalRevenue: 285000,
      revenueThisMonth: 75000,
      revenueLastMonth: 62000,
      revenueGrowth: 20.9,
      expectedRevenue: 125000,
      avgTicket: 15833,
      avgTicketLastMonth: 15500,
      avgTicketGrowth: 2.1,
      avgDealCycle: 18,
      avgDealCycleLastMonth: 22,
      avgDealCycleGrowth: -18.2,
      monthlyPerformance: [
        { month: 'Jul', leads: 10, conversions: 3, revenue: 45000 },
        { month: 'Ago', leads: 12, conversions: 4, revenue: 52000 },
        { month: 'Set', leads: 11, conversions: 3, revenue: 48000 },
        { month: 'Out', leads: 14, conversions: 5, revenue: 68000 },
        { month: 'Nov', leads: 12, conversions: 4, revenue: 62000 },
        { month: 'Dez', leads: 15, conversions: 5, revenue: 75000 },
      ],
      funnelMetrics: [
        { stage: 'Prospecção', count: 45, conversion: 100 },
        { stage: 'Qualificação', count: 32, conversion: 71 },
        { stage: 'Proposta', count: 24, conversion: 53 },
        { stage: 'Negociação', count: 20, conversion: 44 },
        { stage: 'Fechamento', count: 18, conversion: 40 },
      ],
      revenueBySource: [
        { name: 'Indicação', value: 95000, color: '#10B981' },
        { name: 'Site', value: 68000, color: '#3B82F6' },
        { name: 'LinkedIn', value: 52000, color: '#F59E0B' },
        { name: 'Eventos', value: 45000, color: '#8B5CF6' },
        { name: 'Cold Call', value: 25000, color: '#EF4444' },
      ],
      planDistribution: [
        { name: 'Starter', value: 4, revenue: 32000, color: '#94A3B8' },
        { name: 'Business', value: 8, revenue: 120000, color: '#3B82F6' },
        { name: 'Premium', value: 4, revenue: 100000, color: '#8B5CF6' },
        { name: 'Enterprise', value: 2, revenue: 100000, color: '#10B981' },
      ],
      weeklyActivity: [
        { day: 'Seg', calls: 15, meetings: 3, proposals: 2 },
        { day: 'Ter', calls: 18, meetings: 4, proposals: 3 },
        { day: 'Qua', calls: 12, meetings: 2, proposals: 1 },
        { day: 'Qui', calls: 20, meetings: 5, proposals: 4 },
        { day: 'Sex', calls: 14, meetings: 3, proposals: 2 },
      ],
      monthlyGoal: 80000,
      yearlyGoal: 800000,
      yearlyAchieved: 350000,
    };
  }

  // ==================== COMMISSIONS ====================
  @Get('commissions')
  async getCommissions(@Request() req: any) {
    return [
      {
        id: '1',
        agencyName: 'Realty Plus',
        planType: 'Business',
        dealValue: 15300,
        commissionRate: 10,
        commissionValue: 1530,
        status: 'paid',
        closedAt: new Date(Date.now() - 1296000000).toISOString(),
        paidAt: new Date(Date.now() - 86400000).toISOString(),
        paymentMonth: '2024-11',
      },
      {
        id: '2',
        agencyName: 'Imóveis Premium',
        planType: 'Premium',
        dealValue: 27000,
        commissionRate: 12,
        commissionValue: 3240,
        status: 'paid',
        closedAt: new Date(Date.now() - 864000000).toISOString(),
        paidAt: new Date(Date.now() - 86400000).toISOString(),
        paymentMonth: '2024-11',
      },
      {
        id: '3',
        agencyName: 'Imobiliária Centro',
        planType: 'Premium',
        dealValue: 25000,
        commissionRate: 12,
        commissionValue: 3000,
        status: 'pending',
        closedAt: new Date().toISOString(),
        paidAt: null,
        paymentMonth: '2024-12',
      },
    ];
  }

  @Get('commissions/summary')
  async getCommissionsSummary(@Request() req: any) {
    return {
      totalEarned: 45680,
      totalPending: 3768,
      totalProcessing: 768,
      totalPaid: 41144,
      thisMonth: 3768,
      lastMonth: 6570,
      avgCommission: 2284,
      totalDeals: 20,
      commissionRate: 10.5,
      monthlyCommissions: [
        { month: 'Jul', paid: 3200, pending: 0 },
        { month: 'Ago', paid: 4100, pending: 0 },
        { month: 'Set', paid: 3800, pending: 0 },
        { month: 'Out', paid: 5200, pending: 0 },
        { month: 'Nov', paid: 6570, pending: 0 },
        { month: 'Dez', paid: 0, pending: 3768 },
      ],
      byPlan: [
        { name: 'Starter', value: 4560, color: '#94A3B8' },
        { name: 'Business', value: 15300, color: '#3B82F6' },
        { name: 'Premium', value: 18720, color: '#8B5CF6' },
        { name: 'Enterprise', value: 7100, color: '#10B981' },
      ],
    };
  }

  // ==================== MESSAGES ====================
  @Get('messages')
  async getMessages(@Request() req: any) {
    const userId = BigInt(req.user.sub);
    return this.salesMessageService.getMessages(userId);
  }

  @Post('messages')
  async createMessage(@Request() req: any, @Body() body: any) {
    const senderId = BigInt(req.user.sub);
    const recipientId = BigInt(body.recipientId);
    return this.salesMessageService.createMessage(
      senderId,
      recipientId,
      body.subject,
      body.content,
    );
  }

  @Patch('messages/:id/read')
  async markMessageAsRead(@Request() req: any, @Param('id') id: string) {
    const messageId = BigInt(id);
    const userId = BigInt(req.user.sub);
    return this.salesMessageService.markAsRead(messageId, userId);
  }

  @Patch('messages/:id/star')
  async toggleMessageStar(@Request() req: any, @Param('id') id: string) {
    const messageId = BigInt(id);
    const userId = BigInt(req.user.sub);
    return this.salesMessageService.toggleStar(messageId, userId);
  }

  @Delete('messages/:id')
  async deleteMessage(@Request() req: any, @Param('id') id: string) {
    const messageId = BigInt(id);
    const userId = BigInt(req.user.sub);
    return this.salesMessageService.deleteMessage(messageId, userId);
  }

  @Post('messages/:id/reply')
  async replyToMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const messageId = BigInt(id);
    const senderId = BigInt(req.user.sub);
    return this.salesMessageService.replyToMessage(messageId, senderId, body.content);
  }

  // ==================== NOTIFICATIONS ====================
  @Get('notifications')
  async getNotifications(@Request() req: any) {
    const userId = BigInt(req.user.sub);
    return this.salesMessageService.getNotifications(userId);
  }

  @Patch('notifications/:id/read')
  async markNotificationAsRead(@Request() req: any, @Param('id') id: string) {
    const notificationId = BigInt(id);
    const userId = BigInt(req.user.sub);
    return this.salesMessageService.markNotificationAsRead(notificationId, userId);
  }

  @Put('notifications/read-all')
  async markAllNotificationsAsRead(@Request() req: any) {
    return { success: true, message: 'All notifications marked as read' };
  }
}
