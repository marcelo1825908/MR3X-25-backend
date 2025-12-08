import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PlanEnforcementService, PLAN_MESSAGES } from '../plans/plan-enforcement.service';
import { TokenGeneratorService, TokenEntityType } from '../common/services/token-generator.service';
import { CreateUserDto, UpdateUserDto, CreateTenantDto, UpdateTenantDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

/**
 * Role Creation Hierarchy - Who can create which roles
 * Based on MR3X Complete Hierarchy Requirements:
 *
 * IMPORTANT: Two types of Managers exist:
 * 1. PLATFORM_MANAGER - MR3X Internal Manager (created by ADMIN)
 *    - Works for MR3X internally
 *    - Handles support, statistics, client assistance
 *    - Has ZERO access to agency operations
 *
 * 2. AGENCY_MANAGER - Agency Manager/Gestor (created by AGENCY_ADMIN)
 *    - Works inside a real estate agency
 *    - Controls agency team, creates brokers, owners, contracts, properties
 *    - Has legal representation permissions for the agency
 *
 * CEO -> ADMIN only
 * ADMIN -> PLATFORM_MANAGER, LEGAL_AUDITOR, REPRESENTATIVE, API_CLIENT (NO AGENCY_MANAGER!)
 * PLATFORM_MANAGER -> NONE (support role only)
 * AGENCY_ADMIN -> AGENCY_MANAGER, BROKER, PROPRIETARIO
 * AGENCY_MANAGER -> BROKER, PROPRIETARIO
 * BROKER -> NONE (cannot create users)
 * PROPRIETARIO -> NONE (cannot create users)
 * INDEPENDENT_OWNER -> INQUILINO, BUILDING_MANAGER
 * INQUILINO -> NONE
 * BUILDING_MANAGER -> NONE
 * LEGAL_AUDITOR -> NONE
 * REPRESENTATIVE -> NONE
 * API_CLIENT -> NONE
 */
const ROLE_CREATION_ALLOWED: Record<UserRole, UserRole[]> = {
  [UserRole.CEO]: [UserRole.ADMIN],
  [UserRole.ADMIN]: [UserRole.PLATFORM_MANAGER, UserRole.LEGAL_AUDITOR, UserRole.REPRESENTATIVE, UserRole.API_CLIENT],
  [UserRole.PLATFORM_MANAGER]: [], // MR3X Internal Manager - support only, cannot create users
  [UserRole.AGENCY_ADMIN]: [UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO],
  [UserRole.AGENCY_MANAGER]: [UserRole.BROKER, UserRole.PROPRIETARIO],
  [UserRole.BROKER]: [], // Cannot create users
  [UserRole.PROPRIETARIO]: [], // Cannot create users
  [UserRole.INDEPENDENT_OWNER]: [UserRole.INQUILINO, UserRole.BUILDING_MANAGER],
  [UserRole.INQUILINO]: [],
  [UserRole.BUILDING_MANAGER]: [],
  [UserRole.LEGAL_AUDITOR]: [],
  [UserRole.REPRESENTATIVE]: [],
  [UserRole.API_CLIENT]: [],
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
    private planEnforcement: PlanEnforcementService,
    private tokenGenerator: TokenGeneratorService,
  ) {}

  /**
   * Validates if a creator role can create a target role
   */
  validateRoleCreation(creatorRole: UserRole, targetRole: UserRole): void {
    const allowedRoles = ROLE_CREATION_ALLOWED[creatorRole] || [];
    if (!allowedRoles.includes(targetRole)) {
      throw new ForbiddenException(
        `Usuário com função ${creatorRole} não pode criar usuários com função ${targetRole}. ` +
        `Funções permitidas: ${allowedRoles.length > 0 ? allowedRoles.join(', ') : 'nenhuma'}`
      );
    }
  }

  /**
   * Gets the list of roles a creator can create
   */
  getAllowedRolesToCreate(creatorRole: UserRole): UserRole[] {
    return ROLE_CREATION_ALLOWED[creatorRole] || [];
  }

  /**
   * Generates a random password with 8 characters
   */
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    role?: UserRole;
    agencyId?: string;
    status?: string;
    createdById?: string;
  }) {
    const { skip = 0, take = 10, role, agencyId, status, createdById } = params;

    const where: any = {};
    if (role) where.role = role;
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;
    if (createdById) where.createdBy = BigInt(createdById);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          status: true,
          phone: true,
          document: true,
          address: true,
          neighborhood: true,
          city: true,
          state: true,
          cep: true,
          agencyId: true,
          createdAt: true,
          lastLogin: true,
          isFrozen: true,
          frozenAt: true,
          frozenReason: true,
          agency: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(u => ({
        ...u,
        id: u.id.toString(),
        agencyId: u.agencyId?.toString(),
        frozenAt: u.frozenAt?.toISOString() || null,
        agency: u.agency ? { ...u.agency, id: u.agency.id.toString() } : null,
      })),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      include: {
        agency: true,
        company: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password: _, ...result } = user;
    return {
      ...result,
      id: result.id.toString(),
      agencyId: result.agencyId?.toString(),
      companyId: result.companyId?.toString(),
      ownerId: result.ownerId?.toString(),
      brokerId: result.brokerId?.toString(),
      createdBy: result.createdBy?.toString(),
      legalRepresentativeId: result.legalRepresentativeId?.toString(),
      plainPassword: result.plainPassword,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(dto: CreateUserDto, creatorId?: string, creatorRole?: UserRole) {
    // Validate role creation hierarchy if creator role is provided
    if (creatorRole && dto.role) {
      this.validateRoleCreation(creatorRole, dto.role as UserRole);
    }

    // Check plan limits for INDEPENDENT_OWNER creating INQUILINO (tenant)
    if (creatorId && creatorRole === UserRole.INDEPENDENT_OWNER && dto.role === 'INQUILINO') {
      const planCheck = await this.plansService.checkPlanLimits(creatorId, 'user');
      if (!planCheck.allowed) {
        throw new ForbiddenException(planCheck.message || 'Você atingiu o limite de inquilinos do seu plano.');
      }
    }

    // Check agency plan limits if agencyId is provided
    if (dto.agencyId) {
      const agencyCheck = await this.planEnforcement.checkUserOperationAllowed(
        dto.agencyId,
        'create',
      );
      if (!agencyCheck.allowed) {
        throw new ForbiddenException(agencyCheck.message || 'A agência atingiu o limite de usuários do plano.');
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Generate a random password if not provided or if empty
    const plainPassword = dto.password && dto.password.length >= 6
      ? dto.password
      : this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // For BROKER role, get the agencyId from the creator (manager)
    let finalAgencyId: bigint | null = dto.agencyId ? BigInt(dto.agencyId) : null;

    if (dto.role === 'BROKER' && dto.managerId && !finalAgencyId) {
      // Get manager's agencyId
      const manager = await this.prisma.user.findUnique({
        where: { id: BigInt(dto.managerId) },
        select: { agencyId: true },
      });
      finalAgencyId = manager?.agencyId ?? null;
    }

    // Set ownerId when INDEPENDENT_OWNER creates a tenant (for plan limit tracking)
    let ownerId: bigint | null = null;
    if (creatorRole === UserRole.INDEPENDENT_OWNER && dto.role === 'INQUILINO' && creatorId) {
      ownerId = BigInt(creatorId);
    }

    // Generate MR3X token for INQUILINO (tenants) and PROPRIETARIO/INDEPENDENT_OWNER (owners)
    let token: string | null = null;
    if (dto.role === 'INQUILINO') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.TENANT);
    } else if (dto.role === 'PROPRIETARIO' || dto.role === 'INDEPENDENT_OWNER') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.OWNER);
    }

    const user = await this.prisma.user.create({
      data: {
        token,
        email: dto.email,
        password: hashedPassword,
        plainPassword: plainPassword,
        name: dto.name,
        role: dto.role,
        plan: dto.plan || 'FREE',
        phone: dto.phone,
        document: dto.document,
        agencyId: finalAgencyId,
        companyId: dto.companyId ? BigInt(dto.companyId) : null,
        createdBy: creatorId ? BigInt(creatorId) : null,
        ownerId: ownerId,
        address: dto.address,
        cep: dto.cep,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        brokerId: dto.managerId ? BigInt(dto.managerId) : null,
        status: 'ACTIVE',
      },
    });

    const { password: _, ...result } = user;
    return {
      ...result,
      id: result.id.toString(),
      agencyId: result.agencyId?.toString() || null,
      companyId: result.companyId?.toString() || null,
      brokerId: result.brokerId?.toString() || null,
      createdBy: result.createdBy?.toString() || null,
      ownerId: result.ownerId?.toString() || null,
      birthDate: result.birthDate?.toISOString() || null,
      createdAt: result.createdAt?.toISOString() || null,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        isFrozen: true,
        frozenReason: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is frozen
    if (user.isFrozen) {
      throw new ForbiddenException(
        user.frozenReason || PLAN_MESSAGES.EDIT_FROZEN_USER
      );
    }

    const updateData: any = {};

    // Only update fields that are provided
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.document !== undefined) updateData.document = dto.document;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.plan !== undefined) updateData.plan = dto.plan;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.cep !== undefined) updateData.cep = dto.cep;
    if (dto.neighborhood !== undefined) updateData.neighborhood = dto.neighborhood;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.birthDate !== undefined) {
      updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.status !== undefined) updateData.status = dto.status;

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
      updateData.plainPassword = dto.password;
    }

    if (dto.agencyId !== undefined) {
      updateData.agencyId = dto.agencyId ? BigInt(dto.agencyId) : null;
    }

    if (dto.companyId !== undefined) {
      updateData.companyId = dto.companyId ? BigInt(dto.companyId) : null;
    }

    if (dto.managerId !== undefined) {
      updateData.brokerId = dto.managerId ? BigInt(dto.managerId) : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const { password: _, ...result } = updated;
    return {
      ...result,
      id: result.id.toString(),
      agencyId: result.agencyId?.toString() || null,
      companyId: result.companyId?.toString() || null,
      brokerId: result.brokerId?.toString() || null,
      createdBy: result.createdBy?.toString() || null,
      ownerId: result.ownerId?.toString() || null,
      birthDate: result.birthDate?.toISOString() || null,
      createdAt: result.createdAt?.toISOString() || null,
    };
  }

  async updateStatus(id: string, status: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    return {
      id: updated.id.toString(),
      status: updated.status,
    };
  }

  async remove(id: string, deleterId?: string, deleterRole?: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        role: true,
        agencyId: true,
        createdBy: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate deletion permissions based on role hierarchy
    if (deleterRole && deleterId) {
      const userRole = user.role as string;

      // CEO can delete anyone
      if (deleterRole === UserRole.CEO) {
        // OK - CEO has full access
      }
      // ADMIN can delete users they created or PLATFORM_MANAGER, LEGAL_AUDITOR, REPRESENTATIVE, API_CLIENT
      else if (deleterRole === UserRole.ADMIN) {
        const allowedRoles = ['PLATFORM_MANAGER', 'LEGAL_AUDITOR', 'REPRESENTATIVE', 'API_CLIENT'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
      }
      // AGENCY_ADMIN can delete AGENCY_MANAGER, BROKER, PROPRIETARIO in their agency
      else if (deleterRole === UserRole.AGENCY_ADMIN) {
        const allowedRoles = ['AGENCY_MANAGER', 'BROKER', 'PROPRIETARIO'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
        // Check same agency
        const deleter = await this.prisma.user.findUnique({
          where: { id: BigInt(deleterId) },
          select: { agencyId: true },
        });
        if (!deleter?.agencyId || !user.agencyId || deleter.agencyId !== user.agencyId) {
          throw new ForbiddenException('Você só pode excluir usuários da sua própria agência.');
        }
      }
      // AGENCY_MANAGER can delete BROKER, PROPRIETARIO in their agency
      else if (deleterRole === UserRole.AGENCY_MANAGER) {
        const allowedRoles = ['BROKER', 'PROPRIETARIO'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
        // Check same agency
        const deleter = await this.prisma.user.findUnique({
          where: { id: BigInt(deleterId) },
          select: { agencyId: true },
        });
        if (!deleter?.agencyId || !user.agencyId || deleter.agencyId !== user.agencyId) {
          throw new ForbiddenException('Você só pode excluir usuários da sua própria agência.');
        }
      }
      else {
        throw new ForbiddenException('Você não tem permissão para excluir usuários.');
      }
    }

    // Delete related records before deleting the user
    await this.prisma.$transaction(async (tx) => {
      const userBigInt = BigInt(id);

      // Delete refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: userBigInt },
      });

      // Delete notifications where user is owner or tenant
      await tx.notification.deleteMany({
        where: {
          OR: [
            { tenantId: userBigInt },
            { ownerId: userBigInt },
          ],
        },
      });

      // Find all chats where user is a participant
      const userChats = await tx.chat.findMany({
        where: {
          OR: [
            { participant1Id: userBigInt },
            { participant2Id: userBigInt },
          ],
        },
        select: { id: true },
      });
      const chatIds = userChats.map(c => c.id);

      if (chatIds.length > 0) {
        // Delete ALL active chats for these chats (both participants)
        await tx.activeChat.deleteMany({
          where: { chatId: { in: chatIds } },
        });

        // Delete ALL messages in these chats
        await tx.message.deleteMany({
          where: { chatId: { in: chatIds } },
        });

        // Now delete the chats
        await tx.chat.deleteMany({
          where: { id: { in: chatIds } },
        });
      }

      // Delete any remaining messages where user is sender/receiver (not in a chat)
      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: userBigInt },
            { receiverId: userBigInt },
          ],
        },
      });

      // Delete audit logs
      await tx.auditLog.deleteMany({
        where: { userId: userBigInt },
      });

      // Nullify user references in properties (broker, creator, tenant)
      await tx.property.updateMany({
        where: { brokerId: userBigInt },
        data: { brokerId: null },
      });
      await tx.property.updateMany({
        where: { createdBy: userBigInt },
        data: { createdBy: null },
      });
      await tx.property.updateMany({
        where: { tenantId: userBigInt },
        data: { tenantId: null },
      });

      // Nullify user references in other users (broker, creator, owner)
      await tx.user.updateMany({
        where: { brokerId: userBigInt },
        data: { brokerId: null },
      });
      await tx.user.updateMany({
        where: { createdBy: userBigInt },
        data: { createdBy: null },
      });
      await tx.user.updateMany({
        where: { ownerId: userBigInt },
        data: { ownerId: null },
      });

      // Finally delete the user
      await tx.user.delete({
        where: { id: userBigInt },
      });
    });

    return { message: 'User deleted successfully' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async validateDocument(document: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { document },
    });

    return {
      isAvailable: !existingUser,
      message: existingUser ? 'Document already registered' : 'Document is available',
    };
  }

  async getTenantsByScope(scope: { ownerId?: string; agencyId?: string; brokerId?: string; managerId?: string; createdById?: string }) {
    try {
      console.log('[UsersService.getTenantsByScope] Scope:', JSON.stringify(scope, null, 2));

      // If no scope is provided (CEO), return all tenants
      if (!scope.ownerId && !scope.agencyId && !scope.brokerId && !scope.managerId && !scope.createdById) {
        const tenants = await this.prisma.user.findMany({
          where: { role: UserRole.INQUILINO },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            document: true,
            birthDate: true,
            address: true,
            cep: true,
            neighborhood: true,
            city: true,
            state: true,
            createdAt: true,
          },
        });

        return tenants.map(tenant => ({
          ...tenant,
          id: tenant.id.toString(),
          birthDate: tenant.birthDate?.toISOString() || null,
          createdAt: tenant.createdAt?.toISOString() || null,
        }));
      }

    let where: any = { role: UserRole.INQUILINO };

    // ADMIN: sees only tenants they created (each admin is independent)
    if (scope.createdById) {
      where.createdBy = BigInt(scope.createdById);
      console.log('[UsersService.getTenantsByScope] Filtering by createdBy:', scope.createdById);
    }

    // Owner sees only own tenants
    if (scope.ownerId) {
      where.ownerId = BigInt(scope.ownerId);
    }

    // AGENCY_ADMIN: sees all tenants in their agency
    if (scope.agencyId && !scope.ownerId && !scope.managerId && !scope.brokerId && !scope.createdById) {
      where.agencyId = BigInt(scope.agencyId);
    }

    // BROKER: sees only tenants created by themselves
    if (scope.brokerId) {
      where.createdBy = BigInt(scope.brokerId);
    }

    // AGENCY_MANAGER: sees tenants in their agency
    // This includes:
    // 1. Tenants created by the manager themselves
    // 2. Tenants created by brokers in their agency
    // 3. Tenants created by ADMIN/CEO that belong to the same agency
    if (scope.managerId) {
      // Find all brokers in the same agency
      const agencyBrokers = await this.prisma.user.findMany({
        where: {
          role: UserRole.BROKER,
          ...(scope.agencyId ? { agencyId: BigInt(scope.agencyId) } : {}),
        },
        select: { id: true },
      });

      const agencyBrokerIds = agencyBrokers.map(b => b.id);

      // Manager sees all tenants in their agency
      if (scope.agencyId) {
        // If manager has an agencyId, show all tenants in that agency
        where = {
          AND: [
            { role: UserRole.INQUILINO },
            { agencyId: BigInt(scope.agencyId) },
          ],
        };
      } else {
        // Fallback: only show tenants created by manager or their brokers
        where = {
          AND: [
            { role: UserRole.INQUILINO },
            {
              OR: [
                { createdBy: BigInt(scope.managerId) },
                ...(agencyBrokerIds.length > 0 ? [{ createdBy: { in: agencyBrokerIds } }] : []),
              ],
            },
          ],
        };
      }
    }

    console.log('[UsersService.getTenantsByScope] Final where clause:', JSON.stringify(where, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    const tenants = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        createdAt: true,
        createdBy: true,
      },
    });

      // Log tenant createdBy info for debugging
      console.log('[UsersService.getTenantsByScope] Tenants found:', tenants.map(t => ({
        id: t.id.toString(),
        name: t.name,
        createdBy: t.createdBy?.toString() || 'null'
      })));

      // Serialize BigInt fields
      const result = tenants.map(tenant => {
        const { createdBy, ...rest } = tenant;
        return {
          ...rest,
          id: tenant.id.toString(),
          birthDate: tenant.birthDate?.toISOString() || null,
          createdAt: tenant.createdAt?.toISOString() || null,
        };
      });

      console.log('[UsersService.getTenantsByScope] Result count:', result.length);
      return result;
    } catch (error) {
      console.error('[UsersService.getTenantsByScope] Error:', error);
      console.error('[UsersService.getTenantsByScope] Error stack:', error?.stack);
      throw error;
    }
  }

  async createTenant(requestingUserId: string, dto: CreateTenantDto, requestingUserRole?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Este email já está sendo usado por outro usuário');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Determine the correct agencyId, ownerId, and brokerId based on the requesting user role
    let finalAgencyId: bigint | null = null;
    let finalOwnerId: bigint | null = null;
    let finalBrokerId: bigint | null = null;

    if (requestingUserRole === 'AGENCY_ADMIN') {
      const adminRecord = await this.prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });
      finalAgencyId = adminRecord?.agencyId ?? null;
      finalOwnerId = null;
      finalBrokerId = dto.brokerId ? BigInt(dto.brokerId) : null;
    } else if (requestingUserRole === 'AGENCY_MANAGER') {
      const managerRecord = await this.prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });
      finalAgencyId = managerRecord?.agencyId ?? null;
      finalOwnerId = null;
      finalBrokerId = dto.brokerId ? BigInt(dto.brokerId) : null;
    } else if (requestingUserRole === 'BROKER') {
      const brokerRecord = await this.prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });
      finalOwnerId = null;
      finalAgencyId = brokerRecord?.agencyId ?? null;
      // When broker creates tenant, automatically link the tenant to this broker
      finalBrokerId = BigInt(requestingUserId);
    } else if (requestingUserRole === 'PROPRIETARIO' || requestingUserRole === 'INDEPENDENT_OWNER') {
      finalOwnerId = BigInt(requestingUserId);
      finalAgencyId = null;
    } else {
      finalOwnerId = dto.agencyId ? null : BigInt(requestingUserId);
      finalAgencyId = dto.agencyId ? BigInt(dto.agencyId) : null;
      finalBrokerId = dto.brokerId ? BigInt(dto.brokerId) : null;
    }

    const tenant = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        plainPassword: dto.password,
        name: dto.name,
        role: UserRole.INQUILINO,
        plan: dto.plan || 'FREE',
        phone: dto.phone,
        document: dto.document,
        address: dto.address,
        cep: dto.cep,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        status: 'ACTIVE',
        ownerId: finalOwnerId,
        agencyId: finalAgencyId,
        brokerId: finalBrokerId,
        createdBy: BigInt(requestingUserId),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        createdAt: true,
        createdBy: true,
        agencyId: true,
        brokerId: true,
        plainPassword: true,
      },
    });

    return {
      ...tenant,
      id: tenant.id.toString(),
      agencyId: tenant.agencyId?.toString() || null,
      brokerId: tenant.brokerId?.toString() || null,
      createdBy: tenant.createdBy?.toString() || null,
      birthDate: tenant.birthDate?.toISOString() || null,
      createdAt: tenant.createdAt?.toISOString() || null,
    };
  }

  async updateTenant(requestingUserId: string, tenantId: string, dto: UpdateTenantDto, requestingUserRole?: string) {
    const tenant = await this.prisma.user.findUnique({
      where: { id: BigInt(tenantId) },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.role !== UserRole.INQUILINO) {
      throw new BadRequestException('User is not a tenant');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.password !== undefined && dto.password.length > 0) {
      updateData.password = await bcrypt.hash(dto.password, 10);
      updateData.plainPassword = dto.password;
    }
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.cep !== undefined) updateData.cep = dto.cep;
    if (dto.neighborhood !== undefined) updateData.neighborhood = dto.neighborhood;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.birthDate !== undefined) {
      updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    // Allow Manager/Admin to link broker to tenant
    if (dto.brokerId !== undefined) {
      updateData.brokerId = dto.brokerId ? BigInt(dto.brokerId) : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(tenantId) },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        createdAt: true,
        agencyId: true,
        brokerId: true,
        plainPassword: true,
      },
    });

    return {
      ...updated,
      id: updated.id.toString(),
      agencyId: updated.agencyId?.toString() || null,
      brokerId: updated.brokerId?.toString() || null,
      birthDate: updated.birthDate?.toISOString() || null,
      createdAt: updated.createdAt?.toISOString() || null,
    };
  }

  async deleteTenant(requestingUserId: string, tenantId: string) {
    const tenantBigInt = BigInt(tenantId);

    const tenant = await this.prisma.user.findUnique({
      where: { id: tenantBigInt },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.role !== UserRole.INQUILINO) {
      throw new BadRequestException('User is not a tenant');
    }

    // Check if tenant has active contracts
    const activeContracts = await this.prisma.contract.findFirst({
      where: {
        tenantId: tenantBigInt,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (activeContracts) {
      throw new BadRequestException('Não é possível excluir inquilino com contratos ativos. Cancele ou finalize os contratos primeiro.');
    }

    // Delete related records in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Delete refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: tenantBigInt },
      });

      // Delete notifications where tenant is involved
      await tx.notification.deleteMany({
        where: {
          OR: [
            { tenantId: tenantBigInt },
            { ownerId: tenantBigInt },
          ],
        },
      });

      // Delete active chats
      await tx.activeChat.deleteMany({
        where: { userId: tenantBigInt },
      });

      // Delete messages sent or received by tenant
      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: tenantBigInt },
            { receiverId: tenantBigInt },
          ],
        },
      });

      // Delete chats where tenant is a participant
      await tx.chat.deleteMany({
        where: {
          OR: [
            { participant1Id: tenantBigInt },
            { participant2Id: tenantBigInt },
          ],
        },
      });

      // Delete audit logs for this tenant
      await tx.auditLog.deleteMany({
        where: { userId: tenantBigInt },
      });

      // Nullify tenant references in properties
      await tx.property.updateMany({
        where: { tenantId: tenantBigInt },
        data: { tenantId: null },
      });

      // Delete payments made by tenant
      await tx.payment.deleteMany({
        where: { userId: tenantBigInt },
      });

      // Delete transfers where tenant is the recipient
      await tx.transfer.deleteMany({
        where: { recipientId: tenantBigInt },
      });

      // Delete inspections where tenant is the inspector
      await tx.inspection.deleteMany({
        where: { inspectorId: tenantBigInt },
      });

      // Get inactive/cancelled contracts for this tenant
      const inactiveContracts = await tx.contract.findMany({
        where: {
          tenantId: tenantBigInt,
          status: { notIn: ['ACTIVE', 'PENDING'] },
        },
        select: { id: true },
      });

      const contractIds = inactiveContracts.map(c => c.id);

      if (contractIds.length > 0) {
        // Delete contract audits for these contracts
        await tx.contractAudit.deleteMany({
          where: { contractId: { in: contractIds } },
        });

        // Delete invoices for these contracts
        await tx.invoice.deleteMany({
          where: { contractId: { in: contractIds } },
        });

        // Delete inactive/cancelled contracts
        await tx.contract.deleteMany({
          where: { id: { in: contractIds } },
        });
      }

      // Finally delete the tenant user
      await tx.user.delete({
        where: { id: tenantBigInt },
      });
    });

    return { message: 'Tenant deleted successfully' };
  }
}
