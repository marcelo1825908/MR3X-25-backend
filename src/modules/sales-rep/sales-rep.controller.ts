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
import { SalesRepService } from './sales-rep.service';
import { CommissionService } from './commission.service';

@Controller('sales-rep')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('REPRESENTATIVE')
export class SalesRepController {
  constructor(
    private readonly salesMessageService: SalesMessageService,
    private readonly salesRepService: SalesRepService,
    private readonly commissionService: CommissionService,
  ) {}
  @Get('stats')
  async getStats(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getStats(salesRepId);
  }

  // ==================== LEAD ENDPOINTS ====================

  @Get('leads')
  async getLeads(@Request() req: any, @Query() query: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getLeads(salesRepId, {
      status: query.status,
      source: query.source,
      search: query.search,
    });
  }

  @Post('leads')
  async createLead(@Request() req: any, @Body() body: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.createLead(salesRepId, body);
  }

  @Put('leads/:id')
  async updateLead(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.updateLead(id, salesRepId, body);
  }

  @Delete('leads/:id')
  async deleteLead(@Request() req: any, @Param('id') id: string) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.deleteLead(id, salesRepId);
  }

  @Post('leads/:id/activities')
  async addLeadActivity(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.addLeadActivity(id, salesRepId, body);
  }

  @Post('leads/:id/convert-to-prospect')
  async convertLeadToProspect(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.convertLeadToProspect(id, salesRepId, body);
  }

  // ==================== PROSPECT ENDPOINTS ====================

  @Get('prospects')
  async getProspects(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getProspects(salesRepId);
  }

  @Post('prospects')
  async createProspect(@Request() req: any, @Body() body: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.createProspect(salesRepId, body);
  }

  @Put('prospects/:id')
  async updateProspect(@Param('id') id: string, @Body() body: any) {
    return this.salesRepService.updateProspect(id, body);
  }

  @Patch('prospects/:id/status')
  async updateProspectStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.salesRepService.updateProspectStatus(id, body.status);
  }

  @Delete('prospects/:id')
  async deleteProspect(@Param('id') id: string) {
    return this.salesRepService.deleteProspect(id);
  }

  @Get('proposals')
  async getProposals(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getProposals(salesRepId);
  }

  @Post('proposals')
  async createProposal(@Request() req: any, @Body() body: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.createProposal(salesRepId, body);
  }

  @Put('proposals/:id')
  async updateProposal(@Param('id') id: string, @Body() body: any) {
    return this.salesRepService.updateProposal(id, body);
  }

  @Post('proposals/:id/send')
  async sendProposal(@Param('id') id: string) {
    return this.salesRepService.sendProposal(id);
  }

  @Post('proposals/:id/accept')
  async acceptProposal(@Param('id') id: string, @Body() body?: { agencyId?: string; agencyName?: string }) {
    return this.salesRepService.acceptProposal(id, body);
  }

  @Delete('proposals/:id')
  async deleteProposal(@Param('id') id: string) {
    return this.salesRepService.deleteProposal(id);
  }

  @Get('pipeline')
  async getPipeline(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getPipeline(salesRepId);
  }

  @Patch('pipeline/:id/stage')
  async updatePipelineStage(@Param('id') id: string, @Body() body: { stage: string }) {
    return this.salesRepService.updatePipelineStage(id, body.stage);
  }

  @Get('metrics')
  async getMetrics(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getMetrics(salesRepId);
  }

  @Get('commissions')
  async getCommissions(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getCommissions(salesRepId);
  }

  @Get('commissions/summary')
  async getCommissionsSummary(@Request() req: any) {
    const salesRepId = BigInt(req.user.sub);
    return this.salesRepService.getCommissionsSummary(salesRepId);
  }

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

  @Get('agencies')
  async getAgenciesSummary(@Request() req: any) {
    return this.salesRepService.getAgenciesSummary();
  }

  @Get('agencies/metrics')
  async getAgenciesMetrics(@Request() req: any) {
    return this.salesRepService.getAgenciesMetrics();
  }
}
