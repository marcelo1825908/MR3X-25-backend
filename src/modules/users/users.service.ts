import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    role?: UserRole;
    agencyId?: string;
    status?: string;
  }) {
    const { skip = 0, take = 20, role, agencyId, status } = params;

    const where: any = {};
    if (role) where.role = role;
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;

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
          agencyId: true,
          createdAt: true,
          lastLogin: true,
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
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(dto: CreateUserDto, creatorId?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
        plan: dto.plan || 'FREE',
        phone: dto.phone,
        document: dto.document,
        agencyId: dto.agencyId ? BigInt(dto.agencyId) : null,
        companyId: dto.companyId ? BigInt(dto.companyId) : null,
        createdBy: creatorId ? BigInt(creatorId) : null,
      },
    });

    const { password: _, ...result } = user;
    return {
      ...result,
      id: result.id.toString(),
      agencyId: result.agencyId?.toString(),
      companyId: result.companyId?.toString(),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = { ...dto };

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.agencyId) {
      updateData.agencyId = BigInt(dto.agencyId);
    }

    if (dto.companyId) {
      updateData.companyId = BigInt(dto.companyId);
    }

    const updated = await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const { password: _, ...result } = updated;
    return {
      ...result,
      id: result.id.toString(),
      agencyId: result.agencyId?.toString(),
      companyId: result.companyId?.toString(),
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

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id: BigInt(id) },
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

  async getTenantsByScope(scope: { ownerId?: string; agencyId?: string; brokerId?: string; managerId?: string }) {
    try {
      console.log('[UsersService.getTenantsByScope] Scope:', JSON.stringify(scope, null, 2));
      
      // If no scope is provided (CEO/ADMIN), return all tenants
      if (!scope.ownerId && !scope.agencyId && !scope.brokerId && !scope.managerId) {
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
    
    // Owner sees only own tenants
    if (scope.ownerId) {
      where.ownerId = BigInt(scope.ownerId);
    }

    // AGENCY_ADMIN: sees all tenants in their agency
    if (scope.agencyId && !scope.ownerId && !scope.managerId && !scope.brokerId) {
      where.agencyId = BigInt(scope.agencyId);
    }

    // BROKER: sees only tenants created by themselves
    if (scope.brokerId) {
      where.createdBy = BigInt(scope.brokerId);
    }

    // AGENCY_MANAGER: sees tenants created by themselves AND tenants created by brokers they manage
    if (scope.managerId) {
      // Find all brokers managed by this manager (brokers created by this manager)
      const managedBrokers = await this.prisma.user.findMany({
        where: {
          role: UserRole.BROKER,
          createdBy: BigInt(scope.managerId),
          ...(scope.agencyId ? { agencyId: BigInt(scope.agencyId) } : {}),
        },
        select: { id: true },
      });
      
      const managedBrokerIds = managedBrokers.map(b => b.id);
      
      // Manager sees:
      // 1. Tenants created by the manager themselves
      // 2. Tenants created by brokers managed by this manager
      where = {
        AND: [
          { role: UserRole.INQUILINO },
          {
            OR: [
              { createdBy: BigInt(scope.managerId) },
              ...(managedBrokerIds.length > 0 ? [{ createdBy: { in: managedBrokerIds } }] : []),
            ],
          },
        ],
      };
      
      // Also filter by agencyId if provided (to ensure tenants belong to the same agency)
      if (scope.agencyId) {
        where.AND.push({ agencyId: BigInt(scope.agencyId) });
      }
    }

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
      },
    });

      // Serialize BigInt fields
      const result = tenants.map(tenant => ({
        ...tenant,
        id: tenant.id.toString(),
        birthDate: tenant.birthDate?.toISOString() || null,
        createdAt: tenant.createdAt?.toISOString() || null,
      }));
      
      console.log('[UsersService.getTenantsByScope] Result count:', result.length);
      return result;
    } catch (error) {
      console.error('[UsersService.getTenantsByScope] Error:', error);
      console.error('[UsersService.getTenantsByScope] Error stack:', error?.stack);
      throw error;
    }
  }
}
