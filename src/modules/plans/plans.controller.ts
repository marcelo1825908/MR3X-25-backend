import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PlansService, PlanUpdateDTO } from './plans.service';
import { PlanEnforcementService } from './plan-enforcement.service';
import { MicrotransactionBillingService } from './microtransaction-billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, MicrotransactionType } from '@prisma/client';
import { getAllPlansForDisplay, PLANS_CONFIG } from './plans.data';

@ApiTags('Plans')
@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly planEnforcementService: PlanEnforcementService,
    private readonly microtransactionBillingService: MicrotransactionBillingService,
  ) {}


  @Get()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get all plans' })
  async getPlans() {
    return this.plansService.getPlans();
  }

  @Get('pricing')
  @ApiOperation({ summary: 'Get all plans with full pricing details (public)' })
  async getPricing() {
    return getAllPlansForDisplay();
  }

  @Get('config/:planName')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get full plan configuration by name' })
  async getPlanConfig(@Param('planName') planName: string) {
    const config = PLANS_CONFIG[planName.toUpperCase()];
    if (!config) {
      throw new BadRequestException(`Plan ${planName} not found`);
    }
    return config;
  }


  @Get('modification-requests/pending')
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Get pending plan modification requests (CEO only)' })
  async getPendingModificationRequests() {
    return this.plansService.getPendingModificationRequests();
  }

  @Get('modification-requests')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all plan modification requests' })
  async getAllModificationRequests() {
    return this.plansService.getAllModificationRequests();
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get plan by ID' })
  async getPlanById(@Param('id') id: string) {
    return this.plansService.getPlanById(id);
  }


  @Get('agency/:agencyId/usage')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get comprehensive plan usage for an agency' })
  async getAgencyUsage(@Param('agencyId') agencyId: string) {
    return this.plansService.getAgencyPlanUsage(agencyId);
  }

  @Get('agency/:agencyId/usage-summary')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get monthly usage summary with billing details' })
  @ApiQuery({ name: 'month', required: false, description: 'Format: YYYY-MM' })
  async getUsageSummary(
    @Param('agencyId') agencyId: string,
    @Query('month') month?: string,
  ) {
    return this.microtransactionBillingService.getUsageSummary(agencyId, month);
  }

  @Get('agency/:agencyId/billing-history')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get billing history for an agency' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of months to retrieve' })
  async getBillingHistory(
    @Param('agencyId') agencyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.microtransactionBillingService.getBillingHistory(agencyId, limit ? parseInt(limit) : 12);
  }

  @Get('agency/:agencyId/pending-charges')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get pending microtransactions for an agency' })
  async getPendingCharges(@Param('agencyId') agencyId: string) {
    return this.microtransactionBillingService.getPendingMicrotransactions(agencyId);
  }

  @Get('agency/:agencyId/pricing')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get microtransaction pricing for agency based on their plan' })
  async getAgencyPricing(@Param('agencyId') agencyId: string) {
    return this.plansService.getMicrotransactionPricingForAgency(agencyId);
  }


  @Get('agency/:agencyId/frozen')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get summary of frozen entities for an agency' })
  async getFrozenSummary(@Param('agencyId') agencyId: string) {
    return this.planEnforcementService.getFrozenEntitiesSummary(agencyId);
  }

  @Get('agency/:agencyId/frozen/list')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Get list of frozen contracts and users for an agency' })
  async getFrozenList(@Param('agencyId') agencyId: string) {
    return this.planEnforcementService.getFrozenEntitiesList(agencyId);
  }

  @Post('agency/:agencyId/switch-contract/:contractId')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Switch active contract (for FREE plan with 1 contract limit)' })
  async switchActiveContract(
    @Param('agencyId') agencyId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.planEnforcementService.switchActiveContract(agencyId, contractId);
  }

  @Get('agency/:agencyId/can-create-contract')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Check if agency can create a new contract' })
  async canCreateContract(@Param('agencyId') agencyId: string) {
    return this.plansService.canCreateContract(agencyId);
  }

  @Get('agency/:agencyId/can-perform-inspection')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Check if agency can perform an inspection (and if it requires payment)' })
  async canPerformInspection(@Param('agencyId') agencyId: string) {
    return this.plansService.canPerformInspection(agencyId);
  }

  @Get('agency/:agencyId/can-create-settlement')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Check if agency can create a settlement (and if it requires payment)' })
  async canCreateSettlement(@Param('agencyId') agencyId: string) {
    return this.plansService.canCreateSettlement(agencyId);
  }

  @Get('agency/:agencyId/can-create-tenant')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Check if agency can create a new tenant' })
  async canCreateTenant(@Param('agencyId') agencyId: string) {
    return this.plansService.canCreateTenant(agencyId);
  }

  @Get('user/:userId/can-create-tenant')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER, UserRole.PROPRIETARIO)
  @ApiOperation({ summary: 'Check if owner can create a new tenant' })
  async canCreateTenantForOwner(@Param('userId') userId: string) {
    return this.plansService.canCreateTenantForOwner(userId);
  }

  @Get('agency/:agencyId/screening-price')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get tenant screening price for agency' })
  async getScreeningPrice(@Param('agencyId') agencyId: string) {
    const price = await this.plansService.getScreeningPrice(agencyId);
    return { price };
  }


  @Get('agency/:agencyId/calculate-upgrade/:targetPlan')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Calculate cost and changes for upgrading to a different plan' })
  async calculateUpgrade(
    @Param('agencyId') agencyId: string,
    @Param('targetPlan') targetPlan: string,
  ) {
    return this.plansService.calculateUpgrade(agencyId, targetPlan.toUpperCase());
  }

  @Get('agency/:agencyId/preview-change/:targetPlan')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Preview what would happen if agency changes plan' })
  async previewPlanChange(
    @Param('agencyId') agencyId: string,
    @Param('targetPlan') targetPlan: string,
  ) {
    return this.planEnforcementService.previewPlanChange(agencyId, targetPlan.toUpperCase());
  }

  @Post('agency/:agencyId/change-plan')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PLATFORM_MANAGER, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Change agency plan (enforces limits)' })
  async changePlan(
    @Param('agencyId') agencyId: string,
    @Body() body: { newPlan: string },
  ) {
    return this.planEnforcementService.enforcePlanLimits(agencyId, body.newPlan.toUpperCase());
  }

  @Post('agency/:agencyId/enforce-limits')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PLATFORM_MANAGER, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Enforce current plan limits (freeze excess users/contracts/properties)' })
  async enforceCurrentPlanLimits(@Param('agencyId') agencyId: string) {
    return this.planEnforcementService.enforceCurrentPlanLimits(agencyId);
  }


  @Post('agency/:agencyId/api-addon/enable')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Enable API add-on for PROFESSIONAL plan (+R$29/month)' })
  async enableApiAddOn(@Param('agencyId') agencyId: string) {
    return this.plansService.enableApiAddOn(agencyId);
  }

  @Post('agency/:agencyId/api-addon/disable')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Disable API add-on' })
  async disableApiAddOn(@Param('agencyId') agencyId: string) {
    await this.plansService.disableApiAddOn(agencyId);
    return { success: true, message: 'API add-on disabled successfully' };
  }

  @Get('agency/:agencyId/api-access')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Check if API access is allowed for agency' })
  async checkApiAccess(@Param('agencyId') agencyId: string) {
    return this.planEnforcementService.checkApiAccessAllowed(agencyId);
  }


  @Post('agency/:agencyId/charge/extra-contract')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Charge for an extra contract beyond plan limit' })
  async chargeExtraContract(
    @Param('agencyId') agencyId: string,
    @Body() body: { contractId: string },
    @Request() req: any,
  ) {
    return this.microtransactionBillingService.chargeExtraContract(
      agencyId,
      body.contractId,
      req.user.sub,
    );
  }

  @Post('agency/:agencyId/charge/inspection')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Charge for an inspection (if plan requires payment)' })
  async chargeInspection(
    @Param('agencyId') agencyId: string,
    @Body() body: { inspectionId: string },
    @Request() req: any,
  ) {
    return this.microtransactionBillingService.chargeInspection(
      agencyId,
      body.inspectionId,
      req.user.sub,
    );
  }

  @Post('agency/:agencyId/charge/settlement')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Charge for a settlement/agreement (if plan requires payment)' })
  async chargeSettlement(
    @Param('agencyId') agencyId: string,
    @Body() body: { agreementId: string },
    @Request() req: any,
  ) {
    return this.microtransactionBillingService.chargeSettlement(
      agencyId,
      body.agreementId,
      req.user.sub,
    );
  }

  @Post('agency/:agencyId/charge/screening')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Charge for tenant screening (always pay-per-use)' })
  async chargeScreening(
    @Param('agencyId') agencyId: string,
    @Body() body: { analysisId: string },
    @Request() req: any,
  ) {
    return this.microtransactionBillingService.chargeScreening(
      agencyId,
      body.analysisId,
      req.user.sub,
    );
  }

  @Post('microtransaction/:id/mark-paid')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Mark a microtransaction as paid' })
  async markMicrotransactionPaid(
    @Param('id') id: string,
    @Body() body: { asaasPaymentId?: string; paymentMethod?: string },
  ) {
    await this.microtransactionBillingService.markAsPaid(id, body);
    return { success: true, message: 'Microtransaction marked as paid' };
  }

  @Post('agency/:agencyId/reset-monthly-usage')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PLATFORM_MANAGER)
  @ApiOperation({ summary: 'Reset monthly usage counters for an agency' })
  async resetMonthlyUsage(@Param('agencyId') agencyId: string) {
    await this.microtransactionBillingService.resetMonthlyUsage(agencyId);
    return { success: true, message: 'Monthly usage reset successfully' };
  }


  @Put(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan (CEO: direct update, ADMIN: creates modification request)' })
  async updatePlan(@Param('id') id: string, @Body() data: PlanUpdateDTO, @Request() req: any) {
    const userId = req.user.sub;
    const userRole = req.user.role as UserRole;
    return this.plansService.updatePlan(id, data, userId, userRole);
  }

  @Put('name/:name')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan by name (CEO: direct update, ADMIN: creates modification request)' })
  async updatePlanByName(@Param('name') name: string, @Body() data: PlanUpdateDTO, @Request() req: any) {
    const userId = req.user.sub;
    const userRole = req.user.role as UserRole;
    return this.plansService.updatePlanByName(name, data, userId, userRole);
  }

  @Post('modification-requests/:id/approve')
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Approve a plan modification request (CEO only)' })
  async approveModificationRequest(@Param('id') id: string, @Request() req: any) {
    const reviewerId = req.user.sub;
    return this.plansService.approveModificationRequest(id, reviewerId);
  }

  @Post('modification-requests/:id/reject')
  @Roles(UserRole.CEO)
  @ApiOperation({ summary: 'Reject a plan modification request (CEO only)' })
  async rejectModificationRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: any
  ) {
    const reviewerId = req.user.sub;
    return this.plansService.rejectModificationRequest(id, reviewerId, body.reason);
  }

  @Post('update-counts')
  @Roles(UserRole.ADMIN, UserRole.CEO)
  @ApiOperation({ summary: 'Update subscriber counts for all plans' })
  async updateSubscriberCounts() {
    return this.plansService.updateSubscriberCounts();
  }


  @Get('user/:userId/limits')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Check plan limits for a user (legacy)' })
  @ApiQuery({ name: 'type', required: true, enum: ['property', 'user', 'contract'] })
  async checkUserLimits(
    @Param('userId') userId: string,
    @Query('type') limitType: 'property' | 'user' | 'contract',
  ) {
    return this.plansService.checkPlanLimits(userId, limitType);
  }

  @Get('user/:userId/usage')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get plan usage for a user (legacy)' })
  async getUserUsage(@Param('userId') userId: string) {
    return this.plansService.getPlanUsage(userId);
  }

  // ==================== INDEPENDENT OWNER PLAN MANAGEMENT ====================

  @Get('owner/:userId/plan-usage')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get plan usage for independent owner' })
  async getOwnerPlanUsage(@Param('userId') userId: string) {
    return this.plansService.getOwnerPlanUsage(userId);
  }

  @Get('owner/:userId/preview-change/:targetPlan')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Preview plan change for independent owner' })
  async previewOwnerPlanChange(
    @Param('userId') userId: string,
    @Param('targetPlan') targetPlan: string,
  ) {
    return this.plansService.previewOwnerPlanChange(userId, targetPlan.toUpperCase());
  }

  @Post('owner/:userId/change-plan')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Change plan for independent owner (for downgrades/free)' })
  async changeOwnerPlan(
    @Param('userId') userId: string,
    @Body() body: { newPlan: string },
  ) {
    return this.plansService.changeOwnerPlan(userId, body.newPlan.toUpperCase());
  }

  @Post('owner/:userId/create-plan-payment')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Create payment for independent owner plan upgrade' })
  async createOwnerPlanPayment(
    @Param('userId') userId: string,
    @Body() body: { newPlan: string },
  ) {
    return this.plansService.createOwnerPlanPayment(userId, body.newPlan.toUpperCase());
  }

  @Post('owner/:userId/confirm-plan-payment')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Confirm payment and apply plan change for independent owner' })
  async confirmOwnerPlanPayment(
    @Param('userId') userId: string,
    @Body() body: { paymentId: string; newPlan: string },
  ) {
    return this.plansService.confirmOwnerPlanPayment(userId, body.paymentId, body.newPlan.toUpperCase());
  }

  @Get('owner/:userId/frozen-entities')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get frozen entities for independent owner' })
  async getOwnerFrozenEntities(@Param('userId') userId: string) {
    return this.plansService.getOwnerFrozenEntities(userId);
  }

  @Get('owner/:userId/check-property-creation')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Check if independent owner can create a new property' })
  async checkOwnerPropertyCreationAllowed(@Param('userId') userId: string) {
    return this.plansService.checkOwnerPropertyCreationAllowed(userId);
  }
}
