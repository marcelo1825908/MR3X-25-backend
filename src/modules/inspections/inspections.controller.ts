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
  Res,
  Headers,
  Ip,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { InspectionsService } from './inspections.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { CreateInspectionDto, InspectionStatus } from './dto/create-inspection.dto';
import { UpdateInspectionDto, SignInspectionDto, ApproveRejectInspectionDto } from './dto/update-inspection.dto';
import { InspectionPdfService } from './services/inspection-pdf.service';
import { InspectionHashService } from './services/inspection-hash.service';
import { InspectionSignatureService, SignatureData } from './services/inspection-signature.service';
import { InspectionSignatureLinkService } from './services/inspection-signature-link.service';

@ApiTags('Inspections')
@Controller('inspections')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class InspectionsController {
  constructor(
    private readonly inspectionsService: InspectionsService,
    private readonly pdfService: InspectionPdfService,
    private readonly hashService: InspectionHashService,
    private readonly signatureService: InspectionSignatureService,
    private readonly signatureLinkService: InspectionSignatureLinkService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all inspections' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'propertyId', required: false, type: String })
  @ApiQuery({ name: 'contractId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'inspectorId', required: false, type: String })
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
    @Query('inspectorId') inspectorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: any,
  ) {
    // Data isolation based on role
    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;

    if (user?.role === 'CEO') {
      // CEO sees all - no filtering
    } else if (user?.role === 'ADMIN') {
      // ADMIN sees only inspections they created
      createdById = user.sub;
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER sees only their own inspections
      createdById = user.sub;
    } else if (user?.agencyId) {
      // Agency users see only their agency's inspections
      effectiveAgencyId = user.agencyId;
    } else {
      // For any other role without agency, only show their own created inspections
      createdById = user?.sub;
    }

    return this.inspectionsService.findAll({
      skip,
      take,
      agencyId: effectiveAgencyId,
      propertyId,
      contractId,
      type,
      status,
      inspectorId,
      createdById,
      startDate,
      endDate,
      search,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get inspection statistics' })
  async getStatistics(@CurrentUser() user?: any) {
    let createdById: string | undefined;
    let agencyId: string | undefined;

    if (user?.role === 'CEO') {
      // CEO sees all
    } else if (user?.role === 'ADMIN' || user?.role === 'INDEPENDENT_OWNER') {
      createdById = user.sub;
    } else if (user?.agencyId) {
      agencyId = user.agencyId;
    } else {
      createdById = user?.sub;
    }

    return this.inspectionsService.getStatistics({ agencyId, createdById });
  }

  @Get('templates')
  @ApiOperation({ summary: 'List all inspection templates' })
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

    // Agency users can only see their agency's templates and default templates
    if (user?.agencyId && !agencyId) {
      effectiveAgencyId = user.agencyId;
    }

    return this.inspectionsService.findAllTemplates({
      agencyId: effectiveAgencyId,
      type,
      isDefault: isDefault === 'true' ? true : isDefault === 'false' ? false : undefined,
    });
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get template by ID' })
  async findOneTemplate(@Param('id') id: string) {
    return this.inspectionsService.findOneTemplate(id);
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a new inspection template' })
  @OwnerPermission('inspections', OwnerAction.CREATE)
  async createTemplate(@Body() data: any, @CurrentUser('sub') userId: string) {
    return this.inspectionsService.createTemplate(data, userId);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update inspection template' })
  @OwnerPermission('inspections', OwnerAction.EDIT)
  async updateTemplate(@Param('id') id: string, @Body() data: any) {
    return this.inspectionsService.updateTemplate(id, data);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Delete inspection template' })
  @OwnerPermission('inspections', OwnerAction.DELETE)
  async removeTemplate(@Param('id') id: string) {
    return this.inspectionsService.removeTemplate(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inspection by ID' })
  async findOne(@Param('id') id: string) {
    return this.inspectionsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new inspection' })
  @OwnerPermission('inspections', OwnerAction.CREATE)
  async create(
    @Body() data: CreateInspectionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.create(data, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update inspection' })
  @OwnerPermission('inspections', OwnerAction.EDIT)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateInspectionDto,
  ) {
    return this.inspectionsService.update(id, data);
  }

  @Patch(':id/sign')
  @ApiOperation({ summary: 'Sign inspection' })
  @OwnerPermission('inspections', OwnerAction.SIGN)
  async sign(
    @Param('id') id: string,
    @Body() data: SignInspectionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.sign(id, data, userId);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve inspection' })
  @OwnerPermission('inspections', OwnerAction.APPROVE)
  async approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject inspection' })
  @OwnerPermission('inspections', OwnerAction.APPROVE)
  async reject(
    @Param('id') id: string,
    @Body() data: ApproveRejectInspectionDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.inspectionsService.reject(id, userId, data);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update inspection status' })
  @OwnerPermission('inspections', OwnerAction.EDIT)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: InspectionStatus,
  ) {
    return this.inspectionsService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete inspection' })
  @OwnerPermission('inspections', OwnerAction.DELETE)
  async remove(@Param('id') id: string) {
    return this.inspectionsService.remove(id);
  }

  // ==================== PDF Generation ====================

  @Get(':id/pdf/provisional')
  @ApiOperation({ summary: 'Generate provisional PDF (with watermark)' })
  async generateProvisionalPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateProvisionalPdf(BigInt(id));

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vistoria-provisoria-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get(':id/pdf/final')
  @ApiOperation({ summary: 'Generate final PDF (with all signatures)' })
  async generateFinalPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.generateFinalPdf(BigInt(id));

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vistoria-final-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get(':id/pdf/download/:type')
  @ApiOperation({ summary: 'Download stored PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Param('type') type: 'provisional' | 'final',
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.pdfService.getStoredPdf(BigInt(id), type);

    if (!pdfBuffer) {
      res.status(404).json({ message: 'PDF nao encontrado. Gere o PDF primeiro.' });
      return;
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vistoria-${type}-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  // ==================== Electronic Signature ====================

  @Post(':id/sign/:signerType')
  @ApiOperation({ summary: 'Sign inspection with electronic signature' })
  @OwnerPermission('inspections', OwnerAction.SIGN)
  async signInspection(
    @Param('id') id: string,
    @Param('signerType') signerType: 'tenant' | 'owner' | 'agency' | 'inspector',
    @Body() signatureData: SignatureData,
    @CurrentUser('sub') userId: string,
    @Ip() clientIP: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.signatureService.signInspection(
      id,
      signerType,
      {
        ...signatureData,
        clientIP,
        userAgent,
      },
      userId,
    );
  }

  @Get(':id/signature-status')
  @ApiOperation({ summary: 'Get signature status for inspection' })
  async getSignatureStatus(@Param('id') id: string) {
    return this.signatureService.getSignatureStatus(id);
  }

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Finalize inspection after all signatures' })
  @OwnerPermission('inspections', OwnerAction.APPROVE)
  async finalizeInspection(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    await this.signatureService.finalizeInspection(id, userId);
    return { message: 'Vistoria finalizada com sucesso' };
  }

  // ==================== Signature Links ====================

  @Post(':id/signature-links')
  @ApiOperation({ summary: 'Create signature invitation links' })
  @OwnerPermission('inspections', OwnerAction.EDIT)
  async createSignatureLinks(
    @Param('id') id: string,
    @Body() body: {
      parties: Array<{
        signerType: 'tenant' | 'owner' | 'agency' | 'inspector';
        email: string;
        name?: string;
      }>;
      expiresInHours?: number;
    },
  ) {
    return this.signatureLinkService.createSignatureLinksForInspection(
      BigInt(id),
      body.parties,
      body.expiresInHours,
    );
  }

  @Get(':id/signature-links')
  @ApiOperation({ summary: 'Get all signature links for inspection' })
  async getSignatureLinks(@Param('id') id: string) {
    return this.signatureLinkService.getInspectionSignatureLinks(BigInt(id));
  }

  @Delete(':id/signature-links')
  @ApiOperation({ summary: 'Revoke all signature links for inspection' })
  @OwnerPermission('inspections', OwnerAction.EDIT)
  async revokeAllSignatureLinks(@Param('id') id: string) {
    await this.signatureLinkService.revokeAllInspectionLinks(BigInt(id));
    return { message: 'Todos os links de assinatura foram revogados' };
  }

  // ==================== Audit Log ====================

  @Get(':id/audit-log')
  @ApiOperation({ summary: 'Get audit log for inspection' })
  async getAuditLog(@Param('id') id: string) {
    return this.signatureService.getAuditLog(id);
  }
}
