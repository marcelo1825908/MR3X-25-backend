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
              complement: true,
              neighborhood: true,
              city: true,
              state: true,
              cep: true,
              nationality: true,
              maritalStatus: true,
              profession: true,
              rg: true,
              birthDate: true,
              employerName: true,
              creci: true,
              bankName: true,
              bankBranch: true,
              bankAccount: true,
              pixKey: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  cnpj: true,
                  address: true,
                  responsible: true,
                }
              }
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
              complement: true,
              neighborhood: true,
              city: true,
              state: true,
              cep: true,
              nationality: true,
              maritalStatus: true,
              profession: true,
              rg: true,
              birthDate: true,
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
            }
          },
          broker: { select: { id: true, name: true, email: true, document: true, creci: true } },
          agency: {
            select: {
              id: true,
              name: true,
              tradeName: true,
              cnpj: true,
              creci: true,
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
            complement: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
            employerName: true,
            creci: true,
            bankName: true,
            bankBranch: true,
            bankAccount: true,
            pixKey: true,
            company: {
              select: {
                id: true,
                name: true,
                cnpj: true,
                address: true,
                responsible: true,
              }
            }
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
            complement: true,
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
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
          }
        },
        broker: { select: { id: true, name: true, email: true, document: true, creci: true } },
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

    const agencyId = data.agencyId || user.agencyId || null;

    const planCheck = await this.plansService.checkPlanLimits(userId, 'property');
    if (!planCheck.allowed) {
      throw new ForbiddenException(planCheck.message || 'Você atingiu o limite de imóveis do seu plano.');
    }

    const token = await this.tokenGenerator.generateToken(TokenEntityType.PROPERTY);

    // Determine initial status: for INDEPENDENT_OWNER, new properties without tenant or nextDueDate should be INCOMPLETO
    let initialStatus = data.status || 'DISPONIVEL';
    if (user.role === 'INDEPENDENT_OWNER' && !data.status) {
      // New properties for INDEPENDENT_OWNER don't have tenant or nextDueDate initially, so should be INCOMPLETO
      initialStatus = 'INCOMPLETO';
    }

    const property = await this.prisma.property.create({
      data: {
        token,
        address: data.address,
        neighborhood: data.neighborhood,
        city: data.city,
        stateNumber: data.stateNumber || data.state,
        cep: data.cep,
        monthlyRent: data.monthlyRent,
        status: initialStatus,
        name: data.name,
        dueDay: data.dueDay,
        ownerId: data.ownerId ? BigInt(data.ownerId) : BigInt(userId),
        agencyId: agencyId ? BigInt(agencyId) : null,
        brokerId: data.brokerId ? BigInt(data.brokerId) : null,
        createdBy: BigInt(userId),
        registrationNumber: data.registrationNumber || null,
        builtArea: data.builtArea || null,
        totalArea: data.totalArea || null,
        description: data.description || null,
        furnitureList: data.furnitureList || null,
        condominiumName: data.condominiumName || null,
        condominiumFee: data.condominiumFee || null,
        iptuValue: data.iptuValue || null,
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
        ownerId: true,
      },
    });

    if (!property || property.deleted) {
      throw new NotFoundException('Property not found');
    }

    if (property.isFrozen) {
      throw new ForbiddenException(
        property.frozenReason || 'Este imóvel está congelado. Faça upgrade do seu plano.'
      );
    }

    const updateData: any = { ...data };
    if (data.ownerId) updateData.ownerId = BigInt(data.ownerId);
    if (data.tenantId !== undefined) {
      updateData.tenantId = data.tenantId ? BigInt(data.tenantId) : null;
    }
    if (data.brokerId) updateData.brokerId = BigInt(data.brokerId);
    if (data.agencyId) updateData.agencyId = BigInt(data.agencyId);
    if (data.state !== undefined && data.stateNumber === undefined) {
      updateData.stateNumber = data.state;
      delete updateData.state;
    }

    const updated = await this.prisma.property.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            role: true,
          },
        },
        tenant: {
          select: {
            id: true,
          },
        },
        broker: {
          select: {
            id: true,
          },
        },
        agency: {
          select: {
            id: true,
          },
        },
      },
    });

    // Calculate status for INDEPENDENT_OWNER: if missing tenant or nextDueDate, set to INCOMPLETO
    if (updated.owner?.role === 'INDEPENDENT_OWNER') {
      const missingTenant = !updated.tenantId;
      const missingNextDue = !updated.nextDueDate;
      
      if (missingTenant || missingNextDue) {
        // Only update status if it's not already INCOMPLETO to avoid unnecessary updates
        if (updated.status !== 'INCOMPLETO') {
          await this.prisma.property.update({
            where: { id: BigInt(id) },
            data: { status: 'INCOMPLETO' },
          });
          updated.status = 'INCOMPLETO';
        }
      } else if (updated.status === 'INCOMPLETO') {
        // If status is INCOMPLETO but now has both tenant and nextDueDate, change to DISPONIVEL
        await this.prisma.property.update({
          where: { id: BigInt(id) },
          data: { status: 'DISPONIVEL' },
        });
        updated.status = 'DISPONIVEL';
      }
    }

    // Ensure all relations are properly loaded before serialization
    try {
      return this.serializeProperty(updated);
    } catch (error) {
      console.error('Error serializing property:', error);
      console.error('Property data:', JSON.stringify(updated, null, 2));
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(id) },
      include: {
        contracts: { where: { deleted: false }, take: 1 },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.deleted) {
      throw new NotFoundException('Property already deleted');
    }

    if (property.contracts && property.contracts.length > 0) {
      throw new ForbiddenException('Não é possível excluir este imóvel pois possui contratos ativos. Exclua os contratos primeiro.');
    }

    // Hard delete: actually delete from database
    await this.prisma.property.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Property deleted successfully' };
  }

  private serializeProperty(property: any) {
    // Helper function to safely serialize a relation
    const serializeRelation = (rel: any) => {
      if (!rel || rel.id == null) return null;
      try {
        return { ...rel, id: rel.id.toString() };
      } catch (error) {
        return null;
      }
    };

    return {
      ...property,
      id: property.id?.toString() || property.id,
      ownerId: property.ownerId?.toString() || null,
      tenantId: property.tenantId?.toString() || null,
      brokerId: property.brokerId?.toString() || null,
      agencyId: property.agencyId?.toString() || null,
      createdBy: property.createdBy?.toString() || null,
      deletedBy: property.deletedBy?.toString() || null,
      monthlyRent: property.monthlyRent?.toString() || null,
      nextDueDate: property.nextDueDate?.toISOString() || null,
      createdAt: property.createdAt?.toISOString() || null,
      frozenAt: property.frozenAt?.toISOString() || null,
      isFrozen: property.isFrozen || false,
      frozenReason: property.frozenReason || null,
      previousStatus: property.previousStatus || null,
      builtArea: property.builtArea?.toString() || null,
      totalArea: property.totalArea?.toString() || null,
      condominiumFee: property.condominiumFee?.toString() || null,
      iptuValue: property.iptuValue?.toString() || null,
      owner: serializeRelation(property.owner),
      tenant: serializeRelation(property.tenant),
      broker: serializeRelation(property.broker),
      agency: serializeRelation(property.agency),
    };
  }

  async isPropertyFrozen(propertyId: string): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(propertyId) },
      select: { isFrozen: true },
    });
    return property?.isFrozen ?? false;
  }

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
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
            bankName: true,
            bankBranch: true,
            bankAccount: true,
            pixKey: true,
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
            neighborhood: true,
            city: true,
            state: true,
            cep: true,
            nationality: true,
            maritalStatus: true,
            profession: true,
            rg: true,
            birthDate: true,
            bankName: true,
            bankBranch: true,
            bankAccount: true,
            pixKey: true,
            role: true,
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

    // Calculate status for INDEPENDENT_OWNER: if missing tenant or nextDueDate, set to INCOMPLETO
    if (updated.owner?.role === 'INDEPENDENT_OWNER') {
      const missingTenant = !updated.tenantId;
      const missingNextDue = !updated.nextDueDate;
      
      if (missingTenant || missingNextDue) {
        // Only update status if it's not already INCOMPLETO to avoid unnecessary updates
        if (updated.status !== 'INCOMPLETO') {
          await this.prisma.property.update({
            where: { id: BigInt(propertyId) },
            data: { status: 'INCOMPLETO' },
          });
          updated.status = 'INCOMPLETO';
        }
      } else if (updated.status === 'INCOMPLETO') {
        // If status is INCOMPLETO but now has both tenant and nextDueDate, change to DISPONIVEL
        await this.prisma.property.update({
          where: { id: BigInt(propertyId) },
          data: { status: 'DISPONIVEL' },
        });
        updated.status = 'DISPONIVEL';
      }
    }

    return this.serializeProperty(updated);
  }
}
