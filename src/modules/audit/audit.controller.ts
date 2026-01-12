import { Controller, Get, Param, Query, UseGuards, Res, Header, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getAuditLogs(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.auditService.getAuditLogs({
      entity,
      entityId,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      startDate,
      endDate,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  async getAuditLogById(@Param('id') id: string) {
    return this.auditService.getAuditLogById(id);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export audit logs as CSV with integrity hash' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportAuditLogsCsv(
    @Req() req: Request,
    @Res() res: Response,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || 'unknown';
    const result = await this.auditService.exportAuditLogs({
      entity,
      entityId,
      startDate,
      endDate,
      format: 'csv',
      requestIp: ip,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    res.setHeader('X-Integrity-Hash', result.hash);
    res.setHeader('X-Generated-At', result.metadata.generatedAt);
    res.setHeader('X-Generated-By', result.metadata.generatedBy);
    res.setHeader('X-Record-Count', result.metadata.recordCount.toString());
    res.send(result.content);
  }

  @Get('export/json')
  @ApiOperation({ summary: 'Export audit logs as JSON with integrity hash' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportAuditLogsJson(
    @Req() req: Request,
    @Res() res: Response,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || 'unknown';
    const result = await this.auditService.exportAuditLogs({
      entity,
      entityId,
      startDate,
      endDate,
      format: 'json',
      requestIp: ip,
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('X-Integrity-Hash', result.hash);
    res.setHeader('X-Generated-At', result.metadata.generatedAt);
    res.setHeader('X-Generated-By', result.metadata.generatedBy);
    res.setHeader('X-Record-Count', result.metadata.recordCount.toString());
    res.send(result.content);
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Export audit logs as PDF with integrity hash' })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportAuditLogsPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || req.connection.remoteAddress || 'unknown';
    const result = await this.auditService.exportAuditLogs({
      entity,
      entityId,
      startDate,
      endDate,
      format: 'pdf',
      requestIp: ip,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('X-Integrity-Hash', result.hash);
    res.setHeader('X-Generated-At', result.metadata.generatedAt);
    res.setHeader('X-Generated-By', result.metadata.generatedBy);
    res.setHeader('X-Record-Count', result.metadata.recordCount.toString());
    res.send(result.content);
  }
}
