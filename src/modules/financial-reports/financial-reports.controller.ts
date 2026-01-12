import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FinancialReportsService, FinancialReportFilters } from './financial-reports.service';
import { Req } from '@nestjs/common';

@ApiTags('Financial Reports')
@Controller('financial-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinancialReportsController {
  constructor(private readonly reportsService: FinancialReportsService) {}

  @Get()
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  @ApiOperation({ summary: 'Generate financial report' })
  @ApiQuery({ name: 'type', required: false, enum: ['daily', 'monthly', 'annual'], description: 'Report type' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  async generateReport(
    @Query('type') type?: 'daily' | 'monthly' | 'annual',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @CurrentUser() user?: any,
    @Req() req?: any,
  ) {
    const filters: FinancialReportFilters = {
      type,
      startDate,
      endDate,
      agencyId,
      ownerId,
      propertyId,
      contractId,
    };

    const clientIP = req?.ip || req?.connection?.remoteAddress || 'N/A';
    return this.reportsService.generateReport(filters, user?.sub, user?.role, clientIP);
  }

  @Get('export/csv')
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  @ApiOperation({ summary: 'Export financial report as CSV' })
  @ApiQuery({ name: 'type', required: false, enum: ['daily', 'monthly', 'annual'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  async exportCSV(
    @Res() res: Response,
    @Query('type') type?: 'daily' | 'monthly' | 'annual',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @CurrentUser() user?: any,
    @Req() req?: any,
  ) {
    const filters: FinancialReportFilters = {
      type,
      startDate,
      endDate,
      agencyId,
      ownerId,
      propertyId,
      contractId,
    };

    const clientIP = req?.ip || req?.connection?.remoteAddress || 'N/A';
    const reportData = await this.reportsService.generateReport(filters, user?.sub, user?.role, clientIP);
    const csv = await this.reportsService.exportToCSV(reportData);

    const filename = `relatorio-financeiro-${reportData.period.type}-${reportData.period.start}-${reportData.period.end}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Integrity-Hash', reportData.hash);
    res.setHeader('X-Generated-At', reportData.generatedAt);
    res.setHeader('X-Generated-By', reportData.generatedBy);
    res.setHeader('X-Generated-By-IP', reportData.ip);
    res.send(csv);
  }

  @Get('export/json')
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  @ApiOperation({ summary: 'Export financial report as JSON' })
  @ApiQuery({ name: 'type', required: false, enum: ['daily', 'monthly', 'annual'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  async exportJSON(
    @Res() res: Response,
    @Query('type') type?: 'daily' | 'monthly' | 'annual',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @CurrentUser() user?: any,
    @Req() req?: any,
  ) {
    const filters: FinancialReportFilters = {
      type,
      startDate,
      endDate,
      agencyId,
      ownerId,
      propertyId,
      contractId,
    };

    const clientIP = req?.ip || req?.connection?.remoteAddress || 'N/A';
    const reportData = await this.reportsService.generateReport(filters, user?.sub, user?.role, clientIP);
    const json = await this.reportsService.exportToJSON(reportData);

    const filename = `relatorio-financeiro-${reportData.period.type}-${reportData.period.start}-${reportData.period.end}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Integrity-Hash', reportData.hash);
    res.setHeader('X-Generated-At', reportData.generatedAt);
    res.setHeader('X-Generated-By', reportData.generatedBy);
    res.setHeader('X-Generated-By-IP', reportData.ip);
    res.send(json);
  }

  @Get('export/pdf')
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  @ApiOperation({ summary: 'Export financial report as PDF with integrity hash' })
  @ApiQuery({ name: 'type', required: false, enum: ['daily', 'monthly', 'annual'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  async exportPDF(
    @Res() res: Response,
    @Query('type') type?: 'daily' | 'monthly' | 'annual',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agencyId') agencyId?: string,
    @Query('ownerId') ownerId?: string,
    @Query('propertyId') propertyId?: string,
    @Query('contractId') contractId?: string,
    @CurrentUser() user?: any,
    @Req() req?: any,
  ) {
    const filters: FinancialReportFilters = {
      type,
      startDate,
      endDate,
      agencyId,
      ownerId,
      propertyId,
      contractId,
    };

    const clientIP = req?.ip || req?.connection?.remoteAddress || 'N/A';
    const reportData = await this.reportsService.generateReport(filters, user?.sub, user?.role, clientIP);
    const pdf = await this.reportsService.exportToPDF(reportData);

    const filename = `relatorio-financeiro-${reportData.period.type}-${reportData.period.start}-${reportData.period.end}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Integrity-Hash', reportData.hash);
    res.setHeader('X-Generated-At', reportData.generatedAt);
    res.setHeader('X-Generated-By', reportData.generatedBy);
    res.setHeader('X-Generated-By-IP', reportData.ip);
    res.send(pdf);
  }
}

