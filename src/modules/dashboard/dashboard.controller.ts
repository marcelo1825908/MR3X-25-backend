import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { ApiConsumptionService } from './api-consumption.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly apiConsumptionService: ApiConsumptionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard data based on user role' })
  async getDashboard(@Req() req: any) {
    const userId = req.user.sub;
    const role = req.user.role;
    const agencyId = req.user.agencyId;
    const brokerId = req.user.brokerId;

    if (role === 'CEO') {
      return this.dashboardService.getCEODashboard();
    } else if (role === 'ADMIN') {
      return this.dashboardService.getAdminDashboard(userId);
    } else if (role === 'INQUILINO') {
      return this.dashboardService.getTenantDashboard(userId);
    } else if (role === 'AGENCY_ADMIN') {
      return this.dashboardService.getAgencyAdminDashboard(userId, agencyId);
    } else if (role === 'AGENCY_MANAGER') {
      return this.dashboardService.getManagerDashboard(userId, agencyId);
    } else if (role === 'BROKER') {
      return this.dashboardService.getBrokerDashboard(userId, agencyId, brokerId);
    } else if (role === 'INDEPENDENT_OWNER') {
      return this.dashboardService.getIndependentOwnerDashboard(userId);
    } else {
      return this.dashboardService.getOwnerDashboard(userId);
    }
  }

  @Get('due-dates')
  @ApiOperation({ summary: 'Get upcoming due dates' })
  async getDueDates(@Req() req: any) {
    const userId = req.user.sub;
    const role = req.user.role;
    const agencyId = req.user.agencyId;
    const brokerId = req.user.brokerId;
    return this.dashboardService.getDueDates(userId, role, agencyId, brokerId);
  }

  @Get('tenant/documents')
  @ApiOperation({ summary: 'Get tenant documents' })
  async getTenantDocuments(@Req() req: any) {
    const userId = req.user.sub;
    return this.dashboardService.getTenantDocuments(userId);
  }

  @Get('tenant/status')
  @ApiOperation({ summary: 'Get tenant status' })
  async getTenantStatus(@Req() req: any) {
    const userId = req.user.sub;
    return this.dashboardService.getTenantDashboard(userId);
  }

  @Get('platform-revenue')
  @ApiOperation({ summary: 'Get platform revenue from agencies and independent owners (CEO only)' })
  async getPlatformRevenue(@Req() req: any) {
    const role = req.user.role;

    if (role !== 'CEO') {
      return { error: 'Acesso negado. Apenas CEO pode visualizar a receita da plataforma.' };
    }

    return this.dashboardService.getPlatformRevenue();
  }

  @Get('tenant-alerts')
  @ApiOperation({ summary: 'Get tenant alerts (extrajudicial notices, agreements, overdue payments)' })
  async getTenantAlerts(@Req() req: any) {
    const userId = req.user.sub;
    return this.dashboardService.getTenantAlerts(userId);
  }

  @Get('billing')
  @ApiOperation({ summary: 'Get billing data (invoices and stats) for CEO' })
  async getBillingData(@Req() req: any) {
    const role = req.user.role;

    if (role !== 'CEO') {
      return { error: 'Acesso negado. Apenas CEO pode visualizar dados de faturamento.' };
    }

    return this.dashboardService.getBillingData();
  }

  @Post('extrajudicial/:notificationId/acknowledge')
  @ApiOperation({ summary: 'Record tenant acknowledgment of extrajudicial notification' })
  async acknowledgeExtrajudicial(
    @Param('notificationId') notificationId: string,
    @Body() data: {
      acknowledgmentType: 'DASHBOARD_VIEW' | 'CLICK' | 'SIGNATURE';
      ipAddress?: string;
      geoLat?: number;
      geoLng?: number;
      geoConsent?: boolean;
      userAgent?: string;
      signature?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user.sub;
    return this.dashboardService.acknowledgeExtrajudicial(userId, notificationId, data);
  }

  @Get('api-consumption')
  @ApiOperation({ summary: 'Get API consumption data (Cellere and Infosimples)' })
  async getApiConsumption(@Req() req: any) {
    const role = req.user.role;
    
    // Only CEO and ADMIN can view API consumption
    if (role !== 'CEO' && role !== 'ADMIN') {
      return { error: 'Acesso negado. Apenas CEO e ADMIN podem visualizar o consumo de APIs.' };
    }

    return this.apiConsumptionService.getConsumptionData();
  }

  @Post('api-consumption/refresh')
  @ApiOperation({ summary: 'Manually refresh API consumption data' })
  async refreshApiConsumption(@Req() req: any) {
    const role = req.user.role;
    
    // Only CEO and ADMIN can refresh API consumption
    if (role !== 'CEO' && role !== 'ADMIN') {
      return { error: 'Acesso negado. Apenas CEO e ADMIN podem atualizar o consumo de APIs.' };
    }

    return this.apiConsumptionService.refreshData();
  }

  @Post('tenant-banner/acknowledge')
  @ApiOperation({ summary: 'Record tenant acknowledgment of mandatory banner (legal requirement)' })
  async acknowledgeBanner(
    @Body() data: {
      type: 'UPCOMING_DUE' | 'OVERDUE' | 'EXTRAJUDICIAL' | 'AGREEMENT';
      itemId?: string;
      ipAddress: string;
      userAgent: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user.sub;
    const role = req.user.role;

    // Only tenants can acknowledge banner
    if (role !== 'INQUILINO') {
      return { error: 'Acesso negado. Apenas inquilinos podem reconhecer o banner.' };
    }

    return this.dashboardService.acknowledgeBanner(userId, data);
  }
}
