import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlansService, PlanUpdateDTO } from './plans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Plans')
@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get all plans' })
  async getPlans() {
    return this.plansService.getPlans();
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Get plan by ID' })
  async getPlanById(@Param('id') id: string) {
    return this.plansService.getPlanById(id);
  }

  @Put(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan' })
  async updatePlan(@Param('id') id: string, @Body() data: PlanUpdateDTO) {
    return this.plansService.updatePlan(id, data);
  }

  @Put('name/:name')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update plan by name' })
  async updatePlanByName(@Param('name') name: string, @Body() data: PlanUpdateDTO) {
    return this.plansService.updatePlanByName(name, data);
  }

  @Post('update-counts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update subscriber counts for all plans' })
  async updateSubscriberCounts() {
    return this.plansService.updateSubscriberCounts();
  }
}

