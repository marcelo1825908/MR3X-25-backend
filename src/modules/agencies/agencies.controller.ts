import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgenciesService, AgencyCreateDTO, AgencyUpdateDTO } from './agencies.service';

@ApiTags('Agencies')
@Controller('agencies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all agencies' })
  async getAgencies() {
    return this.agenciesService.getAgencies();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agency by ID' })
  async getAgencyById(@Param('id') id: string) {
    return this.agenciesService.getAgencyById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new agency' })
  async createAgency(@Body() data: AgencyCreateDTO) {
    return this.agenciesService.createAgency(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an agency' })
  async updateAgency(@Param('id') id: string, @Body() data: AgencyUpdateDTO) {
    return this.agenciesService.updateAgency(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agency' })
  async deleteAgency(@Param('id') id: string) {
    return this.agenciesService.deleteAgency(id);
  }

  // Plan Enforcement Endpoints

  @Get(':id/plan-usage')
  @ApiOperation({ summary: 'Get plan usage summary (active vs frozen properties/users)' })
  async getPlanUsage(@Param('id') id: string) {
    return this.agenciesService.getPlanUsage(id);
  }

  @Get(':id/frozen-entities')
  @ApiOperation({ summary: 'Get list of frozen properties and users' })
  async getFrozenEntities(@Param('id') id: string) {
    return this.agenciesService.getFrozenEntities(id);
  }

  @Get(':id/preview-plan-change')
  @ApiOperation({ summary: 'Preview what would happen if agency changes to a different plan' })
  @ApiQuery({ name: 'newPlan', required: true, description: 'The new plan name (FREE, ESSENTIAL, PROFESSIONAL, ENTERPRISE)' })
  async previewPlanChange(
    @Param('id') id: string,
    @Query('newPlan') newPlan: string,
  ) {
    return this.agenciesService.previewPlanChange(id, newPlan);
  }

  @Post(':id/switch-active-contract')
  @ApiOperation({ summary: 'Switch which contract is active (for FREE plan with 1 contract limit)' })
  async switchActiveContract(
    @Param('id') id: string,
    @Body() data: { newActiveContractId: string },
  ) {
    return this.agenciesService.switchActiveContract(id, data.newActiveContractId);
  }

  @Post(':id/enforce-plan')
  @ApiOperation({ summary: 'Manually enforce plan limits (admin operation)' })
  async enforcePlanLimits(@Param('id') id: string) {
    return this.agenciesService.enforcePlanLimits(id);
  }

  @Get(':id/check-contract-creation')
  @ApiOperation({ summary: 'Check if contract creation is allowed for the agency' })
  async checkContractCreationAllowed(@Param('id') id: string) {
    return this.agenciesService.checkContractCreationAllowed(id);
  }

  @Get(':id/check-user-creation')
  @ApiOperation({ summary: 'Check if user creation is allowed for the agency' })
  async checkUserCreationAllowed(@Param('id') id: string) {
    return this.agenciesService.checkUserCreationAllowed(id);
  }
}
