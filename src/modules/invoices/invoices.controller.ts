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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto, MarkAsPaidDto, CancelInvoiceDto, ResendInvoiceDto } from './dto/update-invoice.dto';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'referenceMonth', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('referenceMonth') referenceMonth?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: any,
  ) {
    // Data isolation based on role
    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;
    let userId: string | undefined;

    if (user?.role === 'CEO') {
      // CEO sees all - no filtering
    } else if (user?.role === 'ADMIN') {
      // ADMIN sees only invoices they created
      createdById = user.sub;
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER sees only their own invoices
      createdById = user.sub;
    } else if (user?.agencyId) {
      // Agency users see only their agency's invoices
      effectiveAgencyId = user.agencyId;
    } else if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      // Agency admins/managers without agencyId
      userId = user?.sub;
    } else {
      // For any other role, use userId fallback
      userId = user?.sub;
    }

    return this.invoicesService.findAll({
      skip,
      take,
      agencyId: effectiveAgencyId,
      propertyId,
      contractId,
      tenantId,
      ownerId,
      status,
      type,
      referenceMonth,
      startDate,
      endDate,
      createdById,
      userId,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get invoice statistics' })
  async getStatistics(@CurrentUser() user?: any) {
    let createdById: string | undefined;
    let agencyId: string | undefined;
    let userId: string | undefined;

    if (user?.role === 'CEO') {
      // CEO sees all
    } else if (user?.role === 'ADMIN' || user?.role === 'INDEPENDENT_OWNER') {
      createdById = user.sub;
    } else if (user?.agencyId) {
      agencyId = user.agencyId;
    } else {
      userId = user?.sub;
    }

    return this.invoicesService.getStatistics({ agencyId, createdById, userId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download invoice (boleto/PIX)' })
  async downloadInvoice(@Param('id') id: string) {
    return this.invoicesService.downloadInvoice(id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Download payment receipt' })
  async downloadReceipt(@Param('id') id: string) {
    return this.invoicesService.downloadReceipt(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  async create(
    @Body() data: CreateInvoiceDto,
    @CurrentUser() user: any,
  ) {
    return this.invoicesService.create(data, user.sub, user.agencyId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update invoice' })
  async update(
    @Param('id') id: string,
    @Body() data: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, data);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Mark invoice as paid' })
  async markAsPaid(
    @Param('id') id: string,
    @Body() data: MarkAsPaidDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.markAsPaid(id, data, userId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel invoice' })
  async cancel(
    @Param('id') id: string,
    @Body() data: CancelInvoiceDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.cancel(id, data, userId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend invoice to tenant' })
  async resend(
    @Param('id') id: string,
    @Body() data: ResendInvoiceDto,
  ) {
    return this.invoicesService.resendToTenant(id, data.email);
  }

  @Post('update-overdue')
  @ApiOperation({ summary: 'Update overdue invoices (admin only)' })
  async updateOverdue(@CurrentUser() user: any) {
    // Only allow CEO or ADMIN to run this
    if (user?.role !== 'CEO' && user?.role !== 'ADMIN') {
      return { error: 'Unauthorized' };
    }
    return this.invoicesService.updateOverdueInvoices();
  }
}
