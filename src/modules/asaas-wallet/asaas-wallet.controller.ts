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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AsaasWalletService } from './asaas-wallet.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateAsaasWalletDto,
  UpdateAsaasWalletDto,
  LinkAsaasAccountDto,
  VerifyWalletDto,
} from './dto/asaas-wallet.dto';

@ApiTags('Asaas Wallets')
@Controller('asaas-wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AsaasWalletController {
  constructor(private readonly walletService: AsaasWalletService) {}

  @Get()
  @ApiOperation({ summary: 'List Asaas wallets' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async findAll(
    @Query('agencyId') agencyId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @CurrentUser() user?: any,
  ) {
    // Apply role-based filtering
    let effectiveAgencyId = agencyId;
    let effectiveUserId = userId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER' || user?.role === 'PROPRIETARIO') {
      effectiveUserId = user.sub;
    }

    return this.walletService.findAll({
      agencyId: effectiveAgencyId,
      userId: effectiveUserId,
      status,
      skip,
      take,
    });
  }

  @Get('connection-status')
  @ApiOperation({ summary: 'Get Asaas connection status' })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async getConnectionStatus(
    @Query('agencyId') agencyId?: string,
    @Query('userId') userId?: string,
    @CurrentUser() user?: any,
  ) {
    let effectiveAgencyId = agencyId;
    let effectiveUserId = userId;

    if (user?.role === 'AGENCY_ADMIN' || user?.role === 'AGENCY_MANAGER') {
      effectiveAgencyId = user.agencyId?.toString();
    } else if (user?.role === 'INDEPENDENT_OWNER' || user?.role === 'PROPRIETARIO') {
      effectiveUserId = user.sub;
    }

    return this.walletService.getConnectionStatus({
      agencyId: effectiveAgencyId,
      userId: effectiveUserId,
    });
  }

  @Get('subaccounts')
  @ApiOperation({ summary: 'Get Asaas subaccounts (for platform split)' })
  @Roles('CEO', 'ADMIN')
  async getSubaccounts() {
    return this.walletService.getSubaccounts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Asaas wallet by ID' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'PROPRIETARIO')
  async findOne(@Param('id') id: string) {
    return this.walletService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new Asaas wallet' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async create(
    @Body() data: CreateAsaasWalletDto,
    @CurrentUser() user: any,
  ) {
    // Auto-fill agency/user based on role
    if (user?.role === 'AGENCY_ADMIN' && user?.agencyId && !data.agencyId) {
      data.agencyId = Number(user.agencyId);
    } else if (user?.role === 'INDEPENDENT_OWNER' && !data.userId) {
      data.userId = Number(user.sub);
    }

    return this.walletService.create(data, user.sub);
  }

  @Post('link')
  @ApiOperation({ summary: 'Link an existing Asaas account' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async linkAccount(
    @Body() data: LinkAsaasAccountDto,
    @CurrentUser() user: any,
  ) {
    // Auto-fill agency/user based on role
    if (user?.role === 'AGENCY_ADMIN' && user?.agencyId && !data.agencyId) {
      data.agencyId = Number(user.agencyId);
    } else if (user?.role === 'INDEPENDENT_OWNER' && !data.userId) {
      data.userId = Number(user.sub);
    }

    return this.walletService.linkAccount(data, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update Asaas wallet' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateAsaasWalletDto,
  ) {
    return this.walletService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Asaas wallet' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async delete(@Param('id') id: string) {
    return this.walletService.delete(id);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify Asaas wallet' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async verify(
    @Param('id') id: string,
    @Body() data: VerifyWalletDto,
    @CurrentUser() user: any,
  ) {
    return this.walletService.verify(id, data, user.sub);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync wallet with Asaas' })
  @Roles('CEO', 'ADMIN', 'AGENCY_ADMIN', 'INDEPENDENT_OWNER')
  async sync(@Param('id') id: string) {
    return this.walletService.syncWithAsaas(id);
  }
}
