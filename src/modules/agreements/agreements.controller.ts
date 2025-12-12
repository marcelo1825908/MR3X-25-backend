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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AgreementsService } from './agreements.service';
import { AgreementCalculationService } from './services/agreement-calculation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { CreateAgreementDto, AgreementStatus } from './dto/create-agreement.dto';
import { UpdateAgreementDto, SignAgreementDto, ApproveRejectAgreementDto } from './dto/update-agreement.dto';
import {
  CalculateDebtDto,
  SimulateDebtDto,
  AcceptSettlementDto,
  CalculateMultipleDebtsDto,
  DebtCalculationResponseDto,
  SettlementOptionsResponseDto,
} from './dto/calculation.dto';
import { Request } from 'express';

// Permission imports
import { AgreementPermissionGuard } from './guards/agreement-permission.guard';
import { LoadedAgreement, AgreementUserContext } from './guards/agreement-permission.guard';
import {
  AgreementPermission,
  CanCreateAgreement,
  CanEditAgreement,
  CanDeleteAgreement,
  CanViewAgreement,
  CanApproveAgreement,
  CanCancelAgreement,
  CanSendForSignature,
} from './decorators/agreement-permission.decorator';
import { AgreementAction, SignatureType } from './constants/agreement-permissions.constants';
import { AgreementPermissionService, UserContext } from './services/agreement-permission.service';

