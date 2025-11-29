import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

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
      // ADMIN sees only their own data (each admin is independent)
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
      // INDEPENDENT_OWNER sees only properties they created (not by ownerId)
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
}
