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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SplitConfigurationService } from './split-configuration.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateSplitConfigurationDto,
  CreateSplitReceiverDto,
  CreateSplitRuleDto,
  ChargeType,
} from './dto/create-split-configuration.dto';
import {
  UpdateSplitConfigurationDto,
  UpdateSplitReceiverDto,
  UpdateSplitRuleDto,
  ActivateConfigurationDto,
  DeactivateConfigurationDto,
  ValidateConfigurationDto,
} from './dto/update-split-configuration.dto';
import { Request } from 'express';

@ApiTags('Split Configuration')
@Controller('split-configuration')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SplitConfigurationController {
  constructor(private readonly splitConfigService: SplitConfigurationService) {}

  // ===============================================
  // CONFIGURATION ENDPOINTS
  // ===============================================

  @Get()
  @ApiOperation({ summary: 'List split configurations' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'scope', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async findAll(
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('contractId') contractId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('status') status?: string,
    @Query('scope') scope?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @CurrentUser() user?: any,
  ) {
    // Apply role-based filtering
    let effectiveAgencyId = agencyId;
    let effectiveOwnerId = ownerId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER' || user?.role === 'PROPRIETARIO') {
      effectiveOwnerId = user.sub;
    }

    return this.splitConfigService.findAll({
      agencyId: effectiveAgencyId,
      ownerId: effectiveOwnerId,
      contractId,
      propertyId,
      status,
      scope,
      skip,
      take,
    });
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active configuration for entity' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async findActive(
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('contractId') contractId?: string,
    @Query('propertyId') propertyId?: string,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;
    let effectiveOwnerId = ownerId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER' || user?.role === 'PROPRIETARIO') {
      effectiveOwnerId = user.sub;
    }

    return this.splitConfigService.findActiveForEntity({
      agencyId: effectiveAgencyId,
      ownerId: effectiveOwnerId,
      contractId,
      propertyId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get split configuration by ID' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async findOne(@Param('id') id: string) {
    return this.splitConfigService.findOne(id);
  }

  @Get(':id/audit-logs')
  @ApiOperation({ summary: 'Get audit logs for configuration' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'LEGAL_AUDITOR')
  async getAuditLogs(
    @Param('id') id: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.splitConfigService.getAuditLogs(id, { skip, take });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new split configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async create(
    @Body() data: CreateSplitConfigurationDto,
    @CurrentUser() user: any,
  ) {
    // Auto-fill agency/owner based on role
    if (user?.role === 'AGENCY_ADMIN' && user?.agencyId && !data.agencyId) {
      data.agencyId = Number(user.agencyId);
    } else if (user?.role === 'INDEPENDENT_OWNER' && !data.ownerId) {
      data.ownerId = Number(user.sub);
    }

    return this.splitConfigService.create(data, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update split configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateSplitConfigurationDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.update(id, data, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete split configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async delete(
    @Param('id') id: string,
    @Query('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.delete(id, user.sub, reason);
  }

  // ===============================================
  // STATUS MANAGEMENT ENDPOINTS
  // ===============================================

  @Patch(':id/validate')
  @ApiOperation({ summary: 'Validate split configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async validate(
    @Param('id') id: string,
    @Body() data: ValidateConfigurationDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.validate(id, data, user.sub);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate split configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async activate(
    @Param('id') id: string,
    @Body() data: ActivateConfigurationDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.activate(id, data, user.sub);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate split configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async deactivate(
    @Param('id') id: string,
    @Body() data: DeactivateConfigurationDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.deactivate(id, data, user.sub);
  }

  @Post(':id/new-version')
  @ApiOperation({ summary: 'Create new version of configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async createNewVersion(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.createNewVersion(id, user.sub);
  }

  // ===============================================
  // RECEIVER ENDPOINTS
  // ===============================================

  @Post(':id/receivers')
  @ApiOperation({ summary: 'Add receiver to configuration' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async createReceiver(
    @Param('id') id: string,
    @Body() data: CreateSplitReceiverDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.createReceiver(id, data, user.sub);
  }

  @Put(':id/receivers/:receiverId')
  @ApiOperation({ summary: 'Update receiver' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async updateReceiver(
    @Param('id') id: string,
    @Param('receiverId') receiverId: string,
    @Body() data: UpdateSplitReceiverDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.updateReceiver(id, receiverId, data, user.sub);
  }

  @Delete(':id/receivers/:receiverId')
  @ApiOperation({ summary: 'Delete receiver' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async deleteReceiver(
    @Param('id') id: string,
    @Param('receiverId') receiverId: string,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.deleteReceiver(id, receiverId, user.sub);
  }

  // ===============================================
  // RULE ENDPOINTS
  // ===============================================

  @Post(':id/receivers/:receiverId/rules')
  @ApiOperation({ summary: 'Add rule to receiver' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async createRule(
    @Param('id') id: string,
    @Param('receiverId') receiverId: string,
    @Body() data: CreateSplitRuleDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.createRule(id, receiverId, data, user.sub);
  }

  @Put(':id/rules/:ruleId')
  @ApiOperation({ summary: 'Update rule' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async updateRule(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @Body() data: UpdateSplitRuleDto,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.updateRule(id, ruleId, data, user.sub);
  }

  @Delete(':id/rules/:ruleId')
  @ApiOperation({ summary: 'Delete rule' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async deleteRule(
    @Param('id') id: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() user: any,
  ) {
    return this.splitConfigService.deleteRule(id, ruleId, user.sub);
  }

  // ===============================================
  // SPLIT CALCULATION ENDPOINTS
  // ===============================================

  @Get(':id/calculate')
  @ApiOperation({ summary: 'Calculate split for a given amount' })
  @ApiQuery({ name: 'amount', required: true, type: Number })
  @ApiQuery({ name: 'chargeType', required: false, enum: ChargeType })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async calculateSplit(
    @Param('id') id: string,
    @Query('amount') amount: number,
    @Query('chargeType') chargeType?: ChargeType,
  ) {
    return this.splitConfigService.calculateSplit(id, Number(amount), chargeType);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview split for entity' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'amount', required: true, type: Number })
  @ApiQuery({ name: 'chargeType', required: false, enum: ChargeType })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async previewSplit(
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('contractId') contractId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('amount') amount?: number,
    @Query('chargeType') chargeType?: ChargeType,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;
    let effectiveOwnerId = ownerId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER' || user?.role === 'PROPRIETARIO') {
      effectiveOwnerId = user.sub;
    }

    return this.splitConfigService.previewSplit({
      agencyId: effectiveAgencyId,
      ownerId: effectiveOwnerId,
      contractId,
      propertyId,
      grossAmount: Number(amount),
      chargeType,
    });
  }
}
