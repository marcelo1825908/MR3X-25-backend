import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
    } else {
      // For any other role without agency, only show their own created contracts
      createdById = user?.sub;
    }

    return this.contractsService.findAll({ skip, take, agencyId: effectiveAgencyId, status, createdById });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  async create(@Body() data: any, @CurrentUser('sub') userId: string) {
    return this.contractsService.create(data, userId);
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
}
