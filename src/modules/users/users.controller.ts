import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, CreateTenantDto, UpdateTenantDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('role') role?: UserRole,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: any,
  ) {
    // CEO sees all users
    // ADMIN sees:
    //   - All AGENCY_ADMIN users (for "Diretor Agência" page)
    //   - All INDEPENDENT_OWNER users (for "Agências" page)
    //   - Only users they created for other roles
    let createdById: string | undefined;
    if (user?.role === UserRole.ADMIN) {
      // If filtering by AGENCY_ADMIN or INDEPENDENT_OWNER role, ADMIN can see all
      if (role === UserRole.AGENCY_ADMIN || role === UserRole.INDEPENDENT_OWNER) {
        createdById = undefined; // See all users of these roles
      } else {
        createdById = user.sub; // For other roles, only see users they created
      }
    }
    return this.usersService.findAll({ skip, take, role, agencyId, status, createdById });
  }

  @Get('details')
  @ApiOperation({ summary: 'Get current user details' })
  async getCurrentUser(@CurrentUser('sub') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Check if email already exists' })
  @ApiQuery({ name: 'email', required: true })
  async checkEmail(@Query('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    return { exists: !!user };
  }

  @Get('tenants')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get tenants based on user scope' })
  async getTenants(@CurrentUser() user: any) {
    try {
      console.log('[UsersController.getTenants] User:', JSON.stringify(user, null, 2));

      const scope: any = {};

      // CEO sees all tenants (platform-wide view)
      if (user?.role === UserRole.CEO) {
        return await this.usersService.getTenantsByScope({});
      }

      // ADMIN sees only tenants they created (each admin is independent)
      if (user?.role === UserRole.ADMIN) {
        scope.createdById = user.sub;
      }

      if (user?.role === UserRole.PROPRIETARIO || user?.role === UserRole.INDEPENDENT_OWNER) {
        scope.ownerId = user.sub;
      }

      if (user?.role === UserRole.AGENCY_ADMIN) {
        if (user.agencyId) {
          scope.agencyId = user.agencyId;
        } else {
          return [];
        }
      }

      if (user?.role === UserRole.AGENCY_MANAGER) {
        scope.managerId = user.sub;
        if (user.agencyId) {
          scope.agencyId = user.agencyId;
        }
      }

      if (user?.role === UserRole.BROKER) {
        scope.brokerId = user.sub;
        if (user.agencyId) {
          scope.agencyId = user.agencyId;
        }
      }

      console.log('[UsersController.getTenants] Scope:', JSON.stringify(scope, null, 2));
      return await this.usersService.getTenantsByScope(scope);
    } catch (error) {
      console.error('[UsersController.getTenants] Error:', error);
      console.error('[UsersController.getTenants] Error stack:', error?.stack);
      throw error;
    }
  }

  @Post('tenants')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Create a new tenant' })
  async createTenant(@Body() dto: CreateTenantDto, @CurrentUser() user: any) {
    return this.usersService.createTenant(user?.sub, dto, user?.role);
  }

  @Put('tenants/:tenantId')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Update a tenant' })
  async updateTenant(@Param('tenantId') tenantId: string, @Body() dto: UpdateTenantDto, @CurrentUser() user: any) {
    return this.usersService.updateTenant(user?.sub, tenantId, dto, user?.role);
  }

  @Delete('tenants/:tenantId')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Delete a tenant' })
  async deleteTenant(@Param('tenantId') tenantId: string, @CurrentUser() user: any) {
    return this.usersService.deleteTenant(user?.sub, tenantId);
  }

  @Get('document/validate/:document')
  @ApiOperation({ summary: 'Validate if document is available' })
  async validateDocument(@Param('document') document: string) {
    return this.usersService.validateDocument(document);
  }

  @Get('allowed-roles')
  @ApiOperation({ summary: 'Get roles that the current user can create' })
  async getAllowedRoles(@CurrentUser() user: any) {
    if (!user?.role) {
      return { allowedRoles: [] };
    }
    const allowedRoles = this.usersService.getAllowedRolesToCreate(user.role as UserRole);
    return { allowedRoles };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    // Pass creator's role to validate role creation hierarchy
    return this.usersService.create(dto, user?.sub, user?.role as UserRole);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Update user status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.usersService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
