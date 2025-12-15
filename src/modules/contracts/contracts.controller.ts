import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPermissionGuard } from '../../common/guards/owner-permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnerPermission } from '../../common/decorators/owner-permission.decorator';
import { OwnerAction } from '../../common/constants/owner-permissions.constants';
import { Request, Response } from 'express';
import { SignatureLinkService } from './services/signature-link.service';

interface SignContractDto {
  signature: string;
  signatureType: 'tenant' | 'owner' | 'agency' | 'witness';
  witnessName?: string;
  witnessDocument?: string;
}

interface SignContractWithGeoDto {
  signature: string;
  signatureType: 'tenant' | 'owner' | 'agency' | 'witness';
  geoLat: number;
  geoLng: number;
  geoConsent: boolean;
  witnessName?: string;
  witnessDocument?: string;
}

interface UpdateClausesDto {
  clauses: string;
  changeReason?: string;
}

interface SendInvitationDto {
  signerType: 'tenant' | 'owner' | 'agency' | 'witness';
  signerEmail: string;
  signerName?: string;
  expiresInHours?: number;
}

@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerPermissionGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly signatureLinkService: SignatureLinkService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all contracts' })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: any,
  ) {
    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;
    let userId: string | undefined = user?.sub;
    let userRole: string | undefined = user?.role;

    if (user?.role === 'CEO') {
      // CEO sees all
      userId = undefined;
    } else if (user?.role === 'ADMIN') {
      createdById = user.sub;
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      createdById = user.sub;
    } else if (user?.role === 'INQUILINO' || user?.role === 'PROPRIETARIO' || user?.role === 'BROKER') {
      // Tenant, Owner, Broker - filtered by property/contract relationship in service
    } else if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      // Agency admins/managers see all contracts for their agency
      effectiveAgencyId = user.agencyId;
    } else if (user?.agencyId) {
      effectiveAgencyId = user.agencyId;
    }

    return this.contractsService.findAll({ skip, take, agencyId: effectiveAgencyId, status, createdById, userId, userRole, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  @OwnerPermission('contracts', OwnerAction.CREATE)
  async create(
    @Body() data: any,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const clientIP = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.contractsService.create(
      { ...data, clientIP, userAgent },
      user.sub,
      user.agencyId,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update contract' })
  @OwnerPermission('contracts', OwnerAction.EDIT)
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser('sub') userId: string) {
    return this.contractsService.update(id, data, userId);
  }

  @Get(':id/validate')
  @ApiOperation({ summary: 'Validate contract for required fields' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  async validateContract(@Param('id') id: string) {
    return this.contractsService.validateForSigning(id);
  }

  @Get(':id/immutability')
  @ApiOperation({ summary: 'Get contract immutability status (what operations are allowed)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  async getImmutabilityStatus(@Param('id') id: string) {
    return this.contractsService.getImmutabilityStatus(id);
  }

  @Post(':id/amend')
  @ApiOperation({ summary: 'Create amended contract (when original is signed/immutable)' })
  @ApiParam({ name: 'id', description: 'Original Contract ID' })
  async createAmendedContract(
    @Param('id') id: string,
    @Body() amendments: any,
    @CurrentUser('sub') userId: string,
  ) {
    return this.contractsService.createAmendedContract(id, amendments, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contract' })
  @OwnerPermission('contracts', OwnerAction.DELETE)
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contractsService.remove(id, userId);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign a contract' })
  @OwnerPermission('contracts', OwnerAction.SIGN)
  async signContract(
    @Param('id') id: string,
    @Body() body: SignContractDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    const clientIP = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.contractsService.signContract(
      id,
      body.signatureType,
      {
        signature: body.signature,
        clientIP,
        userAgent,
        witnessName: body.witnessName,
        witnessDocument: body.witnessDocument,
      },
      userId,
    );
  }

  @Get('my-contract/tenant')
  @ApiOperation({ summary: 'Get current tenant contract' })
  async getMyContract(@CurrentUser('sub') userId: string) {
    return this.contractsService.findByTenant(userId);
  }

  @Post(':id/prepare-signing')
  @ApiOperation({ summary: 'Prepare contract for signing (generates provisional PDF)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @OwnerPermission('contracts', OwnerAction.EDIT)
  async prepareForSigning(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.contractsService.prepareForSigning(id, userId);
    return {
      success: true,
      message: 'Contrato preparado para assinatura',
      data: result,
    };
  }

  @Post(':id/sign-with-geo')
  @ApiOperation({ summary: 'Sign contract with geolocation (required)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['signature', 'signatureType', 'geoLat', 'geoLng', 'geoConsent'],
      properties: {
        signature: { type: 'string', description: 'Base64 signature image' },
        signatureType: { type: 'string', enum: ['tenant', 'owner', 'agency', 'witness'] },
        geoLat: { type: 'number', description: 'Latitude' },
        geoLng: { type: 'number', description: 'Longitude' },
        geoConsent: { type: 'boolean', description: 'User consent for geolocation' },
        witnessName: { type: 'string' },
        witnessDocument: { type: 'string' },
      },
    },
  })
  @OwnerPermission('contracts', OwnerAction.SIGN)
  async signContractWithGeo(
    @Param('id') id: string,
    @Body() body: SignContractWithGeoDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    if (!body.geoLat || !body.geoLng) {
      throw new BadRequestException('Geolocalização é obrigatória para assinar o contrato');
    }

    if (!body.geoConsent) {
      throw new BadRequestException('É necessário consentir com o compartilhamento de localização');
    }

    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await this.contractsService.signContractWithGeo(
      id,
      body.signatureType,
      {
        signature: body.signature,
        clientIP,
        userAgent,
        geoLat: body.geoLat,
        geoLng: body.geoLng,
        geoConsent: body.geoConsent,
        witnessName: body.witnessName,
        witnessDocument: body.witnessDocument,
      },
      userId,
    );

    return {
      success: true,
      message: 'Assinatura registrada com sucesso',
      data: result,
    };
  }

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Finalize contract after all parties have signed' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @OwnerPermission('contracts', OwnerAction.APPROVE)
  async finalizeContract(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.contractsService.finalizeContract(id, userId);
    return {
      success: true,
      message: 'Contrato finalizado com sucesso',
      data: result,
    };
  }

  @Get(':id/provisional-pdf')
  @ApiOperation({ summary: 'Download provisional PDF for review' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  async getProvisionalPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.contractsService.getProvisionalPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract-provisional-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  @Get(':id/final-pdf')
  @ApiOperation({ summary: 'Download final signed PDF' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  async getFinalPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.contractsService.getFinalPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract-final-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  @Put(':id/clauses')
  @ApiOperation({ summary: 'Update contract clauses (before signing)' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clauses'],
      properties: {
        clauses: { type: 'string', description: 'HTML content of clauses' },
        changeReason: { type: 'string', description: 'Reason for change' },
      },
    },
  })
  @OwnerPermission('contracts', OwnerAction.EDIT)
  async updateClauses(
    @Param('id') id: string,
    @Body() body: UpdateClausesDto,
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.contractsService.updateClauses(
      id,
      body.clauses,
      userId,
      body.changeReason,
    );
    return {
      success: true,
      message: 'Cláusulas atualizadas com sucesso',
      data: result,
    };
  }

  @Get(':id/clause-history')
  @ApiOperation({ summary: 'Get clause change history' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  async getClauseHistory(@Param('id') id: string) {
    const history = await this.contractsService.getClauseHistory(id);
    return {
      success: true,
      data: history,
    };
  }

  @Post(':id/send-invitation')
  @ApiOperation({ summary: 'Send signature invitation link to a party' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['signerType', 'signerEmail'],
      properties: {
        signerType: { type: 'string', enum: ['tenant', 'owner', 'agency', 'witness'] },
        signerEmail: { type: 'string', format: 'email' },
        signerName: { type: 'string' },
        expiresInHours: { type: 'number', default: 48 },
      },
    },
  })
  @OwnerPermission('contracts', OwnerAction.EDIT)
  async sendInvitation(
    @Param('id') id: string,
    @Body() body: SendInvitationDto,
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.contractsService.createSignatureInvitations(
      id,
      [
        {
          signerType: body.signerType,
          email: body.signerEmail,
          name: body.signerName,
        },
      ],
      userId,
    );

    return {
      success: true,
      message: 'Link de assinatura criado com sucesso',
      data: result[0],
    };
  }

  @Get(':id/signature-links')
  @ApiOperation({ summary: 'Get all signature links for a contract' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  async getSignatureLinks(@Param('id') id: string) {
    const links = await this.signatureLinkService.getContractSignatureLinks(BigInt(id));
    return {
      success: true,
      data: links,
    };
  }

  @Post(':id/revoke-link/:linkToken')
  @ApiOperation({ summary: 'Revoke a specific signature link' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiParam({ name: 'linkToken', description: 'Signature link token' })
  @OwnerPermission('contracts', OwnerAction.DELETE)
  async revokeSignatureLink(
    @Param('linkToken') linkToken: string,
  ) {
    await this.signatureLinkService.revokeSignatureLink(linkToken);
    return {
      success: true,
      message: 'Link de assinatura revogado com sucesso',
    };
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke contract and cancel all pending signatures' })
  @ApiParam({ name: 'id', description: 'Contract ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reason'],
      properties: {
        reason: { type: 'string', description: 'Reason for revoking the contract' },
      },
    },
  })
  @OwnerPermission('contracts', OwnerAction.DELETE)
  async revokeContract(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser('sub') userId: string,
  ) {
    if (!reason) {
      throw new BadRequestException('Motivo da revogação é obrigatório');
    }

    const result = await this.contractsService.revokeContract(id, userId, reason);
    return {
      success: true,
      message: 'Contrato revogado com sucesso',
      data: result,
    };
  }

  @Get('token/:token')
  @ApiOperation({ summary: 'Get contract by verification token' })
  @ApiParam({ name: 'token', description: 'Contract verification token (MR3X-CTR-YEAR-XXXX-XXXX)' })
  async findByToken(@Param('token') token: string) {
    const contract = await this.contractsService.findByToken(token);
    return {
      success: true,
      data: contract,
    };
  }
}
