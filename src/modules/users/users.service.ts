import bcrypt from 'bcrypt';
import { prisma } from '../../config/database';
import { NotFoundError, AppError, ForbiddenError } from '../../shared/errors/AppError';
import { UserCreateDTO, TenantCreateDTO, UserUpdateDTO, ChangeStatusDTO } from './users.dto';
import { createAuditLog } from '../../shared/utils/audit-logger';

export class UsersService {
  async listUsers(params: { search?: string; role?: string; status?: string; plan?: string; page?: number; pageSize?: number; }, scope?: { agencyId?: string; managerId?: string; brokerId?: string; ownerId?: string; }, currentUserId?: string) {
    const { search, role, status, plan } = params;
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));

    const where: any = {};
    
    // Exclude current user from the list - users shouldn't see themselves in the management list
    if (currentUserId) {
      where.id = { not: BigInt(currentUserId) };
    }
    
    if (role) where.role = role;
    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { document: { contains: search } },
      ];
    }

    // Apply tenancy scope
    // Apply strict manager scoping: managers see users in their agency
    if (scope?.managerId) {
      const agencyScopeId = scope.agencyId ?? scope.managerId
      if (agencyScopeId) {
        where.agencyId = BigInt(agencyScopeId)
        console.log(`[UsersService] Filtering by managerId (agencyId): ${agencyScopeId}`)
      }
      where.createdBy = BigInt(scope.managerId)
    } else if (scope?.agencyId) {
      // For AGENCY_ADMIN: filter by agencyId directly
      // Ensure agencyId matches exactly and is not null
      where.agencyId = BigInt(scope.agencyId)
      console.log(`[UsersService] Filtering by agencyId: ${scope.agencyId}`)
    }
    if (scope?.brokerId) {
      where.brokerId = BigInt(scope.brokerId)
      console.log(`[UsersService] Filtering by brokerId: ${scope.brokerId}`)
    }
    
    console.log(`[UsersService] Final where clause:`, JSON.stringify(where, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    ));

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { 
          id: true, name: true, email: true, phone: true, document: true,
          role: true, status: true, plan: true,
          address: true, cep: true, neighborhood: true, city: true, state: true,
          birthDate: true, agencyId: true, createdBy: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Log returned users' agencyIds for debugging
    console.log(`[UsersService] Returned users:`, items.map((u: any) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      agencyId: u.agencyId?.toString() || 'null',
      createdBy: u.createdBy?.toString() || 'null'
    })));

    // Convert BigInt fields to strings for JSON serialization
    const serializedItems = items.map((item: any) => ({
      ...item,
      id: item.id.toString(),
      agencyId: item.agencyId?.toString() || null,
      createdBy: item.createdBy?.toString() || null,
      createdAt: item.createdAt?.toISOString?.() || null,
    }));

    return { items: serializedItems, total, page, pageSize };
  }

  async getUserById(id: string, requestingUser: { userId: string; role: string }) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: BigInt(id) },
        select: {
          id: true, name: true, email: true, phone: true, document: true, role: true, status: true, plan: true,
          birthDate: true, address: true, cep: true, neighborhood: true, city: true, state: true,
          createdAt: true, lastLogin: true,
          agencyId: true, createdBy: true,
          ownedProperties: {
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              stateNumber: true,
              neighborhood: true,
              status: true,
              monthlyRent: true,
              nextDueDate: true,
              tenantId: true,
              createdAt: true,
              tenant: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          contracts: {
            select: { id: true, status: true, propertyId: true, tenantId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: { select: { ownedProperties: true, contracts: true } },
        } as any,
      });
      if (!user) throw new NotFoundError('User not found');

      // Check permissions based on user role
      if (requestingUser.role === 'AGENCY_MANAGER') {
        // AGENCY_MANAGER can view users they created or users created by brokers they manage
        if (user.createdBy?.toString() !== requestingUser.userId) {
          // Check if user was created by a broker managed by this manager
          const userCreator = await prisma.user.findUnique({
            where: { id: user.createdBy || BigInt(0) },
            select: { role: true, createdBy: true },
          });
          
          if (!(userCreator?.role === 'BROKER' && userCreator.createdBy?.toString() === requestingUser.userId)) {
            throw new ForbiddenError('Access denied');
          }
        }
      } else if (requestingUser.role === 'BROKER') {
        // BROKER can view only users they created
        if (user.createdBy?.toString() !== requestingUser.userId) {
          throw new ForbiddenError('Access denied');
        }
      } else if (requestingUser.role === 'AGENCY_ADMIN') {
        // AGENCY_ADMIN can view users in their agency
        // Get requesting user's agencyId
        const requestingUserRecord = await prisma.user.findUnique({
          where: { id: BigInt(requestingUser.userId) },
          select: { agencyId: true },
        });
        
        if (requestingUserRecord?.agencyId && user.agencyId) {
          if (user.agencyId.toString() !== requestingUserRecord.agencyId.toString()) {
            throw new ForbiddenError('Access denied');
          }
        } else if (requestingUserRecord?.agencyId) {
          // Requesting user has agencyId but target user doesn't - deny access
          throw new ForbiddenError('Access denied');
        }
      } else if (requestingUser.role === 'PROPRIETARIO' || requestingUser.role === 'INDEPENDENT_OWNER') {
        // Owner can view only their own tenants
        if (user.role === 'INQUILINO' && user.ownerId?.toString() !== requestingUser.userId) {
          throw new ForbiddenError('Access denied');
        }
      }

      const audit = await prisma.auditLog.findMany({
        where: { entity: 'USER', entityId: BigInt(id) },
        orderBy: { timestamp: 'desc' },
        take: 20,
        select: { timestamp: true, event: true, userId: true },
      });

      // Helper function to safely serialize BigInt
      const serializeBigInt = (value: any): string | null => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'string') return value;
        return String(value);
      };

      // Helper function to safely serialize Date
      const serializeDate = (value: any): string | null => {
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'string') return value;
        return null;
      };

      // Serialize all BigInt and Date fields
      const userAny = user as any;
      return {
        ...userAny,
        id: serializeBigInt(userAny.id),
        agencyId: serializeBigInt(userAny.agencyId),
        createdBy: serializeBigInt(userAny.createdBy),
        birthDate: serializeDate(userAny.birthDate),
        createdAt: serializeDate(userAny.createdAt),
        lastLogin: serializeDate(userAny.lastLogin),
        ownedProperties: ((userAny.ownedProperties || []) as any[]).map((p: any) => ({
          ...p,
          id: serializeBigInt(p.id),
          monthlyRent: p.monthlyRent !== null && p.monthlyRent !== undefined ? Number(p.monthlyRent) : null,
          tenantId: serializeBigInt(p.tenantId),
          nextDueDate: serializeDate(p.nextDueDate),
          createdAt: serializeDate(p.createdAt),
          tenant: p.tenant
            ? {
                ...p.tenant,
                id: serializeBigInt(p.tenant.id),
              }
            : null,
        })),
        contracts: ((userAny.contracts || []) as any[]).map((c: any) => ({
          ...c,
          id: serializeBigInt(c.id),
          propertyId: serializeBigInt(c.propertyId),
          tenantId: serializeBigInt(c.tenantId),
          createdAt: serializeDate(c.createdAt),
        })),
        audit: (audit || []).map((log: any) => ({
          ...log,
          userId: serializeBigInt(log.userId),
          timestamp: serializeDate(log.timestamp),
        })),
        _count: {
          ownedProperties: Number(userAny._count?.ownedProperties || 0),
          contracts: Number(userAny._count?.contracts || 0),
        },
      };
    } catch (error: any) {
      console.error('[getUserById] Error:', error);
      throw error;
    }
  }

  async updateUserById(id: string, data: UserUpdateDTO, requestingUserId: string, requestingUserRole: string) {
    const user = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!user) throw new NotFoundError('User not found');

    if (requestingUserRole === 'AGENCY_MANAGER' && user.createdBy?.toString() !== requestingUserId) {
      throw new ForbiddenError('Access denied');
    }

    // Capture data before update
    const dataBefore = {
      name: user.name,
      phone: user.phone,
      birthDate: user.birthDate,
      address: user.address,
      cep: user.cep,
      neighborhood: user.neighborhood,
      city: user.city,
      state: user.state,
    };

    // Enforce immutables
    const { document, birthDate, ...rest } = data as any;

    const updated = await prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        ...rest,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        notificationPreferences: data.notificationPreferences ? JSON.stringify(data.notificationPreferences) : undefined,
      },
      select: { id: true, name: true, email: true, phone: true, role: true, status: true, birthDate: true, address: true, cep: true, neighborhood: true, city: true, state: true, agencyId: true },
    });

    // Capture data after update
    const dataAfter = {
      name: updated.name,
      phone: (updated as any).phone,
      birthDate: (updated as any).birthDate,
      address: (updated as any).address,
      cep: (updated as any).cep,
      neighborhood: (updated as any).neighborhood,
      city: (updated as any).city,
      state: (updated as any).state,
    };

    // Use the shared audit logger
    await createAuditLog({
      event: 'USER_UPDATED',
      userId: requestingUserId,
      entity: 'USER',
      entityId: id,
      dataBefore,
      dataAfter,
    });

    // Serialize BigInt fields
    return {
      ...updated,
      id: updated.id.toString(),
      agencyId: updated.agencyId?.toString() || null,
    };
  }

  async changeStatus(id: string, payload: ChangeStatusDTO, requestingUser?: { userId: string; role: string }) {
    const user = await prisma.user.findUnique({ where: { id: BigInt(id) } });
    if (!user) throw new NotFoundError('User not found');

    if (requestingUser?.role === 'AGENCY_MANAGER' && user.createdBy?.toString() !== requestingUser.userId) {
      throw new ForbiddenError('Access denied');
    }

    const updated = await prisma.user.update({ where: { id: BigInt(id) }, data: { status: payload.status } });
    await prisma.auditLog.create({
      data: {
        event: 'USER_STATUS_CHANGED',
        userId: BigInt(id),
        entity: 'USER',
        entityId: BigInt(id),
        dataAfter: JSON.stringify({ status: payload.status, reason: payload.reason }),
      },
    });
    return { id: updated.id.toString(), status: updated.status };
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) throw new NotFoundError('User not found');

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new AppError('New password must be different from the current password', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await createAuditLog({
      event: 'USER_PASSWORD_CHANGED',
      userId: userId,
      entity: 'USER',
      entityId: userId,
    });

    return { message: 'Password changed successfully' };
  }
  async createUser(data: UserCreateDTO, requestingUserId?: string, requestingUserRole?: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Este usuário já existe. Verifique o email ou documento.', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Remove non-column helper fields before persisting
    const { managerId, agencyId, ...rest } = (data as any) || {}

    // Determine the correct agencyId and brokerId based on the requesting user
    let finalAgencyId: bigint | undefined = undefined;
    let finalBrokerId: bigint | undefined = undefined;
    
    if (requestingUserRole === 'AGENCY_ADMIN' && requestingUserId) {
      // When an AGENCY_ADMIN creates a user (manager/broker/etc):
      // - agencyId = AGENCY_ADMIN's agencyId (must be set)
      // - Ensure the created user belongs to the same agency
      const requestingUser = await prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { id: true, agencyId: true },
      });
      
      if (requestingUser?.agencyId) {
        // AGENCY_ADMIN has an agency - use it
        finalAgencyId = requestingUser.agencyId;
      } else if (agencyId) {
        // Fallback to provided agencyId if requesting user doesn't have one
        finalAgencyId = BigInt(agencyId);
      } else {
        // IMPORTANT: If AGENCY_ADMIN doesn't have an agencyId and none is provided,
        // we still allow creation but the user will have agencyId = null
        // This allows AGENCY_ADMIN to create users before they've created an agency
        // The created user can then be linked to an agency later
        console.warn(`AGENCY_ADMIN ${requestingUserId} creating user without agencyId - user will have agencyId = null`);
        finalAgencyId = undefined;
      }
      
      // brokerId is only used for tenants/owners linked to a specific broker
      // When AGENCY_ADMIN creates a user (manager/broker/etc), brokerId should be undefined
      // brokerId should only be set when a broker creates a tenant or when assigning a broker to a property
      if (data.role === 'BROKER') {
        // When creating a broker, brokerId must be undefined (broker is not linked to another broker)
        finalBrokerId = undefined;
      } else {
        // For other roles created by AGENCY_ADMIN, brokerId should also be undefined
        // brokerId is only set when a broker creates a tenant or when explicitly linking a user to a broker
        finalBrokerId = undefined;
      }
    } else if (requestingUserRole === 'AGENCY_MANAGER' && requestingUserId) {
      const requestingUser = await prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });

      if (requestingUser?.agencyId) {
        finalAgencyId = requestingUser.agencyId;
      } else if (agencyId) {
        finalAgencyId = BigInt(agencyId);
      } else {
        throw new AppError('Agency manager must belong to an agency to create usuários', 400);
      }
      
      if (data.role !== 'BROKER') {
        finalBrokerId = managerId ? BigInt(managerId) : undefined;
      } else {
        finalBrokerId = undefined;
      }
    } else {
      // For other roles, use provided values
      finalAgencyId = agencyId ? BigInt(agencyId) : undefined;
      finalBrokerId = managerId ? BigInt(managerId) : undefined;
    }

    const user = await prisma.user.create({
      data: {
        ...(rest as any),
        password: hashedPassword,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        brokerId: finalBrokerId,
        agencyId: finalAgencyId,
        status: 'ACTIVE',
        createdBy: requestingUserId ? BigInt(requestingUserId) : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        agencyId: true,
        createdBy: true,
        createdAt: true,
      },
    });

    // Serialize BigInt fields
    return {
      ...user,
      id: user.id.toString(),
      agencyId: user.agencyId?.toString() || null,
      createdBy: user.createdBy?.toString() || null,
    };
  }

  async getTenantsByScope(scope: { ownerId?: string; agencyId?: string; brokerId?: string; managerId?: string }) {
    let where: any = { role: 'INQUILINO' }
    
    // Owner sees only own tenants
    if (scope.ownerId) {
      where.ownerId = BigInt(scope.ownerId)
    }

    // AGENCY_ADMIN: sees all tenants in their agency
    if (scope.agencyId && !scope.ownerId && !scope.managerId && !scope.brokerId) {
      where.agencyId = BigInt(scope.agencyId)
    }

    // BROKER: sees only tenants created by themselves
    if (scope.brokerId) {
      where.createdBy = BigInt(scope.brokerId)
    }

    // AGENCY_MANAGER: sees tenants created by themselves AND tenants created by brokers they manage
    if (scope.managerId) {
      // Find all brokers managed by this manager (brokers created by this manager)
      const managedBrokers = await prisma.user.findMany({
        where: {
          role: 'BROKER',
          createdBy: BigInt(scope.managerId),
          ...(scope.agencyId ? { agencyId: BigInt(scope.agencyId) } : {}),
        },
        select: { id: true },
      })
      
      const managedBrokerIds = managedBrokers.map(b => b.id)
      
      // Manager sees:
      // 1. Tenants created by the manager themselves
      // 2. Tenants created by brokers managed by this manager
      where = {
        AND: [
          { role: 'INQUILINO' },
          {
            OR: [
              { createdBy: BigInt(scope.managerId) },
              ...(managedBrokerIds.length > 0 ? [{ createdBy: { in: managedBrokerIds } }] : []),
            ],
          },
        ],
      }
      
      // Also filter by agencyId if provided (to ensure tenants belong to the same agency)
      if (scope.agencyId) {
        where.AND.push({ agencyId: BigInt(scope.agencyId) })
      }
    }
    const tenants = await prisma.user.findMany({
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
    })
    return tenants
  }

  async getTenantsWithoutProperties(scope: { ownerId?: string; agencyId?: string }) {
    const where: any = {
      role: 'INQUILINO',
      tenantProperties: { none: {} },
    }
    if (scope.ownerId) where.ownerId = BigInt(scope.ownerId)
    if (scope.agencyId) where.agencyId = BigInt(scope.agencyId)
    const tenants = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, phone: true, document: true, createdAt: true },
    })
    return tenants
  }

  async createTenant(requestingUserId: string, data: TenantCreateDTO, requestingUserRole?: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Este email já está sendo usado por outro usuário', 400);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Determine the correct agencyId and ownerId based on the requesting user role
    let finalAgencyId: bigint | undefined = undefined;
    let finalOwnerId: bigint | undefined = undefined;
    
    if (requestingUserRole === 'AGENCY_ADMIN') {
      // When an AGENCY_ADMIN creates a tenant:
      // - agencyId = AGENCY_ADMIN's agencyId (tenant belongs to the agency)
      // - ownerId = undefined (no direct owner relationship)
      const adminRecord = await prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });
      finalAgencyId = adminRecord?.agencyId ?? undefined;
      finalOwnerId = undefined;
    } else if (requestingUserRole === 'AGENCY_MANAGER') {
      // When an AGENCY_MANAGER creates a tenant:
      // - agencyId = manager's agencyId (tenant belongs to the agency)
      // - ownerId = undefined (no direct owner relationship)
      const managerRecord = await prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });
      finalAgencyId = managerRecord?.agencyId ?? undefined;
      finalOwnerId = undefined;
    } else if (requestingUserRole === 'BROKER') {
      // When a BROKER creates a tenant:
      // - agencyId = broker's agencyId (tenant belongs to the agency)
      // - ownerId = undefined (broker is not the owner, just a manager)
      // - createdBy = broker's ID (to track who created the tenant)
      const brokerRecord = await prisma.user.findUnique({
        where: { id: BigInt(requestingUserId) },
        select: { agencyId: true },
      });
      finalOwnerId = undefined; // Broker is not the owner
      finalAgencyId = brokerRecord?.agencyId ?? undefined;
    } else if (requestingUserRole === 'PROPRIETARIO' || requestingUserRole === 'INDEPENDENT_OWNER') {
      // When a PROPRIETARIO or INDEPENDENT_OWNER creates a tenant:
      // - ownerId = the owner's ID (tenant belongs to this property owner)
      // - agencyId = null (direct owner-tenant relationship)
      finalOwnerId = BigInt(requestingUserId);
      finalAgencyId = undefined;
    } else {
      // Default case: use provided values or requesting user
      finalOwnerId = (data as any).ownerId ? BigInt((data as any).ownerId) : BigInt(requestingUserId);
      finalAgencyId = (data as any).agencyId ? BigInt((data as any).agencyId) : undefined;
    }

    const tenant = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        role: 'INQUILINO',
        plan: 'FREE',
        ownerId: finalOwnerId,
        agencyId: finalAgencyId,
        createdBy: BigInt(requestingUserId), // Set createdBy to track who created this tenant
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        status: 'ACTIVE',
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
      },
    });

    // Serialize BigInt fields for JSON response
    return {
      ...tenant,
      id: tenant.id.toString(),
      agencyId: tenant.agencyId?.toString() || null,
      createdBy: tenant.createdBy?.toString() || null,
    };
  }

  async updateTenant(requestingUserId: string, tenantId: string, data: UserUpdateDTO, requestingUserRole?: string) {
    // Find the tenant first
    const tenant = await prisma.user.findFirst({
      where: {
        id: BigInt(tenantId),
        role: 'INQUILINO',
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Get requesting user to check permissions
    const requestingUser = await prisma.user.findUnique({
      where: { id: BigInt(requestingUserId) },
      select: { role: true, agencyId: true },
    });

    if (!requestingUser) {
      throw new NotFoundError('Requesting user not found');
    }

    // Check permissions based on user role
    let hasPermission = false;

    if (requestingUser.role === 'ADMIN' || requestingUser.role === 'CEO') {
      hasPermission = true;
    } else if (requestingUser.role === 'PROPRIETARIO' || requestingUser.role === 'INDEPENDENT_OWNER') {
      // Owner can update tenants they own
      hasPermission = tenant.ownerId?.toString() === requestingUserId;
    } else if (requestingUser.role === 'AGENCY_ADMIN') {
      // AGENCY_ADMIN can update tenants in their agency
      if (requestingUser.agencyId && tenant.agencyId) {
        hasPermission = tenant.agencyId.toString() === requestingUser.agencyId.toString();
      }
    } else if (requestingUser.role === 'AGENCY_MANAGER') {
      // AGENCY_MANAGER can update:
      // 1. Tenants created by themselves
      // 2. Tenants created by brokers they manage
      if (tenant.createdBy?.toString() === requestingUserId) {
        hasPermission = true;
      } else {
        // Check if tenant was created by a broker managed by this manager
        const tenantCreator = await prisma.user.findUnique({
          where: { id: tenant.createdBy || BigInt(0) },
          select: { role: true, createdBy: true },
        });
        
        if (tenantCreator?.role === 'BROKER' && tenantCreator.createdBy?.toString() === requestingUserId) {
          hasPermission = true;
        }
      }
      
      // Also ensure tenant belongs to the same agency
      if (hasPermission && requestingUser.agencyId && tenant.agencyId) {
        hasPermission = tenant.agencyId.toString() === requestingUser.agencyId.toString();
      }
    } else if (requestingUser.role === 'BROKER') {
      // BROKER can update only tenants created by themselves
      hasPermission = tenant.createdBy?.toString() === requestingUserId;
    }

    if (!hasPermission) {
      throw new ForbiddenError('Access denied - cannot update this tenant');
    }

    const updated = await prisma.user.update({
      where: { id: BigInt(tenantId) },
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
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
      },
    });

    return updated;
  }

  async deleteTenant(requestingUserId: string, tenantId: string) {
    console.log('deleteTenant called:', { requestingUserId, tenantId });
    
    // Find the tenant
    const tenant = await prisma.user.findUnique({
      where: {
        id: BigInt(tenantId),
        role: 'INQUILINO',
      },
    });

    console.log('Tenant found:', tenant);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Check if the requesting user has permission to delete this tenant
    // This could be the owner, broker, or agency manager
    const requestingUser = await prisma.user.findUnique({
      where: { id: BigInt(requestingUserId) },
    });

    console.log('Requesting user:', requestingUser);

    if (!requestingUser) {
      throw new NotFoundError('Requesting user not found');
    }

    // Check permissions based on user role and relationships
    let hasPermission = false;

    if (requestingUser.role === 'ADMIN' || requestingUser.role === 'CEO') {
      hasPermission = true;
    } else if (requestingUser.role === 'PROPRIETARIO' || requestingUser.role === 'INDEPENDENT_OWNER') {
      // Owner can delete tenants they own
      hasPermission = tenant.ownerId?.toString() === requestingUserId;
    } else if (requestingUser.role === 'AGENCY_ADMIN') {
      // AGENCY_ADMIN can delete tenants in their agency
      if (requestingUser.agencyId && tenant.agencyId) {
        hasPermission = tenant.agencyId.toString() === requestingUser.agencyId.toString();
      }
    } else if (requestingUser.role === 'AGENCY_MANAGER') {
      // AGENCY_MANAGER can delete:
      // 1. Tenants created by themselves
      // 2. Tenants created by brokers they manage
      if (tenant.createdBy?.toString() === requestingUserId) {
        hasPermission = true;
      } else {
        // Check if tenant was created by a broker managed by this manager
        const tenantCreator = await prisma.user.findUnique({
          where: { id: tenant.createdBy || BigInt(0) },
          select: { role: true, createdBy: true },
        });
        
        if (tenantCreator?.role === 'BROKER' && tenantCreator.createdBy?.toString() === requestingUserId) {
          hasPermission = true;
        }
      }
      
      // Also ensure tenant belongs to the same agency
      if (hasPermission && requestingUser.agencyId && tenant.agencyId) {
        hasPermission = tenant.agencyId.toString() === requestingUser.agencyId.toString();
      }
    } else if (requestingUser.role === 'BROKER') {
      // BROKER can delete only tenants created by themselves
      hasPermission = tenant.createdBy?.toString() === requestingUserId;
    }

    console.log('Permission check:', { hasPermission, requestingUserRole: requestingUser.role });

    if (!hasPermission) {
      throw new ForbiddenError('Access denied - cannot delete this tenant');
    }

    // Hard delete the tenant (permanent removal)
    await prisma.user.delete({
      where: { id: BigInt(tenantId) },
    });

    console.log('Tenant deleted successfully');
  }

  async deleteUser(requestingUserId: string, requestingUserRole: string, userId: string) {
    console.log('deleteUser called:', { requestingUserId, requestingUserRole, userId });
    
    // Find the user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    console.log('User to delete found:', userToDelete);

    if (!userToDelete) {
      throw new NotFoundError('User not found');
    }

    // Check if the requesting user has permission to delete this user
    let hasPermission = false;

    if (requestingUserRole === 'ADMIN' || requestingUserRole === 'CEO') {
      // Admin and CEO can delete any user
      hasPermission = true;
    } else if (requestingUserRole === 'AGENCY_MANAGER') {
      if (userToDelete.createdBy?.toString() === requestingUserId) {
        hasPermission = true;
      }
    } else if (requestingUserRole === 'PROPRIETARIO' || requestingUserRole === 'INDEPENDENT_OWNER') {
      // Owner can delete tenants they own
      if (userToDelete.role === 'INQUILINO' && userToDelete.ownerId?.toString() === requestingUserId) {
        hasPermission = true;
      }
    } else if (requestingUserRole === 'BROKER') {
      // Broker can delete tenants for properties they manage
      if (userToDelete.role === 'INQUILINO') {
        const tenantProperties = await prisma.property.findMany({
          where: {
            brokerId: BigInt(requestingUserId),
            tenantId: BigInt(userId),
          },
        });
        hasPermission = tenantProperties.length > 0;
      }
    }

    console.log('Permission check:', { hasPermission, requestingUserRole, userToDeleteRole: userToDelete.role });

    if (!hasPermission) {
      throw new ForbiddenError('Access denied - cannot delete this user');
    }

    // Prevent self-deletion
    if (requestingUserId === userId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    // Hard delete the user (permanent removal)
    await prisma.user.delete({
      where: { id: BigInt(userId) },
    });

    console.log('User deleted successfully');
  }

  async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
        agencyId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      ...user,
      id: user.id.toString(),
      agencyId: user.agencyId ? user.agencyId.toString() : null,
      createdAt: user.createdAt?.toISOString?.() || user.createdAt,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
    };
  }

  async updateUser(userId: string, data: UserUpdateDTO) {
    const updated = await prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        ...data,
        birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        name: true,
        phone: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        neighborhood: true,
        city: true,
        state: true,
      },
    });

    return updated;
  }

  async validateDocument(document: string) {
    // Remove non-numeric characters
    const cleanDoc = document.replace(/\D/g, '');
    
    // Basic validation (CPF has 11 digits, CNPJ has 14)
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      return false;
    }

    // TODO: Implement proper CPF/CNPJ validation algorithm
    return true;
  }

  async getRazaoSocialByCnpj(_cnpj: string) {
    // TODO: Implement CNPJ lookup from external API
    // For now, return mock data
    return {
      socialReason: 'Empresa Exemplo LTDA',
    };
  }
}

