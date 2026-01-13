import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PlanEnforcementService, PLAN_MESSAGES } from '../plans/plan-enforcement.service';
import { TokenGeneratorService, TokenEntityType } from '../common/services/token-generator.service';
import { CreateUserDto, UpdateUserDto, CreateTenantDto, UpdateTenantDto, UpdateProfileDto } from './dto/user.dto';
import { DocumentValidationService } from './services/document-validation.service';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const ROLE_CREATION_ALLOWED: Record<UserRole, UserRole[]> = {
  [UserRole.CEO]: [UserRole.ADMIN],
  [UserRole.ADMIN]: [UserRole.PLATFORM_MANAGER, UserRole.LEGAL_AUDITOR, UserRole.REPRESENTATIVE, UserRole.API_CLIENT],
  [UserRole.PLATFORM_MANAGER]: [],
  [UserRole.AGENCY_ADMIN]: [UserRole.AGENCY_MANAGER, UserRole.BROKER, UserRole.PROPRIETARIO],
  [UserRole.AGENCY_MANAGER]: [UserRole.BROKER, UserRole.PROPRIETARIO],
  [UserRole.BROKER]: [],
  [UserRole.PROPRIETARIO]: [],
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
    private documentValidation: DocumentValidationService,
  ) {}

  validateRoleCreation(creatorRole: UserRole, targetRole: UserRole): void {
    const allowedRoles = ROLE_CREATION_ALLOWED[creatorRole] || [];
    if (!allowedRoles.includes(targetRole)) {
      throw new ForbiddenException(
        `Usuário com função ${creatorRole} não pode criar usuários com função ${targetRole}. ` +
        `Funções permitidas: ${allowedRoles.length > 0 ? allowedRoles.join(', ') : 'nenhuma'}`
      );
    }
  }

  getAllowedRolesToCreate(creatorRole: UserRole): UserRole[] {
    return ROLE_CREATION_ALLOWED[creatorRole] || [];
  }

  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private getTokenTypeForRole(role: string): TokenEntityType | null {
    switch (role) {
      case 'INQUILINO': return TokenEntityType.TENANT;
      case 'PROPRIETARIO':
      case 'INDEPENDENT_OWNER': return TokenEntityType.OWNER;
      case 'BROKER': return TokenEntityType.BROKER;
      case 'AGENCY_MANAGER': return TokenEntityType.MANAGER;
      case 'ADMIN': return TokenEntityType.ADMIN;
      case 'AGENCY_ADMIN': return TokenEntityType.AGENCY_ADMIN;
      case 'CEO': return TokenEntityType.CEO;
      case 'PLATFORM_MANAGER': return TokenEntityType.PLATFORM_MANAGER;
      case 'BUILDING_MANAGER': return TokenEntityType.BUILDING_MANAGER;
      case 'LEGAL_AUDITOR': return TokenEntityType.LEGAL_AUDITOR;
      case 'REPRESENTATIVE': return TokenEntityType.REPRESENTATIVE;
      case 'API_CLIENT': return TokenEntityType.API_CLIENT;
      default: return null;
    }
  }

  async ensureUserHasToken(userId: bigint, role: string): Promise<string | null> {
    const tokenType = this.getTokenTypeForRole(role);
    if (!tokenType) return null;

    const token = await this.tokenGenerator.generateToken(tokenType);
    await this.prisma.user.update({
      where: { id: userId },
      data: { token },
    });
    return token;
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    search?: string;
    role?: UserRole;
    roles?: string[];
    agencyId?: string;
    status?: string;
    plan?: string;
    createdById?: string;
    excludeUserId?: string;
    excludeFrozen?: boolean;
  }) {
    const { skip = 0, take = 10, search, role, roles, agencyId, status, plan, createdById, excludeUserId, excludeFrozen } = params;

    const where: any = {};
    if (role) where.role = role;
    if (roles && roles.length > 0) where.role = { in: roles };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (createdById) where.createdBy = BigInt(createdById);
    if (excludeUserId) where.id = { not: BigInt(excludeUserId) };

    console.log('[UsersService.findAll] Query params:', { skip, take, search, role, agencyId, status, plan, createdById, excludeUserId });
    console.log('[UsersService.findAll] Where clause:', JSON.stringify(where, (key, value) => typeof value === 'bigint' ? value.toString() : value));

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { email: { contains: search.trim() } },
        { document: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          token: true,
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
          photoUrl: true,
          agencyId: true,
          createdBy: true,
          createdAt: true,
          lastLogin: true,
          isFrozen: true,
          frozenAt: true,
          frozenReason: true,
          bankName: true,
          bankBranch: true,
          bankAccount: true,
          pixKey: true,
          creci: true,
          agency: {
            // include plan so we can surface the current agency subscription
            select: { id: true, name: true, plan: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Generate tokens for users who don't have them
    const usersWithTokens = await Promise.all(
      users.map(async (u) => {
        let token = u.token;
        if (!token) {
          token = await this.ensureUserHasToken(u.id, u.role);
        }
        // Prefer the agency's current plan when available to avoid stale or default "FREE" user plans
        const resolvedPlan = u.agency?.plan || u.plan || 'FREE';

        return {
          ...u,
          plan: resolvedPlan,
          token,
          id: u.id.toString(),
          agencyId: u.agencyId?.toString(),
          createdBy: u.createdBy?.toString() || null,
          frozenAt: u.frozenAt?.toISOString() || null,
          agency: u.agency ? { ...u.agency, id: u.agency.id.toString() } : null,
        };
      })
    );

    return {
      data: usersWithTokens,
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
        ownedProperties: {
          where: { deleted: false },
          select: { id: true, name: true, address: true },
          take: 10,
        },
        contracts: {
          where: { deleted: false },
          select: { id: true, status: true },
          take: 10,
        },
        ownerContracts: {
          where: { deleted: false },
          select: { id: true, status: true },
          take: 10,
        },
        _count: {
          select: {
            ownedProperties: true,
            contracts: true,
            ownerContracts: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For AGENCY_ADMIN or AGENCY_MANAGER, get agency properties and contracts
    let agencyProperties: any[] = [];
    let agencyContracts: any[] = [];
    let agencyPropertyCount = 0;
    let agencyContractCount = 0;

    if (user.agencyId && (user.role === 'AGENCY_ADMIN' || user.role === 'AGENCY_MANAGER')) {
      const [properties, contracts, propertyCount, contractCount] = await Promise.all([
        this.prisma.property.findMany({
          where: { agencyId: user.agencyId, deleted: false },
          select: { id: true, name: true, address: true },
          take: 10,
        }),
        this.prisma.contract.findMany({
          where: { agencyId: user.agencyId, deleted: false },
          select: { id: true, status: true },
          take: 10,
        }),
        this.prisma.property.count({
          where: { agencyId: user.agencyId, deleted: false },
        }),
        this.prisma.contract.count({
          where: { agencyId: user.agencyId, deleted: false },
        }),
      ]);
      agencyProperties = properties;
      agencyContracts = contracts;
      agencyPropertyCount = propertyCount;
      agencyContractCount = contractCount;
    }

    // For PROPRIETARIO or INDEPENDENT_OWNER, use ownedProperties and ownerContracts
    // For AGENCY_ADMIN/AGENCY_MANAGER, use agency properties/contracts
    // For INQUILINO, use contracts (tenant contracts)
    const isAgencyUser = user.role === 'AGENCY_ADMIN' || user.role === 'AGENCY_MANAGER';
    const isTenant = user.role === 'INQUILINO';
    const isOwner = user.role === 'PROPRIETARIO' || user.role === 'INDEPENDENT_OWNER';

    const ownedPropertiesResult = isAgencyUser
      ? agencyProperties.map(p => ({ id: p.id.toString(), name: p.name || p.address }))
      : (user.ownedProperties || []).map(p => ({ id: p.id.toString(), name: p.name || p.address }));

    const contractsResult = isAgencyUser
      ? agencyContracts.map(c => ({ id: c.id.toString(), status: c.status }))
      : isTenant
        ? (user.contracts || []).map(c => ({ id: c.id.toString(), status: c.status }))
        : isOwner
          ? (user.ownerContracts || []).map(c => ({ id: c.id.toString(), status: c.status }))
          : [];

    const propertyCount = isAgencyUser ? agencyPropertyCount : (user._count?.ownedProperties || 0);
    const contractCount = isAgencyUser
      ? agencyContractCount
      : isTenant
        ? (user._count?.contracts || 0)
        : isOwner
          ? (user._count?.ownerContracts || 0)
          : 0;

    // Get recent audit logs
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { userId: BigInt(id) },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        timestamp: true,
        event: true,
        userId: true,
      },
    }).catch(() => []);

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
      ownedProperties: ownedPropertiesResult,
      contracts: contractsResult,
      _count: {
        ownedProperties: propertyCount,
        contracts: contractCount,
      },
      audit: auditLogs.map(log => ({
        timestamp: log.timestamp,
        event: log.event,
        userId: log.userId?.toString(),
      })),
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(dto: CreateUserDto, creatorId?: string, creatorRole?: UserRole) {
    if (creatorRole && dto.role) {
      this.validateRoleCreation(creatorRole, dto.role as UserRole);
    }

    if (creatorId && creatorRole === UserRole.INDEPENDENT_OWNER && dto.role === 'INQUILINO') {
      const planCheck = await this.plansService.checkPlanLimits(creatorId, 'tenant');
      if (!planCheck.allowed) {
        throw new ForbiddenException(planCheck.message || 'Você atingiu o limite de inquilinos do seu plano.');
      }
    }

    if (creatorId && dto.agencyId && dto.role === 'INQUILINO') {
      const planCheck = await this.plansService.checkPlanLimits(creatorId, 'tenant');
      if (!planCheck.allowed) {
        throw new ForbiddenException(planCheck.message || 'Você atingiu o limite de inquilinos do plano da agência.');
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Validate document (CPF or CNPJ) - supports alphanumeric CNPJ from Jan 2026
    if (dto.document) {
      const validation = this.documentValidation.validateDocument(dto.document);
      if (!validation.valid) {
        throw new BadRequestException(validation.message || 'Documento inválido');
      }
      // For CNPJ (especially alphanumeric), require email or SMS confirmation for billing
      if (validation.type === 'CNPJ' && (!dto.email && !dto.phone)) {
        throw new BadRequestException('Para CNPJ, é obrigatório informar email ou telefone para confirmação de cobrança');
      }
    }

    const plainPassword = dto.password && dto.password.length >= 6
      ? dto.password
      : this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    let finalAgencyId: bigint | null = dto.agencyId ? BigInt(dto.agencyId) : null;

    const agencyRolesToInherit = ['BROKER', 'PROPRIETARIO', 'AGENCY_MANAGER'];
    if (!finalAgencyId && creatorId && agencyRolesToInherit.includes(dto.role as string)) {
      const creator = await this.prisma.user.findUnique({
        where: { id: BigInt(creatorId) },
        select: { agencyId: true },
      });
      finalAgencyId = creator?.agencyId ?? null;
    }

    if (dto.role === 'BROKER' && dto.managerId && !finalAgencyId) {
      const manager = await this.prisma.user.findUnique({
        where: { id: BigInt(dto.managerId) },
        select: { agencyId: true },
      });
      finalAgencyId = manager?.agencyId ?? null;
    }

    const agencyUserRoles = ['BROKER', 'PROPRIETARIO', 'AGENCY_MANAGER'];
    if (finalAgencyId && agencyUserRoles.includes(dto.role as string)) {
      const agencyCheck = await this.planEnforcement.checkUserOperationAllowed(
        finalAgencyId.toString(),
        'create',
      );
      if (!agencyCheck.allowed) {
        throw new ForbiddenException(agencyCheck.message || 'A agência atingiu o limite de usuários do plano.');
      }
    }

    let ownerId: bigint | null = null;
    if (creatorRole === UserRole.INDEPENDENT_OWNER && dto.role === 'INQUILINO' && creatorId) {
      ownerId = BigInt(creatorId);
    }

    let token: string | null = null;
    if (dto.role === 'INQUILINO') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.TENANT);
    } else if (dto.role === 'PROPRIETARIO' || dto.role === 'INDEPENDENT_OWNER') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.OWNER);
    } else if (dto.role === 'BROKER') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.BROKER);
    } else if (dto.role === 'AGENCY_MANAGER') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.MANAGER);
    } else if (dto.role === 'ADMIN') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.ADMIN);
    } else if (dto.role === 'AGENCY_ADMIN') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.AGENCY_ADMIN);
    } else if (dto.role === 'CEO') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.CEO);
    } else if (dto.role === 'PLATFORM_MANAGER') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.PLATFORM_MANAGER);
    } else if (dto.role === 'BUILDING_MANAGER') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.BUILDING_MANAGER);
    } else if (dto.role === 'LEGAL_AUDITOR') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.LEGAL_AUDITOR);
    } else if (dto.role === 'REPRESENTATIVE') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.REPRESENTATIVE);
    } else if (dto.role === 'API_CLIENT') {
      token = await this.tokenGenerator.generateToken(TokenEntityType.API_CLIENT);
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
        // Store CRECI exactly as received in a single field
        creci: dto.creci || null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        brokerId: dto.managerId ? BigInt(dto.managerId) : null,
        status: 'ACTIVE',
        nationality: dto.nationality,
        maritalStatus: dto.maritalStatus,
        profession: dto.profession,
        rg: dto.rg,
        bankName: dto.bankName,
        bankBranch: dto.bankBranch,
        bankAccount: dto.bankAccount,
        pixKey: dto.pixKey,
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

    if (user.isFrozen) {
      throw new ForbiddenException(
        user.frozenReason || PLAN_MESSAGES.EDIT_FROZEN_USER
      );
    }

    const updateData: any = {};

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
    if (dto.creci !== undefined) {
      // Keep full CRECI string in a single field
      updateData.creci = dto.creci;
    }

    if (dto.birthDate !== undefined) {
      updateData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.nationality !== undefined) updateData.nationality = dto.nationality;
    if (dto.maritalStatus !== undefined) updateData.maritalStatus = dto.maritalStatus;
    if (dto.profession !== undefined) updateData.profession = dto.profession;
    if (dto.rg !== undefined) updateData.rg = dto.rg;
    if (dto.bankName !== undefined) updateData.bankName = dto.bankName;
    if (dto.bankBranch !== undefined) updateData.bankBranch = dto.bankBranch;
    if (dto.bankAccount !== undefined) updateData.bankAccount = dto.bankAccount;
    if (dto.pixKey !== undefined) updateData.pixKey = dto.pixKey;

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

  async updateStatus(id: string, status: string, updaterId?: string, updaterRole?: UserRole, updaterAgencyId?: string) {
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

    // Permission checks for AGENCY_ADMIN
    if (updaterRole === UserRole.AGENCY_ADMIN && updaterId && updaterAgencyId) {
      const userRole = user.role as string;
      const allowedRoles = ['AGENCY_MANAGER', 'BROKER', 'PROPRIETARIO', 'INQUILINO'];
      if (!allowedRoles.includes(userRole)) {
        throw new ForbiddenException('Você não tem permissão para suspender este usuário.');
      }
      
      const updater = await this.prisma.user.findUnique({
        where: { id: BigInt(updaterId) },
        select: { agencyId: true },
      });
      
      const createdByUpdater = user.createdBy?.toString() === updaterId;
      const sameAgency = updater?.agencyId && user.agencyId && updater.agencyId === user.agencyId;

      if (!createdByUpdater && !sameAgency) {
        throw new ForbiddenException('Você só pode suspender usuários da sua própria agência ou que você criou.');
      }
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

    if (deleterRole && deleterId) {
      const userRole = user.role as string;

      if (deleterRole === UserRole.CEO) {
      }
      else if (deleterRole === UserRole.ADMIN) {
        const allowedRoles = ['PLATFORM_MANAGER', 'LEGAL_AUDITOR', 'REPRESENTATIVE', 'API_CLIENT'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
      }
      else if (deleterRole === UserRole.AGENCY_ADMIN) {
        const allowedRoles = ['AGENCY_MANAGER', 'BROKER', 'PROPRIETARIO'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
        const deleter = await this.prisma.user.findUnique({
          where: { id: BigInt(deleterId) },
          select: { agencyId: true },
        });
        const createdByDeleter = user.createdBy?.toString() === deleterId;
        const sameAgency = deleter?.agencyId && user.agencyId && deleter.agencyId === user.agencyId;

        if (!createdByDeleter && !sameAgency) {
          throw new ForbiddenException('Você só pode excluir usuários da sua própria agência ou que você criou.');
        }
      }
      else if (deleterRole === UserRole.INDEPENDENT_OWNER) {
        // Independent owners can only delete users they created (tenants, building managers)
        const allowedRoles = ['INQUILINO', 'BUILDING_MANAGER'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
        const createdByDeleter = user.createdBy?.toString() === deleterId;
        if (!createdByDeleter) {
          throw new ForbiddenException('Você só pode excluir usuários que você criou.');
        }
      }
      else if (deleterRole === UserRole.AGENCY_MANAGER) {
        const allowedRoles = ['BROKER', 'PROPRIETARIO'];
        if (!allowedRoles.includes(userRole)) {
          throw new ForbiddenException('Você não tem permissão para excluir este usuário.');
        }
        const deleter = await this.prisma.user.findUnique({
          where: { id: BigInt(deleterId) },
          select: { agencyId: true },
        });
        const createdByDeleter = user.createdBy?.toString() === deleterId;
        const sameAgency = deleter?.agencyId && user.agencyId && deleter.agencyId === user.agencyId;

        if (!createdByDeleter && !sameAgency) {
          throw new ForbiddenException('Você só pode excluir usuários da sua própria agência ou que você criou.');
        }
      }
      else {
        throw new ForbiddenException('Você não tem permissão para excluir usuários.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const userBigInt = BigInt(id);

      await tx.refreshToken.deleteMany({
        where: { userId: userBigInt },
      });

      await tx.notification.deleteMany({
        where: {
          OR: [
            { tenantId: userBigInt },
            { ownerId: userBigInt },
          ],
        },
      });

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
        await tx.activeChat.deleteMany({
          where: { chatId: { in: chatIds } },
        });

        await tx.message.deleteMany({
          where: { chatId: { in: chatIds } },
        });

        await tx.chat.deleteMany({
          where: { id: { in: chatIds } },
        });
      }

      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: userBigInt },
            { receiverId: userBigInt },
          ],
        },
      });

      await tx.auditLog.deleteMany({
        where: { userId: userBigInt },
      });

      await tx.salesNotification.deleteMany({
        where: { userId: userBigInt },
      });

      await tx.payment.deleteMany({
        where: { userId: userBigInt },
      });

      await tx.activeChat.deleteMany({
        where: { userId: userBigInt },
      });

      await tx.inspectionMedia.deleteMany({
        where: { uploadedById: userBigInt },
      });
      await tx.inspection.updateMany({
        where: { assignedById: userBigInt },
        data: { assignedById: null },
      });
      await tx.inspection.updateMany({
        where: { approvedById: userBigInt },
        data: { approvedById: null },
      });
      await tx.inspection.updateMany({
        where: { createdBy: userBigInt },
        data: { createdBy: null },
      });

      await tx.propertyImage.deleteMany({
        where: { uploadedBy: userBigInt },
      });

      await tx.contractClauseHistory.deleteMany({
        where: { editedBy: userBigInt },
      });

      await tx.invoice.updateMany({
        where: { tenantId: userBigInt },
        data: { tenantId: null },
      });
      await tx.invoice.updateMany({
        where: { createdBy: userBigInt },
        data: { createdBy: null },
      });

      await tx.transfer.deleteMany({
        where: { recipientId: userBigInt },
      });

      const extrajudicialNotifs = await tx.extrajudicialNotification.findMany({
        where: {
          OR: [
            { creditorId: userBigInt },
            { debtorId: userBigInt },
            { createdBy: userBigInt },
          ],
        },
        select: { id: true },
      });
      const extrajudicialIds = extrajudicialNotifs.map(n => n.id);

      if (extrajudicialIds.length > 0) {
        await tx.extrajudicialNotificationAudit.deleteMany({
          where: { notificationId: { in: extrajudicialIds } },
        });
        await tx.extrajudicialNotification.deleteMany({
          where: { id: { in: extrajudicialIds } },
        });
      }

      await tx.tenantAnalysis.deleteMany({
        where: { requestedById: userBigInt },
      });

      await tx.property.updateMany({
        where: { ownerId: userBigInt },
        data: { ownerId: null },
      });
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

      const tenantContracts = await tx.contract.findMany({
        where: { tenantId: userBigInt },
        select: { id: true },
      });
      const contractIds = tenantContracts.map(c => c.id);

      if (contractIds.length > 0) {
        await tx.payment.deleteMany({
          where: { contratoId: { in: contractIds } },
        });
        await tx.contract.deleteMany({
          where: { tenantId: userBigInt },
        });
      }

      await tx.contract.updateMany({
        where: { ownerId: userBigInt },
        data: { ownerId: null },
      });

      await tx.invoice.updateMany({
        where: { ownerId: userBigInt },
        data: { ownerId: null },
      });

      await tx.agreement.updateMany({
        where: { ownerId: userBigInt },
        data: { ownerId: null },
      });
      await tx.agreement.updateMany({
        where: { tenantId: userBigInt },
        data: { tenantId: null },
      });

      const serviceContracts = await tx.serviceContract.findMany({
        where: { ownerId: userBigInt },
        select: { id: true },
      });
      const serviceContractIds = serviceContracts.map(sc => sc.id);

      if (serviceContractIds.length > 0) {
        await tx.serviceContractProperty.deleteMany({
          where: { serviceContractId: { in: serviceContractIds } },
        });
        await tx.serviceContractClauseHistory.deleteMany({
          where: { serviceContractId: { in: serviceContractIds } },
        });
        await tx.serviceContract.deleteMany({
          where: { ownerId: userBigInt },
        });
      }

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

      await tx.user.delete({
        where: { id: userBigInt },
      });
    });

    return { message: 'User deleted successfully' };
  }

  /**
   * Validate password strength
   * Requirements:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character (symbol)
   */
  private validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('A senha deve ter no mínimo 8 caracteres');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('A senha deve conter pelo menos uma letra minúscula');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('A senha deve conter pelo menos um número');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('A senha deve conter pelo menos um caractere especial (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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

    // Validate password strength
    const passwordValidation = this.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw new BadRequestException(passwordValidation.errors.join('; '));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        phone: true,
        document: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        photoUrl: true,
        creci: true,
        agencyId: true,
        createdAt: true,
        agency: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            cnpj: true,
            email: true,
            phone: true,
        creci: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            representativeName: true,
            representativeDocument: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      id: user.id.toString(),
        agencyId: user.agencyId?.toString() || null,
        createdAt: user.createdAt?.toISOString() || null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: { agency: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.document !== undefined) updateData.document = dto.document;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.cep !== undefined) updateData.cep = dto.cep;
    if (dto.neighborhood !== undefined) updateData.neighborhood = dto.neighborhood;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;

    if (dto.creci !== undefined) {
      // Keep full CRECI string in single column
      updateData.creci = dto.creci;
    }

    if (user.role === 'AGENCY_ADMIN' && user.agencyId) {
      const agencyUpdateData: any = {};

      if (dto.agencyName !== undefined) agencyUpdateData.name = dto.agencyName;
      if (dto.agencyCnpj !== undefined) agencyUpdateData.cnpj = dto.agencyCnpj;
      if (dto.representativeName !== undefined) agencyUpdateData.representativeName = dto.representativeName;
      if (dto.representativeDocument !== undefined) agencyUpdateData.representativeDocument = dto.representativeDocument;

      if (Object.keys(agencyUpdateData).length > 0) {
        await this.prisma.agency.update({
          where: { id: user.agencyId },
          data: agencyUpdateData,
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        phone: true,
        document: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        photoUrl: true,
      },
    });

    return {
      ...updated,
      id: updated.id.toString(),
    };
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileExtension = path.extname(file.originalname);
    const filename = `${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadsDir, filename);

    if (user.photoUrl) {
      const oldFilename = user.photoUrl.split('/').pop();
      const oldFilePath = path.join(uploadsDir, oldFilename || '');
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    fs.writeFileSync(filePath, file.buffer);

    const photoUrl = `/uploads/profiles/${filename}`;
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { photoUrl },
    });

    return { photoUrl, message: 'Photo uploaded successfully' };
  }

  async deleteProfilePhoto(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.photoUrl) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles');
      const filename = user.photoUrl.split('/').pop();
      const filePath = path.join(uploadsDir, filename || '');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { photoUrl: null },
    });

    return { message: 'Photo deleted successfully' };
  }

  async validateDocument(document: string) {
    // First validate document format (CPF/CNPJ)
    const validation = this.documentValidation.validateDocument(document);
    if (!validation.valid) {
      return {
        isAvailable: false,
        message: validation.message || 'Documento inválido',
        type: validation.type,
        isAlphanumeric: validation.isAlphanumeric,
      };
    }

    // Check if document is already registered
    const existingUser = await this.prisma.user.findFirst({
      where: { document },
    });

    return {
      isAvailable: !existingUser,
      message: existingUser ? 'Documento já cadastrado' : 'Documento disponível',
      type: validation.type,
      isAlphanumeric: validation.isAlphanumeric,
    };
  }

  async getTenantsByScope(scope: { ownerId?: string; agencyId?: string; brokerId?: string; managerId?: string; createdById?: string }, search?: string) {
    try {
      console.log('[UsersService.getTenantsByScope] Scope:', JSON.stringify(scope, null, 2));
      console.log('[UsersService.getTenantsByScope] Search:', search);

      const searchCondition = search ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { document: { contains: search } },
          { phone: { contains: search } },
        ],
      } : null;

      if (!scope.ownerId && !scope.agencyId && !scope.brokerId && !scope.managerId && !scope.createdById) {
        const tenants = await this.prisma.user.findMany({
          where: {
            role: UserRole.INQUILINO,
            ...(searchCondition ? { AND: [searchCondition] } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            token: true,
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
            role: true,
            status: true,
            isFrozen: true,
            photoUrl: true,
            agencyId: true,
            createdAt: true,
            createdBy: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
          },
        });

        return tenants.map(tenant => ({
          ...tenant,
          id: tenant.id.toString(),
          agencyId: tenant.agencyId?.toString() || null,
          createdBy: tenant.createdBy?.toString() || null,
          birthDate: tenant.birthDate?.toISOString() || null,
          createdAt: tenant.createdAt?.toISOString() || null,
        }));
      }

    let where: any = {
      role: UserRole.INQUILINO,
      ...(searchCondition ? { AND: [searchCondition] } : {}),
    };

    if (scope.createdById) {
      where.createdBy = BigInt(scope.createdById);
      console.log('[UsersService.getTenantsByScope] Filtering by createdBy:', scope.createdById);
    }

    if (scope.ownerId) {
      where.ownerId = BigInt(scope.ownerId);
    }

    if (scope.agencyId && !scope.ownerId && !scope.managerId && !scope.brokerId && !scope.createdById) {
      where.agencyId = BigInt(scope.agencyId);
    }

    if (scope.brokerId) {
      where.createdBy = BigInt(scope.brokerId);
    }

    if (scope.managerId) {
      const agencyBrokers = await this.prisma.user.findMany({
        where: {
          role: UserRole.BROKER,
          ...(scope.agencyId ? { agencyId: BigInt(scope.agencyId) } : {}),
        },
        select: { id: true },
      });

      const agencyBrokerIds = agencyBrokers.map(b => b.id);

      if (scope.agencyId) {
        where = {
          AND: [
            { role: UserRole.INQUILINO },
            { agencyId: BigInt(scope.agencyId) },
            ...(search ? [searchCondition] : []),
          ],
        };
      } else {
        where = {
          AND: [
            { role: UserRole.INQUILINO },
            {
              OR: [
                { createdBy: BigInt(scope.managerId) },
                ...(agencyBrokerIds.length > 0 ? [{ createdBy: { in: agencyBrokerIds } }] : []),
              ],
            },
            ...(search ? [searchCondition] : []),
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
        token: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        complement: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        role: true,
        status: true,
        isFrozen: true,
        photoUrl: true,
        agencyId: true,
        createdAt: true,
        createdBy: true,
        nationality: true,
        maritalStatus: true,
        profession: true,
        rg: true,
        employerName: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        company: {
          select: {
            id: true,
            name: true,
            cnpj: true,
            address: true,
            responsible: true,
          }
        }
      },
    });

      console.log('[UsersService.getTenantsByScope] Tenants found:', tenants.map(t => ({
        id: t.id.toString(),
        name: t.name,
        createdBy: t.createdBy?.toString() || 'null'
      })));

      const result = tenants.map(tenant => {
        const { createdBy, agencyId, company, ...rest } = tenant;
        return {
          ...rest,
          id: tenant.id.toString(),
          agencyId: agencyId?.toString() || null,
          createdBy: createdBy?.toString() || null,
          birthDate: tenant.birthDate?.toISOString() || null,
          createdAt: tenant.createdAt?.toISOString() || null,
          company: company ? {
            id: company.id.toString(),
            name: company.name,
            cnpj: company.cnpj,
            address: company.address,
            responsible: company.responsible,
          } : null,
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
    const planCheck = await this.plansService.checkPlanLimits(requestingUserId, 'tenant');
    if (!planCheck.allowed) {
      throw new ForbiddenException(planCheck.message || 'Você atingiu o limite de inquilinos do seu plano.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Este email já está sendo usado por outro usuário');
    }

    // Validate document (CPF or CNPJ) - supports alphanumeric CNPJ from Jan 2026
    if (dto.document) {
      const validation = this.documentValidation.validateDocument(dto.document);
      if (!validation.valid) {
        throw new BadRequestException(validation.message || 'Documento inválido');
      }
      // For CNPJ (especially alphanumeric), require email or SMS confirmation for billing
      if (validation.type === 'CNPJ' && (!dto.email && !dto.phone)) {
        throw new BadRequestException('Para CNPJ, é obrigatório informar email ou telefone para confirmação de cobrança');
      }
    }

    // Require email or SMS for billing purposes
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('É obrigatório informar email ou telefone para confirmação de cobrança');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

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
      finalBrokerId = BigInt(requestingUserId);
    } else if (requestingUserRole === 'PROPRIETARIO' || requestingUserRole === 'INDEPENDENT_OWNER') {
      finalOwnerId = BigInt(requestingUserId);
      finalAgencyId = null;
    } else {
      finalOwnerId = dto.agencyId ? null : BigInt(requestingUserId);
      finalAgencyId = dto.agencyId ? BigInt(dto.agencyId) : null;
      finalBrokerId = dto.brokerId ? BigInt(dto.brokerId) : null;
    }

    const token = await this.tokenGenerator.generateToken(TokenEntityType.TENANT);

    const tenant = await this.prisma.user.create({
      data: {
        token,
        email: dto.email,
        password: hashedPassword,
        plainPassword: dto.password,
        name: dto.name,
        role: UserRole.INQUILINO,
        plan: dto.plan || 'FREE',
        phone: dto.phone,
        document: dto.document,
        address: dto.address,
        complement: dto.complement,
        cep: dto.cep,
        neighborhood: dto.neighborhood,
        city: dto.city,
        state: dto.state,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        nationality: dto.nationality,
        maritalStatus: dto.maritalStatus,
        profession: dto.profession,
        rg: dto.rg,
        employerName: dto.employerName,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        status: 'ACTIVE',
        ownerId: finalOwnerId,
        agencyId: finalAgencyId,
        brokerId: finalBrokerId,
        createdBy: BigInt(requestingUserId),
      },
      select: {
        id: true,
        token: true,
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
      token: tenant.token,
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

    if (!tenant.token) {
      updateData.token = await this.tokenGenerator.generateToken(TokenEntityType.TENANT);
    }

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.document !== undefined) updateData.document = dto.document;
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
    if (dto.nationality !== undefined) updateData.nationality = dto.nationality;
    if (dto.maritalStatus !== undefined) updateData.maritalStatus = dto.maritalStatus;
    if (dto.profession !== undefined) updateData.profession = dto.profession;
    if (dto.rg !== undefined) updateData.rg = dto.rg;
    if (dto.brokerId !== undefined) {
      updateData.brokerId = dto.brokerId ? BigInt(dto.brokerId) : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(tenantId) },
      data: updateData,
      select: {
        id: true,
        token: true,
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
        nationality: true,
        maritalStatus: true,
        profession: true,
        rg: true,
      },
    });

    return {
      ...updated,
      id: updated.id.toString(),
      token: updated.token,
      agencyId: updated.agencyId?.toString() || null,
      brokerId: updated.brokerId?.toString() || null,
      birthDate: updated.birthDate?.toISOString() || null,
      createdAt: updated.createdAt?.toISOString() || null,
    };
  }

  async getOwnersByAgency(agencyId: string) {
    const owners = await this.prisma.user.findMany({
      where: {
        role: UserRole.PROPRIETARIO,
        agencyId: BigInt(agencyId),
      },
      select: {
        id: true,
        token: true,
        email: true,
        name: true,
        phone: true,
        document: true,
        status: true,
        ownerFee: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return owners.map(owner => ({
      ...owner,
      id: owner.id.toString(),
      ownerFee: owner.ownerFee ?? 90.0,
      createdAt: owner.createdAt?.toISOString() || null,
    }));
  }

  async updateOwnerFee(ownerId: string, ownerFee: number, agencyId: string | null) {
    // Build where clause based on whether agencyId is provided
    const where: any = {
      id: BigInt(ownerId),
    };

    // If agencyId is provided (AGENCY_ADMIN case), verify owner belongs to this agency
    if (agencyId) {
      where.role = UserRole.PROPRIETARIO;
      where.agencyId = BigInt(agencyId);
    } else {
      // For CEO/ADMIN or INDEPENDENT_OWNER, allow updating PROPRIETARIO or INDEPENDENT_OWNER
      where.role = { in: [UserRole.PROPRIETARIO, UserRole.INDEPENDENT_OWNER] };
    }

    const owner = await this.prisma.user.findFirst({
      where,
    });

    if (!owner) {
      if (agencyId) {
        throw new NotFoundException('Proprietário não encontrado nesta agência');
      } else {
        throw new NotFoundException('Proprietário não encontrado');
      }
    }

    if (ownerFee < 0 || ownerFee > 100) {
      throw new BadRequestException('Taxa do proprietário deve estar entre 0 e 100');
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(ownerId) },
      data: { ownerFee },
      select: {
        id: true,
        name: true,
        ownerFee: true,
      },
    });

    return {
      ...updated,
      id: updated.id.toString(),
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

    const activeContracts = await this.prisma.contract.findFirst({
      where: {
        tenantId: tenantBigInt,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (activeContracts) {
      throw new BadRequestException('Não é possível excluir inquilino com contratos ativos. Cancele ou finalize os contratos primeiro.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({
        where: { userId: tenantBigInt },
      });

      await tx.notification.deleteMany({
        where: {
          OR: [
            { tenantId: tenantBigInt },
            { ownerId: tenantBigInt },
          ],
        },
      });

      await tx.activeChat.deleteMany({
        where: { userId: tenantBigInt },
      });

      await tx.message.deleteMany({
        where: {
          OR: [
            { senderId: tenantBigInt },
            { receiverId: tenantBigInt },
          ],
        },
      });

      await tx.chat.deleteMany({
        where: {
          OR: [
            { participant1Id: tenantBigInt },
            { participant2Id: tenantBigInt },
          ],
        },
      });

      await tx.auditLog.deleteMany({
        where: { userId: tenantBigInt },
      });

      await tx.property.updateMany({
        where: { tenantId: tenantBigInt },
        data: { tenantId: null },
      });

      await tx.payment.deleteMany({
        where: { userId: tenantBigInt },
      });

      await tx.transfer.deleteMany({
        where: { recipientId: tenantBigInt },
      });

      await tx.inspection.deleteMany({
        where: { inspectorId: tenantBigInt },
      });

      const inactiveContracts = await tx.contract.findMany({
        where: {
          tenantId: tenantBigInt,
          status: { notIn: ['ACTIVE', 'PENDING'] },
        },
        select: { id: true },
      });

      const contractIds = inactiveContracts.map(c => c.id);

      if (contractIds.length > 0) {
        await tx.contractAudit.deleteMany({
          where: { contractId: { in: contractIds } },
        });

        await tx.invoice.deleteMany({
          where: { contractId: { in: contractIds } },
        });

        await tx.contract.deleteMany({
          where: { id: { in: contractIds } },
        });
      }

      await tx.user.delete({
        where: { id: tenantBigInt },
      });
    });

    return { message: 'Tenant deleted successfully' };
  }
}