@ApiTags('Agreements')
@Controller('agreements')
@UseGuards(JwtAuthGuard, AgreementPermissionGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class AgreementsController {
  constructor(
    private readonly agreementsService: AgreementsService,
    private readonly permissionService: AgreementPermissionService,
    private readonly calculationService: AgreementCalculationService,
  ) {}

  @Get()
  @AgreementPermission(AgreementAction.VIEW)
  @ApiOperation({ summary: 'List all agreements (filtered by user permissions)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: any,
  ) {
    // Build user context for permission-based filtering
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    // Get permission-based filter
    const accessFilter = this.permissionService.getAccessFilter(userContext);

    return this.agreementsService.findAll({
      skip,
      take,
      agencyId,
      propertyId,
      contractId,
      type,
      status,
      tenantId,
      ownerId,
      startDate,
      endDate,
      search,
      accessFilter, // Pass the permission-based filter
      userContext,  // Pass user context for additional filtering logic
    });
  }

  @Get('statistics')
  @AgreementPermission(AgreementAction.VIEW)
  @ApiOperation({ summary: 'Get agreement statistics (filtered by user permissions)' })
  async getStatistics(@CurrentUser() user?: any) {
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    const accessFilter = this.permissionService.getAccessFilter(userContext);

    return this.agreementsService.getStatistics({ accessFilter });
  }

  @Get('my-permissions')
  @ApiOperation({ summary: 'Get current user agreement permissions summary' })
  async getMyPermissions(@CurrentUser() user?: any) {
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    // Return available actions for the user
    return {
      role: user.role,
      canView: this.permissionService.canPerformAction(userContext, AgreementAction.VIEW).allowed,
      canCreate: this.permissionService.canPerformAction(userContext, AgreementAction.CREATE).allowed,
      canEdit: this.permissionService.canPerformAction(userContext, AgreementAction.EDIT).allowed,
      canDelete: this.permissionService.canPerformAction(userContext, AgreementAction.DELETE).allowed,
      canSign: this.permissionService.canPerformAction(userContext, AgreementAction.SIGN).allowed,
      canApprove: this.permissionService.canPerformAction(userContext, AgreementAction.APPROVE).allowed,
      canReject: this.permissionService.canPerformAction(userContext, AgreementAction.REJECT).allowed,
      canCancel: this.permissionService.canPerformAction(userContext, AgreementAction.CANCEL).allowed,
      canSendForSignature: this.permissionService.canPerformAction(userContext, AgreementAction.SEND_FOR_SIGNATURE).allowed,
    };
  }

  @Get('templates')
  @ApiOperation({ summary: 'List all agreement templates' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'isDefault', required: false, type: Boolean })
  async findAllTemplates(
    @Query('agencyId') agencyId?: string,
    @Query('type') type?: string,
    @Query('isDefault') isDefault?: string,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;

    if (user?.agencyId && !agencyId) {
      effectiveAgencyId = user.agencyId;
    }

    return this.agreementsService.findAllTemplates({
      agencyId: effectiveAgencyId,
      type,
      isDefault: isDefault === 'true' ? true : isDefault === 'false' ? false : undefined,
    });
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  async findOneTemplate(@Param('id') id: string) {
    return this.agreementsService.findOneTemplate(id);
  }

  @Post('templates')
  @CanCreateAgreement()
  @OwnerPermission('agreements', OwnerAction.CREATE)
  @ApiOperation({ summary: 'Create a new agreement template' })
  async createTemplate(@Body() data: any, @CurrentUser('sub') userId: string) {
    return this.agreementsService.createTemplate(data, userId);
  }

  @Put('templates/:id')
  @CanEditAgreement()
  @OwnerPermission('agreements', OwnerAction.EDIT)
  @ApiOperation({ summary: 'Update agreement template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  async updateTemplate(@Param('id') id: string, @Body() data: any) {
    return this.agreementsService.updateTemplate(id, data);
  }

  @Delete('templates/:id')
  @CanDeleteAgreement()
  @OwnerPermission('agreements', OwnerAction.DELETE)
  @ApiOperation({ summary: 'Delete agreement template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  async removeTemplate(@Param('id') id: string) {
    return this.agreementsService.removeTemplate(id);
  }

  // ============================================
  // DEBT CALCULATION & SETTLEMENT ENDPOINTS
  // ============================================

  @Get('calculate/invoice/:invoiceId')
  @AgreementPermission(AgreementAction.VIEW)
  @ApiOperation({
    summary: 'Calculate current debt for an invoice',
    description: 'Calculates monetary correction, penalty, and daily interest based on contract parameters',
  })
  @ApiParam({ name: 'invoiceId', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: DebtCalculationResponseDto })
  async calculateDebt(
    @Param('invoiceId') invoiceId: string,
    @Query() query: CalculateDebtDto,
  ) {
    const calculationDate = query.calculationDate ? new Date(query.calculationDate) : undefined;
    return this.calculationService.calculateDebt(invoiceId, calculationDate);
  }

  @Get('calculate/invoice/:invoiceId/options')
  @AgreementPermission(AgreementAction.VIEW)
  @ApiOperation({
    summary: 'Get settlement options for an invoice',
    description: 'Returns all available settlement options with different discount tiers',
  })
  @ApiParam({ name: 'invoiceId', description: 'Invoice ID' })
  @ApiResponse({ status: 200, type: SettlementOptionsResponseDto })
  async getSettlementOptions(
    @Param('invoiceId') invoiceId: string,
    @Query() query: CalculateDebtDto,
  ) {
    const calculationDate = query.calculationDate ? new Date(query.calculationDate) : undefined;
    return this.calculationService.getSettlementOptions(invoiceId, calculationDate);
  }

  @Post('calculate/multiple')
  @AgreementPermission(AgreementAction.VIEW)
  @ApiOperation({
    summary: 'Calculate debt for multiple invoices',
    description: 'Useful for creating agreements covering multiple overdue invoices',
  })
  async calculateMultipleDebts(@Body() body: CalculateMultipleDebtsDto) {
    const calculationDate = body.calculationDate ? new Date(body.calculationDate) : undefined;
    return this.calculationService.calculateMultipleDebts(body.invoiceIds, calculationDate);
  }

  @Post('calculate/simulate')
  @AgreementPermission(AgreementAction.VIEW)
  @ApiOperation({
    summary: 'Simulate debt calculation',
    description: 'Test calculation with custom parameters without a real invoice',
  })
  async simulateDebt(@Body() body: SimulateDebtDto) {
    return this.calculationService.simulateDebt({
      baseValue: body.baseValue,
      dueDate: new Date(body.dueDate),
      calculationDate: body.calculationDate ? new Date(body.calculationDate) : undefined,
      readjustmentIndex: body.readjustmentIndex,
      penaltyPercent: body.penaltyPercent,
      monthlyInterestPercent: body.monthlyInterestPercent,
    });
  }

  @Post('settlement/accept')
  @CanCreateAgreement()
  @OwnerPermission('agreements', OwnerAction.CREATE)
  @ApiOperation({
    summary: 'Accept a settlement option',
    description: 'Freezes the calculated values and returns data for agreement creation',
  })
  async acceptSettlement(
    @Body() body: AcceptSettlementDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const settlementData = await this.calculationService.acceptSettlement(
      body.invoiceId,
      body.optionId,
      userId,
      clientIP,
      userAgent,
    );

    return settlementData;
  }

  @Post('settlement/accept-and-create')
  @CanCreateAgreement()
  @OwnerPermission('agreements', OwnerAction.CREATE)
  @ApiOperation({
    summary: 'Accept settlement and create agreement in one step',
    description: 'Combines settlement acceptance with agreement creation',
  })
  async acceptSettlementAndCreate(
    @Body() body: AcceptSettlementDto & { title?: string; notes?: string },
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Get settlement data
    const settlementData = await this.calculationService.acceptSettlement(
      body.invoiceId,
      body.optionId,
      userId,
      clientIP,
      userAgent,
    );

    // Create the agreement
    const agreementData: CreateAgreementDto = {
      contractId: settlementData.contractId,
      propertyId: settlementData.propertyId,
      agencyId: settlementData.agencyId || undefined,
      type: 'PAYMENT_SETTLEMENT' as any,
      title: body.title || `Acordo de Pagamento - Fatura ${settlementData.invoiceToken || settlementData.invoiceId}`,
      description: `Acordo de pagamento para fatura vencida. ${settlementData.calculationDetails.selectedOption.installments > 1 ? `Parcelado em ${settlementData.calculationDetails.selectedOption.installments}x` : 'Pagamento à vista'}`,
      tenantId: settlementData.tenantId,
      ownerId: settlementData.ownerId || undefined,
      originalAmount: settlementData.originalAmount,
      negotiatedAmount: settlementData.negotiatedAmount,
      fineAmount: settlementData.fineAmount,
      discountAmount: settlementData.discountAmount,
      installments: settlementData.installments,
      installmentValue: settlementData.installmentValue,
      notes: body.notes || JSON.stringify(settlementData.calculationDetails),
    };

    const agreement = await this.agreementsService.create(agreementData, userId, clientIP, userAgent);

    return {
      agreement,
      settlementData,
    };
  }

  // ============================================
  // STANDARD AGREEMENT CRUD ENDPOINTS
  // ============================================

  @Get(':id')
  @CanViewAgreement()
  @ApiOperation({ summary: 'Get agreement by ID' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    const agreement = await this.agreementsService.findOne(id);

    // Add available actions for this agreement
    const loadedAgreement = await this.permissionService.loadAgreementForPermissionCheck(id);
    if (loadedAgreement) {
      agreement.availableActions = this.permissionService.getAvailableActions(userContext, loadedAgreement);
    }

    return agreement;
  }

  @Get(':id/permissions')
  @CanViewAgreement()
  @ApiOperation({ summary: 'Get user permissions for a specific agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async getAgreementPermissions(
    @Param('id') id: string,
    @CurrentUser() user?: any,
  ) {
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    const agreement = await this.permissionService.loadAgreementForPermissionCheck(id);

    if (!agreement) {
      return { error: 'Agreement not found' };
    }

    return {
      agreementId: id,
      agreementStatus: agreement.status,
      availableActions: this.permissionService.getAvailableActions(userContext, agreement),
      permissions: {
        canView: this.permissionService.canViewAgreement(userContext, agreement),
        canEdit: this.permissionService.canEditAgreement(userContext, agreement),
        canDelete: this.permissionService.canDeleteAgreement(userContext, agreement),
        canApprove: this.permissionService.canApproveAgreement(userContext, agreement),
        canCancel: this.permissionService.canCancelAgreement(userContext, agreement),
        canSignAsTenant: this.permissionService.canSignAgreement(userContext, agreement, SignatureType.TENANT),
        canSignAsOwner: this.permissionService.canSignAgreement(userContext, agreement, SignatureType.OWNER),
        canSignAsAgency: this.permissionService.canSignAgreement(userContext, agreement, SignatureType.AGENCY),
        canSignAsBroker: this.permissionService.canSignAgreement(userContext, agreement, SignatureType.BROKER),
      },
    };
  }

  @Post()
  @CanCreateAgreement()
  @OwnerPermission('agreements', OwnerAction.CREATE)
  @ApiOperation({ summary: 'Create a new agreement' })
  async create(
    @Body() data: CreateAgreementDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.agreementsService.create(data, userId, clientIP, userAgent);
  }

  @Put(':id')
  @CanEditAgreement()
  @OwnerPermission('agreements', OwnerAction.EDIT)
  @ApiOperation({ summary: 'Update agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateAgreementDto,
    @CurrentUser() user?: any,
  ) {
    // Permission check is done by the guard, but we double-check status here
    return this.agreementsService.update(id, data, user);
  }

  @Patch(':id/sign')
  @AgreementPermission(AgreementAction.SIGN)
  @OwnerPermission('agreements', OwnerAction.SIGN)
  @ApiOperation({ summary: 'Sign agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async sign(
    @Param('id') id: string,
    @Body() data: SignAgreementDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userContext: UserContext = {
      sub: user.sub,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId?.toString(),
      brokerId: user.brokerId?.toString(),
      creci: user.creci,
      document: user.document,
    };

    // Determine signature type from the request body
    let signatureType: SignatureType | undefined;
    if (data.tenantSignature) signatureType = SignatureType.TENANT;
    else if (data.ownerSignature) signatureType = SignatureType.OWNER;
    else if (data.agencySignature) signatureType = SignatureType.AGENCY;

    // Load agreement and validate permission for this specific signature type
    if (signatureType) {
      const agreement = await this.permissionService.loadAgreementForPermissionCheck(id);
      if (agreement) {
        const canSign = this.permissionService.canSignAgreement(userContext, agreement, signatureType);
        if (!canSign.allowed) {
          throw new Error(canSign.reason || 'Cannot sign this agreement');
        }
      }
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.agreementsService.sign(id, data, user.sub, clientIP, userAgent);
  }

  @Patch(':id/send-for-signature')
  @CanSendForSignature()
  @OwnerPermission('agreements', OwnerAction.EDIT)
  @ApiOperation({ summary: 'Send agreement for signature' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async sendForSignature(@Param('id') id: string) {
    return this.agreementsService.sendForSignature(id);
  }

  @Patch(':id/approve')
  @CanApproveAgreement()
  @OwnerPermission('agreements', OwnerAction.APPROVE)
  @ApiOperation({ summary: 'Approve and complete agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.agreementsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @AgreementPermission(AgreementAction.REJECT)
  @OwnerPermission('agreements', OwnerAction.APPROVE)
  @ApiOperation({ summary: 'Reject agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async reject(
    @Param('id') id: string,
    @Body() data: ApproveRejectAgreementDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.agreementsService.reject(id, userId, data);
  }

  @Patch(':id/cancel')
  @CanCancelAgreement()
  @OwnerPermission('agreements', OwnerAction.DELETE)
  @ApiOperation({ summary: 'Cancel agreement' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.agreementsService.cancel(id, userId);
  }

  @Patch(':id/status')
  @CanEditAgreement()
  @OwnerPermission('agreements', OwnerAction.EDIT)
  @ApiOperation({ summary: 'Update agreement status' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: AgreementStatus,
  ) {
    return this.agreementsService.updateStatus(id, status);
  }

  @Delete(':id')
  @CanDeleteAgreement()
  @OwnerPermission('agreements', OwnerAction.DELETE)
  @ApiOperation({ summary: 'Delete agreement (only drafts, never signed)' })
  @ApiParam({ name: 'id', description: 'Agreement ID' })
  async remove(@Param('id') id: string) {
    return this.agreementsService.remove(id);
  }
}
