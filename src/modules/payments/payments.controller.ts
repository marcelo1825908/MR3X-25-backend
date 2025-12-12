import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all payments' })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('agencyId') agencyId?: string,
    @CurrentUser('brokerId') brokerId?: string,
    @Query('search') search?: string,
  ) {
    return this.paymentsService.findAll(userId, role, agencyId, brokerId, search);
  }

  @Get('reports/annual')
  @ApiOperation({ summary: 'Get annual payment report' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  async getAnnualReport(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('agencyId') agencyId?: string,
    @Query('year') year?: string,
  ) {
    const yearNum = year ? parseInt(year) : undefined;
    return this.paymentsService.getAnnualReport(userId, role, yearNum, agencyId);
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get payments by property ID' })
  async findByProperty(
    @Param('propertyId') propertyId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.paymentsService.findByProperty(propertyId, userId, role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.paymentsService.findOne(id, userId, role);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new payment' })
  @OwnerPermission('payments', OwnerAction.CREATE)
  async create(
    @Body() data: CreatePaymentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.paymentsService.create(userId, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update payment' })
  @OwnerPermission('payments', OwnerAction.EDIT)
  async update(
    @Param('id') id: string,
    @Body() data: UpdatePaymentDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.paymentsService.update(id, userId, role, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete payment' })
  @OwnerPermission('payments', OwnerAction.DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.paymentsService.remove(id, userId, role);
  }
}
