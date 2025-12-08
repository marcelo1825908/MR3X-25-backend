import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { PlatformManagerService } from './platform-manager.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('platform-manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PLATFORM_MANAGER', 'ADMIN', 'CEO')
export class PlatformManagerController {
  constructor(private readonly platformManagerService: PlatformManagerService) {}

  @Get('dashboard/metrics')
  async getDashboardMetrics() {
    const data = await this.platformManagerService.getDashboardMetrics();
    return data;
  }

  @Get('dashboard/agency-status')
  async getAgencyStatusDistribution() {
    const data = await this.platformManagerService.getAgencyStatusDistribution();
    return data;
  }

  @Get('dashboard/ticket-status')
  async getTicketStatusDistribution() {
    const data = await this.platformManagerService.getTicketStatusDistribution();
    return data;
  }

  @Get('dashboard/monthly-tickets')
  async getMonthlyTickets() {
    const data = await this.platformManagerService.getMonthlyTickets();
    return data;
  }

  @Get('dashboard/platform-health')
  async getPlatformHealth() {
    const data = await this.platformManagerService.getPlatformHealth();
    return data;
  }

  @Get('dashboard/recent-activities')
  async getRecentActivities() {
    const data = await this.platformManagerService.getRecentActivities();
    return data;
  }

  @Get('dashboard/system-status')
  async getSystemStatus() {
    const data = await this.platformManagerService.getSystemStatus();
    return data;
  }

  @Get('agencies')
  async getAgencies(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
  ) {
    const data = await this.platformManagerService.getAgencies({ search, status, plan });
    return { data };
  }

  @Get('agencies/:id')
  async getAgencyById(@Param('id') id: string) {
    const data = await this.platformManagerService.getAgencyById(id);
    if (!data) {
      throw new NotFoundException('Agência não encontrada');
    }
    return { data };
  }

  @Get('internal-users')
  async getInternalUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.platformManagerService.getInternalUsers({ search, role, status });
    return { data };
  }

  @Get('logs')
  async getLogs(
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.platformManagerService.getLogs({
      type,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
    });
    return data;
  }

  @Get('plans-overview')
  async getPlansOverview() {
    const data = await this.platformManagerService.getPlansOverview();
    return data;
  }

  @Get('billing-overview')
  async getBillingOverview() {
    const data = await this.platformManagerService.getBillingOverview();
    return data;
  }

  @Get('webhook-logs')
  async getWebhookLogs(
    @Query('service') service?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.platformManagerService.getWebhookLogs({ service, status, startDate, endDate });
    return { data };
  }

  @Get('tickets')
  async getTickets(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
  ) {
    const data = await this.platformManagerService.getTickets({ status, priority, category });
    return { data };
  }
}
