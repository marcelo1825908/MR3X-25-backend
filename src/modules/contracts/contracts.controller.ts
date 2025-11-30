import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Request } from 'express';

interface SignContractDto {
  signature: string;
  signatureType: 'tenant' | 'owner' | 'agency' | 'witness';
  witnessName?: string;
  witnessDocument?: string;
}

@ApiTags('Contracts')
@Controller('contracts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'List all contracts' })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: any,
  ) {
    // Data isolation based on role:
    // - CEO: sees ALL contracts
    // - ADMIN: sees only contracts for properties they created
    // - INDEPENDENT_OWNER: sees only contracts for properties they created
    // - Agency roles: sees only contracts for their agency's properties

    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;
    let userId: string | undefined;

    if (user?.role === 'CEO') {
      // CEO sees all - no filtering
    } else if (user?.role === 'ADMIN') {
      // ADMIN sees only contracts for properties they created
      createdById = user.sub;
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER sees only their own contracts
      createdById = user.sub;
    } else if (user?.agencyId) {
      // Agency users see only their agency's contracts
      effectiveAgencyId = user.agencyId;
    } else if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      // Agency admins/managers without agencyId - show contracts related to them via properties
      userId = user?.sub;
    } else {
      // For any other role without agency, use userId fallback to find related contracts
      userId = user?.sub;
    }

    return this.contractsService.findAll({ skip, take, agencyId: effectiveAgencyId, status, createdById, userId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
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
  async update(@Param('id') id: string, @Body() data: any) {
    return this.contractsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete contract' })
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contractsService.remove(id, userId);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign a contract' })
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
}
