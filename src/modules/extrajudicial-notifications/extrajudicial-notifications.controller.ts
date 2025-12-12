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
  Res,
  Headers,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ExtrajudicialNotificationsService } from './extrajudicial-notifications.service';
import { ExtrajudicialNotificationPdfService } from './services/extrajudicial-notification-pdf.service';
import { ExtrajudicialNotificationHashService } from './services/extrajudicial-notification-hash.service';
import { ExtrajudicialSchedulerService } from './services/extrajudicial-scheduler.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { CreateExtrajudicialNotificationDto } from './dto/create-extrajudicial-notification.dto';
import {
  UpdateExtrajudicialNotificationDto,
  SignExtrajudicialNotificationDto,
  RespondExtrajudicialNotificationDto,
  ResolveExtrajudicialNotificationDto,
  ForwardToJudicialDto,
  SendNotificationDto,
} from './dto/update-extrajudicial-notification.dto';

@ApiTags('Extrajudicial Notifications')
@Controller('extrajudicial-notifications')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class ExtrajudicialNotificationsController {
  constructor(
    private readonly notificationsService: ExtrajudicialNotificationsService,
    private readonly pdfService: ExtrajudicialNotificationPdfService,
    private readonly hashService: ExtrajudicialNotificationHashService,
    private readonly schedulerService: ExtrajudicialSchedulerService,
  ) {}

  @Post('generate-automatic')
  @ApiOperation({ summary: 'Manually trigger automatic generation of extrajudicial notifications for overdue contracts' })
  async generateAutomaticNotifications(@CurrentUser() user: any) {
    // Only allow admins and agency admins to trigger this
    if (!['CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER'].includes(user?.role)) {
      throw new Error('Unauthorized to trigger automatic generation');
    }

    return this.schedulerService.checkAndGenerateNotifications();
  }

  @Get()
  @ApiOperation({ summary: 'List all extrajudicial notifications' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'creditorId', required: false, type: String })
  @ApiQuery({ name: 'debtorId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @Query('creditorId') creditorId?: string,
    @Query('debtorId') debtorId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: any,
  ) {
    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;
    let userId: string | undefined = user?.sub;

    if (user?.role === 'CEO') {
      // CEO sees all - don't pass userId to allow seeing everything
      userId = undefined;
    } else if (user?.role === 'ADMIN' || user?.role === 'INDEPENDENT_OWNER') {
      // For these roles, use userId to see notifications they created or are involved in
      createdById = undefined; // Don't restrict by createdById, use userId instead
    } else if (user?.role === 'INQUILINO') {
      // INQUILINO (tenant) sees only notifications where they are the debtor
      // Keep userId to filter by debtorId in the service
      // Don't set agencyId to avoid filtering by agency
      effectiveAgencyId = undefined;
    } else if (user?.agencyId) {
      effectiveAgencyId = user.agencyId;
      userId = undefined; // Agency users see all agency notifications
    }

    return this.notificationsService.findAll({
      skip,
      take,
      agencyId: effectiveAgencyId,
      propertyId,
      contractId,
      creditorId,
      debtorId,
      type,
      status,
      createdById,
      startDate,
      endDate,
      userId,
      search,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get notification statistics' })
  async getStatistics(@CurrentUser() user?: any) {
    let createdById: string | undefined;
    let agencyId: string | undefined;
    let userId: string | undefined;

    if (user?.role === 'CEO') {
      // CEO sees all
    } else if (user?.role === 'ADMIN' || user?.role === 'INDEPENDENT_OWNER') {
      userId = user.sub;
    } else if (user?.role === 'PROPRIETARIO') {
      // PROPRIETARIO sees notifications where they are the creditor
      userId = user.sub;
    } else if (user?.role === 'INQUILINO') {
      // INQUILINO sees notifications where they are the debtor
      userId = user.sub;
    } else if (user?.agencyId) {
      agencyId = user.agencyId;
    } else {
      userId = user?.sub;
    }

    return this.notificationsService.getStatistics({ agencyId, createdById, userId });
  }

  @Get('token/:token')
  @ApiOperation({ summary: 'Get notification by token (for external verification)' })
  async findByToken(@Param('token') token: string) {
    return this.notificationsService.findByToken(token);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  async findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new extrajudicial notification' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.CREATE)
  async create(
    @Body() data: CreateExtrajudicialNotificationDto,
    @CurrentUser('sub') userId: string,
    @Ip() clientIP: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.notificationsService.create(data, userId, clientIP, userAgent);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update notification' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.EDIT)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateExtrajudicialNotificationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.update(id, data, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification (only drafts)' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.DELETE)
  async remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }

  // ==================== Workflow Actions ====================

  @Post(':id/send')
  @ApiOperation({ summary: 'Send notification to debtor' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.EDIT)
  async send(
    @Param('id') id: string,
    @Body() data: SendNotificationDto,
    @CurrentUser('sub') userId: string,
    @Ip() clientIP: string,
  ) {
    return this.notificationsService.send(id, data, userId, clientIP);
  }

  @Patch(':id/view')
  @ApiOperation({ summary: 'Mark notification as viewed by debtor' })
  async markAsViewed(
    @Param('id') id: string,
    @Ip() clientIP: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.notificationsService.markAsViewed(id, clientIP, userAgent);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign notification (creditor, debtor, or witness)' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.SIGN)
  async sign(
    @Param('id') id: string,
    @Body() data: SignExtrajudicialNotificationDto,
    @CurrentUser('sub') userId: string,
    @Ip() clientIP: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.notificationsService.sign(id, data, userId, clientIP, userAgent);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Debtor responds to notification' })
  async respond(
    @Param('id') id: string,
    @Body() data: RespondExtrajudicialNotificationDto,
    @CurrentUser('sub') userId: string,
    @Ip() clientIP: string,
  ) {
    return this.notificationsService.respond(id, data, userId, clientIP);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Mark notification as resolved' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.APPROVE)
  async resolve(
    @Param('id') id: string,
    @Body() data: ResolveExtrajudicialNotificationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.resolve(id, data, userId);
  }

  @Post(':id/forward-judicial')
  @ApiOperation({ summary: 'Forward notification to judicial process' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.APPROVE)
  async forwardToJudicial(
    @Param('id') id: string,
    @Body() data: ForwardToJudicialDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.notificationsService.forwardToJudicial(id, data, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel notification' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.DELETE)
  async cancel(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body('reason') reason?: string,
  ) {
    return this.notificationsService.cancel(id, userId, reason);
  }

  // ==================== PDF Generation ====================

  @Get(':id/pdf/provisional')
  @ApiOperation({ summary: 'Generate provisional PDF (with watermark)' })
  async generateProvisionalPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateProvisionalPdf(BigInt(id));

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="notificacao-extrajudicial-provisoria-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get(':id/pdf/final')
  @ApiOperation({ summary: 'Generate final PDF (with all signatures)' })
  async generateFinalPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateFinalPdf(BigInt(id));

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="notificacao-extrajudicial-final-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get(':id/pdf/download/:type')
  @ApiOperation({ summary: 'Download stored PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Param('type') type: 'provisional' | 'final',
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.getStoredPdf(BigInt(id), type);

    if (!pdfBuffer) {
      res.status(404).json({ message: 'PDF nao encontrado. Gere o PDF primeiro.' });
      return;
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="notificacao-extrajudicial-${type}-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ==================== Finalization ====================

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Finalize notification with final PDF and hash' })
  @OwnerPermission('extrajudicial-notifications', OwnerAction.APPROVE)
  async finalize(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.pdfService.generateFinalPdf(BigInt(id));
    return { message: 'Notificacao extrajudicial finalizada com sucesso' };
  }

  // ==================== Hash Verification ====================

  @Get(':id/verify')
  @ApiOperation({ summary: 'Verify document hash integrity' })
  async verifyHash(@Param('id') id: string) {
    return this.hashService.verifyNotificationHash(id);
  }

  // ==================== Audit Log ====================

  @Get(':id/audit-log')
  @ApiOperation({ summary: 'Get audit log for notification' })
  async getAuditLog(@Param('id') id: string) {
    const notification = await this.notificationsService.findOne(id);
    return notification.audits || [];
  }
}
