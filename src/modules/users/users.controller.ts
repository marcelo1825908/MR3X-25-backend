import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, CreateTenantDto, UpdateTenantDto, UpdateProfileDto } from './dto/user.dto';
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


  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMyProfile(@CurrentUser('sub') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMyProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/photo')
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(@CurrentUser('sub') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.uploadProfilePhoto(userId, file);
  }

  @Delete('me/photo')
  @ApiOperation({ summary: 'Delete profile photo' })
  async deletePhoto(@CurrentUser('sub') userId: string) {
    return this.usersService.deleteProfilePhoto(userId);
  }

  @Post('me/change-password')
  @ApiOperation({ summary: 'Change current user password' })
  async changeMyPassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }


  @Get()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.BROKER)
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'plan', required: false })
  @ApiQuery({ name: 'excludeCurrentUser', required: false })
  @ApiQuery({ name: 'excludeFrozen', required: false, description: 'Exclude frozen users from results' })
  @ApiQuery({ name: 'createdById', required: false, description: 'Filter by creator user id' })
  @ApiQuery({ name: 'roles', required: false, description: 'Comma-separated list of roles' })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('excludeCurrentUser') excludeCurrentUser?: string,
    @Query('excludeFrozen') excludeFrozen?: string,
    @Query('createdById') createdByIdParam?: string,
    @Query('roles') rolesParam?: string,
    @CurrentUser() user?: any,
  ) {
    let createdById: string | undefined = createdByIdParam;
    let finalAgencyId: string | undefined = agencyId;
    const roles = rolesParam ? rolesParam.split(',').filter(Boolean) : undefined;

    if (user?.role === UserRole.ADMIN) {
      if (role === UserRole.AGENCY_ADMIN || role === UserRole.INDEPENDENT_OWNER) {
        createdById = undefined;
      } else {
        createdById = user.sub;
      }
    } else if (user?.role === UserRole.AGENCY_ADMIN || user?.role === UserRole.AGENCY_MANAGER) {
      if (user.agencyId) {
        finalAgencyId = user.agencyId.toString();
      }
      console.log('[findAll] AGENCY user:', user.role, 'agencyId:', user.agencyId, 'finalAgencyId:', finalAgencyId);
    } else if (user?.role === UserRole.BROKER) {
      createdById = user.sub;
    } else if (user?.role === UserRole.PROPRIETARIO || user?.role === UserRole.INDEPENDENT_OWNER) {
      createdById = user.sub;
    }

    const excludeUserId = excludeCurrentUser === 'true' ? user.sub : undefined;

    const shouldExcludeFrozen = excludeFrozen === 'true';

    return this.usersService.findAll({ skip, take, search, role, roles, agencyId: finalAgencyId, status, plan, createdById, excludeUserId, excludeFrozen: shouldExcludeFrozen });
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

  @Get('owners')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Get owners for the agency' })
  async getOwners(@CurrentUser() user: any) {
    if (!user?.agencyId) {
      return [];
    }
    return this.usersService.getOwnersByAgency(user.agencyId.toString());
  }

  @Patch('owners/:ownerId/fee')
  @Roles(UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Update owner fee percentage' })
  async updateOwnerFee(
    @Param('ownerId') ownerId: string,
    @Body('ownerFee') ownerFee: number,
    @CurrentUser() user: any
  ) {
    if (!user?.agencyId) {
      throw new Error('Agência não encontrada');
    }
    return this.usersService.updateOwnerFee(ownerId, ownerFee, user.agencyId.toString());
  }

  @Get('tenants')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get tenants based on user scope' })
  async getTenants(@CurrentUser() user: any, @Query('search') search?: string) {
    try {
      console.log('[UsersController.getTenants] User:', JSON.stringify(user, null, 2));
      console.log('[UsersController.getTenants] Search:', search);

      const scope: any = {};

      if (user?.role === UserRole.CEO) {
        return await this.usersService.getTenantsByScope({}, search);
      }

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
      return await this.usersService.getTenantsByScope(scope, search);
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

  @Post(':id/photo')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Upload photo for a specific user' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadUserPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.uploadProfilePhoto(id, file);
  }

  @Delete(':id/photo')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Delete photo for a specific user' })
  async deleteUserPhoto(@Param('id') id: string) {
    return this.usersService.deleteProfilePhoto(id);
  }

  @Post()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.INDEPENDENT_OWNER)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
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
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.usersService.updateStatus(id, status, user?.sub, user?.role as UserRole, user?.agencyId?.toString());
  }

  @Delete(':id')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Delete user' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user?.sub, user?.role as UserRole);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
