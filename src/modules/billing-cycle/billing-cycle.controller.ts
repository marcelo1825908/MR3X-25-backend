import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingCycleService, ChargeType } from './billing-cycle.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class CreateChargeDto {
  chargeType: ChargeType;
  description: string;
  grossValue: number;
  dueDate: string;
  contractId?: string;
  propertyId?: string;
  tenantId?: string;
}

class RefundChargeDto {
  reason: string;
}

class TrackUsageDto {
  feature: string;
  quantity?: number;
  referenceId?: string;
  referenceType?: string;
}

@ApiTags('Billing Cycles')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingCycleController {
  constructor(private readonly billingService: BillingCycleService) {}

  // ===============================================
  // BILLING CYCLE ENDPOINTS
  // ===============================================

  @Get('cycles')
  @ApiOperation({ summary: 'List billing cycles' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'billingMonth', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER')
  async findAllCycles(
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('billingMonth') billingMonth?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;
    let effectiveOwnerId = ownerId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      effectiveOwnerId = user.sub;
    }

    return this.billingService.findAllCycles({
      agencyId: effectiveAgencyId,
      ownerId: effectiveOwnerId,
      billingMonth,
      status,
      skip,
      take,
    });
  }

  @Get('cycles/current')
  @ApiOperation({ summary: 'Get current billing cycle' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER')
  async getCurrentCycle(
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;
    let effectiveOwnerId = ownerId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      effectiveOwnerId = user.sub;
    }

    return this.billingService.getCurrentCycle({
      agencyId: effectiveAgencyId,
      ownerId: effectiveOwnerId,
    });
  }

  @Get('cycles/:id')
  @ApiOperation({ summary: 'Get billing cycle by ID' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER')
  async findOneCycle(@Param('id') id: string) {
    return this.billingService.findOneCycle(id);
  }

  @Post('cycles/:id/close')
  @ApiOperation({ summary: 'Close billing cycle' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async closeCycle(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.billingService.closeCycle(id, user.sub);
  }

  @Get('cycles/:id/overages')
  @ApiOperation({ summary: 'Get usage overages for cycle' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER')
  async getCycleOverages(@Param('id') id: string) {
    const cycle = await this.billingService.findOneCycle(id);
    return this.billingService.calculateOverages(cycle.agencyId, cycle.ownerId, cycle.billingMonth);
  }

  // ===============================================
  // BILLING CHARGE ENDPOINTS
  // ===============================================

  @Get('charges')
  @ApiOperation({ summary: 'List billing charges' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'chargeType', required: false, enum: ChargeType })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'billingMonth', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'INQUILINO')
  async findAllCharges(
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('contractId') contractId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('chargeType') chargeType?: string,
    @Query('status') status?: string,
    @Query('billingMonth') billingMonth?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;
    let effectiveOwnerId = ownerId;
    let effectiveTenantId = tenantId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      effectiveOwnerId = user.sub;
    } else if (user?.role === 'INQUILINO') {
      effectiveTenantId = user.sub;
    }

    return this.billingService.findAllCharges({
      agencyId: effectiveAgencyId,
      ownerId: effectiveOwnerId,
      contractId,
      tenantId: effectiveTenantId,
      chargeType,
      status,
      billingMonth,
      skip,
      take,
    });
  }

  @Get('charges/:id')
  @ApiOperation({ summary: 'Get billing charge by ID' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'INQUILINO')
  async findOneCharge(@Param('id') id: string) {
    return this.billingService.findOneCharge(id);
  }

  @Post('charges')
  @ApiOperation({ summary: 'Create a billing charge' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async createCharge(
    @Body() data: CreateChargeDto,
    @CurrentUser() user: any,
  ) {
    let agencyId: string | undefined;
    let ownerId: string | undefined;

    if (user?.role === 'AGENCY_ADMIN' && user?.agencyId) {
      agencyId = user.agencyId.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      ownerId = user.sub;
    }

    const billingMonth = new Date().toISOString().substring(0, 7);

    return this.billingService.createBillingCharge({
      agencyId,
      ownerId,
      contractId: data.contractId,
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      chargeType: data.chargeType,
      description: data.description,
      billingMonth,
      grossValue: data.grossValue,
      dueDate: new Date(data.dueDate),
    });
  }

  @Post('charges/:id/create-payment')
  @ApiOperation({ summary: 'Create payment in Asaas for charge' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async createPayment(@Param('id') id: string) {
    return this.billingService.createPaymentInAsaas(id);
  }

  @Post('charges/:id/refund')
  @ApiOperation({ summary: 'Refund a paid charge' })
  @Roles('CEO', 'ADMIN')
  async refundCharge(
    @Param('id') id: string,
    @Body() data: RefundChargeDto,
  ) {
    return this.billingService.refundCharge(id, data.reason);
  }

  // ===============================================
  // USAGE TRACKING ENDPOINTS
  // ===============================================

  @Post('usage/track')
  @ApiOperation({ summary: 'Track feature usage' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER')
  async trackUsage(
    @Body() data: TrackUsageDto,
    @CurrentUser() user: any,
  ) {
    let agencyId: string;

    if (user?.agencyId) {
      agencyId = user.agencyId.toString();
    } else {
      throw new Error('Agency ID required for usage tracking');
    }

    return this.billingService.trackUsage({
      agencyId,
      feature: data.feature,
      quantity: data.quantity,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
    });
  }

  @Get('usage/overages')
  @ApiOperation({ summary: 'Get current usage overages' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'billingMonth', required: false, type: String })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER')
  async getOverages(
    @Query('agencyId') agencyId?: string,
    @Query('billingMonth') billingMonth?: string,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    }

    return this.billingService.calculateOverages(effectiveAgencyId, undefined, billingMonth);
  }
}
