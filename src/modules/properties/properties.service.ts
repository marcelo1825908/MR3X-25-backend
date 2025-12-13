import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PlanEnforcementService, PLAN_MESSAGES } from '../plans/plan-enforcement.service';
import { TokenGeneratorService, TokenEntityType } from '../common/services/token-generator.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PropertiesService {
  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
    private planEnforcement: PlanEnforcementService,
    private tokenGenerator: TokenGeneratorService,
  ) {}

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string; ownerId?: string; createdById?: string; search?: string }) {
    const { skip = 0, take = 10, agencyId, status, ownerId, createdById, search } = params;

    const where: any = { deleted: false };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (createdById) where.createdBy = BigInt(createdById);

    // Add search filter for name, address, or owner/broker name
    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm } },
        { address: { contains: searchTerm } },
        { city: { contains: searchTerm } },
        { neighborhood: { contains: searchTerm } },
        { owner: { name: { contains: searchTerm } } },
        { broker: { name: { contains: searchTerm } } },
        { tenant: { name: { contains: searchTerm } } },
      ];
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              document: true,
              address: true,
              number: true,
              neighborhood: true,
              city: true,
              state: true,
              cep: true,
              nationality: true,
              maritalStatus: true,
              profession: true,
              rg: true,
              birthDate: true,
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              document: true,
              address: true,
              number: true,
              neighborhood: true,
              city: true,
              state: true,
              cep: true,
              nationality: true,
              maritalStatus: true,
              profession: true,
              rg: true,
              birthDate: true,
            }
          },
          broker: { select: { id: true, name: true, email: true, document: true } },
          agency: {
            select: {
              id: true,
              name: true,
              tradeName: true,
              cnpj: true,
              creci: true,
              creciState: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              state: true,
              zipCode: true,
              representativeName: true,
              representativeDocument: true,
            }
          },
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      data: properties.map(p => this.serializeProperty(p)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(id) },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
          }
        },
        broker: { select: { id: true, name: true, email: true, document: true } },
        agency: true,
        images: true,
        contracts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!property || property.deleted) {
      throw new NotFoundException('Property not found');
    }

    return this.serializeProperty(property);
  }

  async create(data: any, user: { sub: string; role: string; agencyId?: string | null }) {
    const userId = user.sub;

    // Determine the agencyId - use from data if provided, otherwise use user's agencyId
    const agencyId = data.agencyId || user.agencyId || null;

    // Check plan limits for INDEPENDENT_OWNER users
    const planCheck = await this.plansService.checkPlanLimits(userId, 'property');
    if (!planCheck.allowed) {
      throw new ForbiddenException(planCheck.message || 'Você atingiu o limite de imóveis do seu plano.');
    }

    // Note: Property creation is no longer limited by plan - only contract limits apply

    // Generate unique MR3X token for the property
    const token = await this.tokenGenerator.generateToken(TokenEntityType.PROPERTY);

    const property = await this.prisma.property.create({
      data: {
        token,
        address: data.address,
        neighborhood: data.neighborhood,
        city: data.city,
        stateNumber: data.stateNumber || data.state,
        cep: data.cep,
        monthlyRent: data.monthlyRent,
        status: data.status || 'DISPONIVEL',
        name: data.name,
        dueDay: data.dueDay,
        ownerId: data.ownerId ? BigInt(data.ownerId) : BigInt(userId),
        agencyId: agencyId ? BigInt(agencyId) : null,
        brokerId: data.brokerId ? BigInt(data.brokerId) : null,
        createdBy: BigInt(userId),
      },
    });

    return this.serializeProperty(property);
  }

  async update(id: string, data: any) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        deleted: true,
        isFrozen: true,
        frozenReason: true,
        agencyId: true,
      },
    });

    if (!property || property.deleted) {
      throw new NotFoundException('Property not found');
    }

    // Check if property is frozen
    if (property.isFrozen) {
      throw new ForbiddenException(
        property.frozenReason || 'Este imóvel está congelado. Faça upgrade do seu plano.'
      );
    }

    const updateData: any = { ...data };
    if (data.ownerId) updateData.ownerId = BigInt(data.ownerId);
    if (data.tenantId) updateData.tenantId = BigInt(data.tenantId);
    if (data.brokerId) updateData.brokerId = BigInt(data.brokerId);
    if (data.agencyId) updateData.agencyId = BigInt(data.agencyId);
    // Handle state field - frontend may send 'state' or 'stateNumber', database uses 'stateNumber'
    if (data.state !== undefined && data.stateNumber === undefined) {
      updateData.stateNumber = data.state;
      delete updateData.state;
    }

    const updated = await this.prisma.property.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    return this.serializeProperty(updated);
  }

  async remove(id: string, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(id) },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Get all images for this property to delete from filesystem
    const images = await this.prisma.propertyImage.findMany({
      where: { propertyId: BigInt(id) },
    });

    // Delete image files from filesystem
    for (const image of images) {
      try {
        if (image.path && fs.existsSync(image.path)) {
          fs.unlinkSync(image.path);
        }
      } catch (error) {
        console.error(`Error deleting image file ${image.path}:`, error);
      }
    }

    // Delete property images from database
    await this.prisma.propertyImage.deleteMany({
      where: { propertyId: BigInt(id) },
    });

    // Hard delete the property (permanently remove from database)
    await this.prisma.property.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Property deleted successfully' };
  }

  private serializeProperty(property: any) {
    return {
      ...property,
      id: property.id.toString(),
      ownerId: property.ownerId?.toString(),
      tenantId: property.tenantId?.toString(),
      brokerId: property.brokerId?.toString(),
      agencyId: property.agencyId?.toString(),
      createdBy: property.createdBy?.toString(),
      deletedBy: property.deletedBy?.toString(),
      monthlyRent: property.monthlyRent?.toString(),
      nextDueDate: property.nextDueDate?.toISOString() || null,
      createdAt: property.createdAt?.toISOString() || null,
      frozenAt: property.frozenAt?.toISOString() || null,
      isFrozen: property.isFrozen || false,
      frozenReason: property.frozenReason || null,
      previousStatus: property.previousStatus || null,
      owner: property.owner ? { ...property.owner, id: property.owner.id.toString() } : null,
      tenant: property.tenant ? { ...property.tenant, id: property.tenant.id.toString() } : null,
      broker: property.broker ? { ...property.broker, id: property.broker.id.toString() } : null,
      agency: property.agency ? { ...property.agency, id: property.agency.id.toString() } : null,
    };
  }

  /**
   * Check if a property is frozen
   */
  async isPropertyFrozen(propertyId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { isFrozen: true },
    });
    return property?.isFrozen ?? false;
  }

  /**
   * Assign a broker to a property
   */
  async assignBroker(propertyId: string, brokerId: string | null, user: any) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { id: true, deleted: true, isFrozen: true, frozenReason: true, agencyId: true },
    });

    if (!property || property.deleted) {
      throw new NotFoundException('Property not found');
    }

    if (property.isFrozen) {
      throw new ForbiddenException(
        property.frozenReason || 'Este imóvel está congelado. Faça upgrade do seu plano.'
      );
    }

    const updated = await this.prisma.property.update({
      where: { id: BigInt(propertyId) },
      data: {
        brokerId: brokerId ? BigInt(brokerId) : null,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
          }
        },
        broker: { select: { id: true, name: true, email: true, document: true } },
        agency: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            cnpj: true,
            creci: true,
            creciState: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            representativeName: true,
            representativeDocument: true,
          }
        },
      },
    });

    return this.serializeProperty(updated);
  }

  /**
   * Assign a tenant to a property
   */
  async assignTenant(propertyId: string, data: { tenantId?: string | null }, user: any) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { id: true, deleted: true, isFrozen: true, frozenReason: true },
    });

    if (!property || property.deleted) {
      throw new NotFoundException('Property not found');
    }

    if (property.isFrozen) {
      throw new ForbiddenException(
        property.frozenReason || 'Este imóvel está congelado. Faça upgrade do seu plano.'
      );
    }

    const updated = await this.prisma.property.update({
      where: { id: BigInt(propertyId) },
      data: {
        tenantId: data.tenantId ? BigInt(data.tenantId) : null,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            number: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
          }
        },
        broker: { select: { id: true, name: true, email: true, document: true } },
        agency: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            cnpj: true,
            creci: true,
            creciState: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            representativeName: true,
            representativeDocument: true,
          }
        },
      },
    });

    return this.serializeProperty(updated);
  }
}
