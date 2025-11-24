import { prisma } from '../../config/database';
import { AppError, NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import { PropertyCreateDTO, PropertyUpdateDTO } from './properties.dto';
import { createAuditLog } from '../../shared/utils/audit-logger';

export class PropertiesService {
  async getProperties(userId: string, role: string, userAgencyId?: string, userBrokerId?: string, search?: string) {
    const where: any = { deleted: false };

    // CEO and ADMIN can see all properties
    if (role === 'CEO' || role === 'ADMIN') {
      // No additional filtering - can see all properties
    }
    // AGENCY_ADMIN can see everything within their agency
    else if (role === 'AGENCY_ADMIN') {
      if (userAgencyId) {
        where.agencyId = BigInt(userAgencyId)
      } else {
        where.id = BigInt(-1)
      }
    }
    // AGENCY_MANAGER can see all properties in their agency
    else if (role === 'AGENCY_MANAGER') {
      where.createdBy = BigInt(userId);
      if (userAgencyId) {
        where.agencyId = BigInt(userAgencyId);
      }
    }
    // BROKER can see properties assigned to them or their agency
    else if (role === 'BROKER') {
      where.brokerId = BigInt(userId);
    }
    // PROPRIETARIO can only see their own properties
    else if (role === 'PROPRIETARIO') {
      where.ownerId = BigInt(userId);
    }
    // INDEPENDENT_OWNER can only see their own properties
    else if (role === 'INDEPENDENT_OWNER') {
      where.ownerId = BigInt(userId);
    }
    // INQUILINO can only see properties they're renting
    else if (role === 'INQUILINO') {
      where.tenantId = BigInt(userId);
    }
    // LEGAL_AUDITOR can see all properties (read-only)
    else if (role === 'LEGAL_AUDITOR') {
      // No additional filtering - can see all properties
    }
    // Other roles have no access
    else {
      where.id = BigInt(-1); // This will return no results
    }

    if (search && search.trim().length > 0) {
      const normalizedSearch = search.trim();
      const searchConditions: any[] = [
        { name: { contains: normalizedSearch } },
        { address: { contains: normalizedSearch } },
        { city: { contains: normalizedSearch } },
        { neighborhood: { contains: normalizedSearch } },
        { stateNumber: { contains: normalizedSearch } },
        { cep: { contains: normalizedSearch } },
        {
          owner: {
            is: {
              OR: [
                { name: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
              ],
            },
          },
        },
        {
          broker: {
            is: {
              OR: [
                { name: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
              ],
            },
          },
        },
        {
          tenant: {
            is: {
              OR: [
                { name: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
              ],
            },
          },
        },
      ];

      where.AND = where.AND || [];
      where.AND.push({ OR: searchConditions });
    }

    const properties = await prisma.property.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        broker: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { uploadedAt: 'asc' },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Serialize BigInt fields and add computed fields
    return properties.map((property: any) => ({
      ...property,
      id: property.id.toString(),
      ownerId: property.ownerId?.toString() || null,
      tenantId: property.tenantId?.toString() || null,
      brokerId: property.brokerId?.toString() || null,
      agencyId: property.agencyId?.toString() || null,
      createdBy: property.createdBy?.toString() || null,
      monthlyRent: property.monthlyRent ? property.monthlyRent.toString() : null,
      deposit: property.deposit ? property.deposit.toString() : null,
      dueDay: property.dueDay ? property.dueDay.toString() : null,
      agencyFee: property.agencyFee ? property.agencyFee.toString() : null,
      tenantName: property.tenant?.name || null,
      owner: property.owner ? {
        ...property.owner,
        id: property.owner.id.toString(),
      } : null,
      tenant: property.tenant ? {
        ...property.tenant,
        id: property.tenant.id.toString(),
      } : null,
      broker: property.broker ? {
        ...property.broker,
        id: property.broker.id.toString(),
      } : null,
    }));
  }

  async getPropertyById(propertyId: string, userId: string, role: string) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
          },
        },
        broker: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { uploadedAt: 'asc' },
          ],
        },
        contracts: {
          where: { deleted: false },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            monthlyRent: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    // Check access permissions
    if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      if (property.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      if (property.createdBy?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'INQUILINO') {
      if (property.tenantId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    }

    // Serialize BigInt fields and add computed fields
    return {
      ...property,
      id: property.id.toString(),
      ownerId: property.ownerId?.toString() || null,
      tenantId: property.tenantId?.toString() || null,
      brokerId: property.brokerId?.toString() || null,
      agencyId: property.agencyId?.toString() || null,
      createdBy: property.createdBy?.toString() || null,
      monthlyRent: property.monthlyRent ? property.monthlyRent.toString() : null,
      deposit: property.deposit ? property.deposit.toString() : null,
      dueDay: property.dueDay ? property.dueDay.toString() : null,
      agencyFee: property.agencyFee ? property.agencyFee.toString() : null,
      tenantName: property.tenant?.name || null,
      owner: property.owner ? {
        ...property.owner,
        id: property.owner.id.toString(),
      } : null,
      tenant: property.tenant ? {
        ...property.tenant,
        id: property.tenant.id.toString(),
      } : null,
      broker: property.broker ? {
        ...property.broker,
        id: property.broker.id.toString(),
      } : null,
      contracts: property.contracts ? property.contracts.map((contract: any) => ({
        ...contract,
        id: contract.id.toString(),
        monthlyRent: contract.monthlyRent ? contract.monthlyRent.toString() : null,
      })) : [],
    };
  }

  async getPropertyAgreement(propertyId: string, userId: string) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        ownerId: BigInt(userId),
        deleted: false,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
          },
        },
        contracts: {
          where: { 
            deleted: false,
            status: 'ATIVO',
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            monthlyRent: true,
            lastPaymentDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    return {
      property: {
        id: property.id,
        address: property.address,
        monthlyRent: property.monthlyRent,
        nextDueDate: property.nextDueDate,
        dueDay: property.dueDay,
      },
      tenant: property.tenant,
      contract: property.contracts[0] || null,
    };
  }

  async createProperty(userId: string, role: string, userAgencyId: string | undefined, userBrokerId: string | undefined, data: PropertyCreateDTO) {
    const payload: any = {
      address: data.address,
      monthlyRent: data.monthlyRent,
      status: data.status,
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      cep: data.cep || '',
      name: data.name,
      nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
      dueDay: data.dueDay ?? null,
      stateNumber: data.stateNumber,
      tenantId: data.tenantId ? BigInt(data.tenantId) : null,
      agencyFee: data.agencyFee !== undefined ? data.agencyFee : null, // Property-specific agency fee (only for AGENCY_MANAGER)
    };

    let ownerRecord: { id: bigint; agencyId: bigint | null } | null = null;
    let resolvedOwnerId: bigint | null = null;
    let resolvedAgencyId: bigint | null = null;

    if (data.ownerId) {
      console.log('createProperty: resolving owner', { ownerId: data.ownerId, role });
      ownerRecord = await prisma.user.findFirst({
        where: {
          id: BigInt(data.ownerId),
          role: 'PROPRIETARIO',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          agencyId: true,
        },
      });

      console.log('createProperty: owner lookup result', ownerRecord);

      if (!ownerRecord) {
        throw new NotFoundError('Owner not found');
      }

      resolvedOwnerId = ownerRecord.id;
      if (ownerRecord.agencyId) {
        resolvedAgencyId = ownerRecord.agencyId;
      }
    }

    if (role === 'AGENCY_MANAGER' || role === 'AGENCY_ADMIN') {
      console.log('createProperty: agency role enforcement', { userAgencyId, resolvedOwnerId, ownerRecord });
      if (!userAgencyId) {
        throw new AppError('Agency context is required to create properties', 400);
      }

      if (!resolvedOwnerId) {
        throw new AppError('Selecione um proprietário para o imóvel', 400);
      }

      if (ownerRecord?.agencyId && ownerRecord.agencyId.toString() !== userAgencyId) {
        const existingAgency = await prisma.agency.findUnique({ where: { id: ownerRecord.agencyId } });
        if (existingAgency) {
          console.warn('createProperty: owner belongs to different existing agency', {
            ownerAgency: ownerRecord.agencyId?.toString(),
            userAgencyId,
          });
          throw new ForbiddenError('Owner does not belong to your agency');
        }
        console.log('createProperty: owner linked to missing agency, reassigning', {
          ownerId: ownerRecord.id.toString(),
          previousAgency: ownerRecord.agencyId?.toString(),
          newAgency: userAgencyId,
        });
        const reassignedOwner = await prisma.user.update({
          where: { id: ownerRecord.id },
          data: { agencyId: BigInt(userAgencyId) },
          select: { id: true, agencyId: true },
        });
        ownerRecord = reassignedOwner;
      }

      if (!ownerRecord?.agencyId) {
        console.log('createProperty: assigning owner to agency', { ownerId: resolvedOwnerId?.toString(), assignAgencyId: userAgencyId });
        const updatedOwner = await prisma.user.update({
          where: { id: resolvedOwnerId },
          data: { agencyId: BigInt(userAgencyId) },
          select: { id: true, agencyId: true },
        });
        ownerRecord = updatedOwner;
      }

      resolvedOwnerId = ownerRecord!.id;
      resolvedAgencyId = BigInt(userAgencyId);
    } else if (role === 'BROKER') {
      if (userBrokerId) {
        payload.brokerId = BigInt(userBrokerId);
      }
      if (userAgencyId) {
        resolvedAgencyId = BigInt(userAgencyId);
      } else if (!resolvedAgencyId && ownerRecord?.agencyId) {
        resolvedAgencyId = ownerRecord.agencyId;
      }
    } else if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      resolvedOwnerId = BigInt(userId);
    } else if (role === 'CEO' || role === 'ADMIN') {
      if (!resolvedAgencyId && ownerRecord?.agencyId) {
        resolvedAgencyId = ownerRecord.agencyId;
      }
    } else {
      if (!resolvedOwnerId) {
        resolvedOwnerId = BigInt(userId);
      }
    }

    payload.ownerId = resolvedOwnerId ?? null;
    payload.createdBy = BigInt(userId);

    if (resolvedAgencyId !== null) {
      payload.agencyId = resolvedAgencyId;
    }

    const property = await prisma.property.create({
      data: payload,
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        tenant: {
          select: { id: true, name: true, email: true }
        },
        broker: {
          select: { id: true, name: true, email: true }
        },
        images: {
          orderBy: [
            { isPrimary: 'desc' },
            { uploadedAt: 'asc' },
          ],
        },
      },
    })

    // Create audit log
    await createAuditLog({
      event: 'PROPERTY_CREATED',
      userId: userId,
      entity: 'PROPERTY',
      entityId: property.id.toString(),
      dataAfter: {
        name: property.name,
        address: property.address,
        agencyId: property.agencyId?.toString(),
        ownerId: property.ownerId?.toString(),
      },
    });

    // Serialize BigInt fields and add computed fields
    return {
      ...property,
      id: property.id.toString(),
      ownerId: property.ownerId?.toString() || null,
      tenantId: property.tenantId?.toString() || null,
      brokerId: property.brokerId?.toString() || null,
      agencyId: property.agencyId?.toString() || null,
      createdBy: property.createdBy?.toString() || null,
      monthlyRent: property.monthlyRent ? property.monthlyRent.toString() : null,
      deposit: property.deposit ? property.deposit.toString() : null,
      dueDay: property.dueDay ? property.dueDay.toString() : null,
      agencyFee: property.agencyFee ? property.agencyFee.toString() : null,
      tenantName: property.tenant?.name || null,
      owner: property.owner ? {
        ...property.owner,
        id: property.owner.id.toString(),
      } : null,
      tenant: property.tenant ? {
        ...property.tenant,
        id: property.tenant.id.toString(),
      } : null,
      broker: property.broker ? {
        ...property.broker,
        id: property.broker.id.toString(),
      } : null,
    };
  }

  async updateProperty(propertyId: string, userId: string, role: string, data: PropertyUpdateDTO, userAgencyId?: string | null) {
    // Check if property exists and user has access
    const existing = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!existing) {
      throw new NotFoundError('Property not found');
    }

    const propertyAgencyId = existing.agencyId ? existing.agencyId.toString() : null;

    // Check access permissions based on role
    if (role === 'ADMIN' || role === 'CEO') {
      // Admin and CEO can update any property
    } else if (role === 'AGENCY_ADMIN') {
      if (propertyAgencyId && userAgencyId && propertyAgencyId !== userAgencyId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      if (existing.createdBy?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'BROKER') {
      // Brokers can update properties assigned to them
      if (existing.brokerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      // Property owners can update their own properties
      if (existing.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      throw new ForbiddenError('Access denied');
    }

    const dataBefore = {
      name: existing.name,
      address: existing.address,
      monthlyRent: existing.monthlyRent,
    };

    const updateData: any = {};

    if (data.address !== undefined) updateData.address = data.address;
    if (data.monthlyRent !== undefined) updateData.monthlyRent = data.monthlyRent;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.neighborhood !== undefined) updateData.neighborhood = data.neighborhood;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.cep !== undefined) updateData.cep = data.cep;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.dueDay !== undefined) updateData.dueDay = data.dueDay;
    if (data.stateNumber !== undefined) updateData.stateNumber = data.stateNumber;
    if (data.agencyFee !== undefined) updateData.agencyFee = data.agencyFee !== null ? data.agencyFee : null; // Property-specific agency fee (only for AGENCY_MANAGER)

    if (data.tenantId !== undefined) {
      // Allow null or empty string to unassign tenant
      if (data.tenantId === null || data.tenantId === '') {
        updateData.tenantId = null;
      } else {
        updateData.tenantId = BigInt(data.tenantId);
      }
    }

    if (data.ownerId !== undefined) {
      if (!data.ownerId) {
        updateData.ownerId = null;
      } else {
        const ownerRecord = await prisma.user.findFirst({
          where: {
            id: BigInt(data.ownerId),
            role: 'PROPRIETARIO',
            status: 'ACTIVE',
          },
          select: {
            id: true,
            agencyId: true,
          },
        });

        if (!ownerRecord) {
          throw new NotFoundError('Owner not found');
        }

        if ((role === 'AGENCY_MANAGER' || role === 'AGENCY_ADMIN') && propertyAgencyId) {
          if (ownerRecord.agencyId && ownerRecord.agencyId.toString() !== propertyAgencyId) {
            const existingAgency = await prisma.agency.findUnique({ where: { id: ownerRecord.agencyId } });
            if (existingAgency) {
              throw new ForbiddenError('Owner does not belong to this agency');
            }
            ownerRecord = await prisma.user.update({
              where: { id: ownerRecord.id },
              data: { agencyId: BigInt(propertyAgencyId) },
              select: { id: true, agencyId: true },
            });
          }
        }

        updateData.ownerId = ownerRecord.id;
      }
    }

    if (data.nextDueDate !== undefined) {
      updateData.nextDueDate = data.nextDueDate ? new Date(data.nextDueDate) : null;
    }

    const property = await prisma.property.update({
      where: { id: BigInt(propertyId) },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        broker: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      event: 'PROPERTY_UPDATED',
      userId: userId,
      entity: 'PROPERTY',
      entityId: property.id.toString(),
      dataBefore,
      dataAfter: {
        name: property.name,
        address: property.address,
        monthlyRent: property.monthlyRent,
      },
    });

    // Serialize BigInt fields and add computed fields
    return {
      ...property,
      id: property.id.toString(),
      ownerId: property.ownerId?.toString() || null,
      tenantId: property.tenantId?.toString() || null,
      brokerId: property.brokerId?.toString() || null,
      agencyId: property.agencyId?.toString() || null,
      createdBy: property.createdBy?.toString() || null,
      monthlyRent: property.monthlyRent ? property.monthlyRent.toString() : null,
      deposit: property.deposit ? property.deposit.toString() : null,
      dueDay: property.dueDay ? property.dueDay.toString() : null,
      agencyFee: property.agencyFee ? property.agencyFee.toString() : null,
      tenantName: property.tenant?.name || null,
      owner: property.owner ? {
        ...property.owner,
        id: property.owner.id.toString(),
      } : null,
      tenant: property.tenant ? {
        ...property.tenant,
        id: property.tenant.id.toString(),
      } : null,
      broker: property.broker ? {
        ...property.broker,
        id: property.broker.id.toString(),
      } : null,
    };
  }

  async deleteProperty(propertyId: string, userId: string, role: string, userAgencyId?: string | null) {
    // Check if property exists and user has access
    const existing = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
      include: {
        images: true, // Include images to delete them
      },
    });

    if (!existing) {
      throw new NotFoundError('Property not found');
    }

    const propertyAgencyId = existing.agencyId ? existing.agencyId.toString() : null;

    // Check access permissions based on role
    if (role === 'ADMIN' || role === 'CEO') {
      // Admin and CEO can delete any property
    } else if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId || propertyAgencyId !== userAgencyId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      if (existing.createdBy?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'BROKER') {
      // Brokers can delete properties assigned to them
      if (existing.brokerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      // Property owners can delete their own properties
      if (existing.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      throw new ForbiddenError('Access denied');
    }

    // Delete associated images from filesystem
    const fs = require('fs');
    const path = require('path');
    
    for (const image of existing.images) {
      try {
        if (fs.existsSync(image.path)) {
          fs.unlinkSync(image.path);
        }
      } catch (error) {
        console.error('Error deleting image file:', error);
      }
    }

    // Explicitly delete images from database first
    await prisma.propertyImage.deleteMany({
      where: {
        propertyId: BigInt(propertyId),
      },
    });

    // Create audit log before deletion
    await createAuditLog({
      event: 'PROPERTY_DELETED',
      userId: userId,
      entity: 'PROPERTY',
      entityId: existing.id.toString(),
      dataBefore: {
        name: existing.name,
        address: existing.address,
        monthlyRent: existing.monthlyRent,
      },
    });

    // Hard delete the property (remove from database)
    await prisma.property.delete({
      where: { id: BigInt(propertyId) },
    });
  }

  async assignBroker(
    propertyId: string,
    user: { userId: string; role: string; agencyId?: string | null },
    brokerId?: string | null,
  ) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
      select: {
        id: true,
        createdBy: true,
        agencyId: true,
        ownerId: true,
        brokerId: true,
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    if (user.role === 'AGENCY_MANAGER' || user.role === 'AGENCY_ADMIN') {
      if (property.createdBy?.toString() !== user.userId) {
        throw new ForbiddenError('Somente imóveis cadastrados por você podem ser atribuídos');
      }
      if (!user.agencyId || property.agencyId?.toString() !== user.agencyId) {
        throw new ForbiddenError('O imóvel pertence a outra agência');
      }
    } else if (user.role === 'ADMIN' || user.role === 'CEO') {
      // platform admins can assign freely
    } else {
      throw new ForbiddenError('Access denied');
    }

    let brokerRecord: { id: bigint; name: string | null; email: string | null; agencyId: bigint | null } | null = null;

    if (brokerId) {
      brokerRecord = await prisma.user.findFirst({
        where: {
          id: BigInt(brokerId),
          role: 'BROKER',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          agencyId: true,
        },
      });

      if (!brokerRecord) {
        throw new NotFoundError('Broker not found');
      }

      if (property.agencyId && brokerRecord.agencyId?.toString() !== property.agencyId.toString()) {
        throw new ForbiddenError('O corretor deve pertencer à mesma agência');
      }
    }

    const updatedProperty = await prisma.property.update({
      where: { id: BigInt(propertyId) },
      data: {
        brokerId: brokerRecord ? brokerRecord.id : null,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        tenant: {
          select: { id: true, name: true, email: true },
        },
        broker: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await createAuditLog({
      event: brokerRecord ? 'PROPERTY_BROKER_ASSIGNED' : 'PROPERTY_BROKER_UNASSIGNED',
      userId: user.userId,
      entity: 'PROPERTY',
      entityId: updatedProperty.id.toString(),
      dataAfter: {
        brokerId: updatedProperty.brokerId ? updatedProperty.brokerId.toString() : null,
      },
    });

    return updatedProperty;
  }
}

