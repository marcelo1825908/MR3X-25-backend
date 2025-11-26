import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/user.dto';
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
  ) {
    return this.usersService.findAll({ skip, take, role, agencyId, status });
  }

  @Get('details')
  @ApiOperation({ summary: 'Get current user details' })
  async getCurrentUser(@CurrentUser('sub') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Get('tenants')
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER, UserRole.AGENCY_ADMIN, UserRole.AGENCY_MANAGER, UserRole.BROKER)
  @ApiOperation({ summary: 'Get tenants based on user scope' })
  async getTenants(@CurrentUser() user: any) {
    try {
      console.log('[UsersController.getTenants] User:', JSON.stringify(user, null, 2));
      
      // CEO and ADMIN see all tenants (no scope filtering)
      if (user?.role === UserRole.CEO || user?.role === UserRole.ADMIN) {
        return await this.usersService.getTenantsByScope({});
      }
      
      const scope: any = {};
      
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

  @Get('document/validate/:document')
  @ApiOperation({ summary: 'Validate if document is available' })
  async validateDocument(@Param('document') document: string) {
    return this.usersService.validateDocument(document);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.CEO, UserRole.ADMIN, UserRole.AGENCY_ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto, @CurrentUser('sub') creatorId: string) {
    return this.usersService.create(dto, creatorId);
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
