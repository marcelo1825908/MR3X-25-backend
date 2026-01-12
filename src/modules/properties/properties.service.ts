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

  /**
   * Determines the correct property status based on tenant, broker, and contract status.
   * Property can be DISPONIVEL when both brokerId and tenantId are set (regardless of nextDueDate).
   * Property cannot be DISPONIVEL if a tenant is linked and a contract exists (even pending signatures).
   * 
   * @param propertyId - The property ID to check
   * @param tenantId - The tenant ID (can be null)
   * @param brokerId - The broker ID (can be null)
   * @param nextDueDate - The next due date (can be null, not required for DISPONIVEL status)
   * @returns The appropriate property status
   */
  async determinePropertyStatus(propertyId: bigint, tenantId: bigint | null, brokerId: bigint | null = null, nextDueDate: Date | null = null): Promise<string> {
    // Check if required fields are set for DISPONIVEL status
    // Property can be DISPONIVEL when both brokerId and tenantId are set
    const hasBroker = !!brokerId;
    const hasTenant = !!tenantId;
    
    // If broker or tenant is missing, property cannot be DISPONIVEL
    if (!hasBroker || !hasTenant) {
      // Return INCOMPLETO if missing required fields
      return 'INCOMPLETO';
    }
    
    // Both broker and tenant are set
    // Now check if tenant has contracts to determine final status
    // If no contract exists, property can be DISPONIVEL (all requirements met)
    
    // Check if there's an active contract (not revoked or terminated)
    const activeContract = await this.prisma.contract.findFirst({
      where: {
        propertyId: propertyId,
        tenantId: tenantId,
        deleted: false,
        status: {
          notIn: ['REVOGADO', 'ENCERRADO', 'TERMINATED', 'REVOKED'],
        },
      },
      select: {
        status: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If there's a contract (even pending), property cannot be DISPONIVEL
    if (activeContract) {
      const contractStatus = (activeContract.status || '').toUpperCase();
      
      // Contract is active/signed - property is occupied
      if (contractStatus === 'ATIVO' || contractStatus === 'ACTIVE' || 
          contractStatus === 'ASSINADO' || contractStatus === 'SIGNED') {
        return 'ALUGADO';
      }
      
      // Contract is pending signatures - property is in negotiation
      if (contractStatus === 'PENDENTE' || contractStatus === 'PENDING' ||
          contractStatus === 'AGUARDANDO_ASSINATURAS' || contractStatus === 'AGUARDANDO_ASSINATURA' ||
          contractStatus === 'AWAITING_SIGNATURE' || contractStatus === 'AWAITING_SIGNATURES') {
        return 'EM_NEGOCIACAO';
      }
      
      // For any other contract status (that's not revoked/terminated), property is occupied
      return 'ALUGADO';
    }

    // Both broker and tenant are set and no contract exists
    // Property can be DISPONIVEL (ready/available)
    return 'DISPONIVEL';
  }

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string; ownerId?: string; createdById?: string; brokerId?: string; search?: string }) {
    const { skip = 0, take = 10, agencyId, status, ownerId, createdById, brokerId, search } = params;

    const where: any = { deleted: false };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (createdById) where.createdBy = BigInt(createdById);
    if (brokerId) where.brokerId = BigInt(brokerId); // Realtors can only see properties assigned to them

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

    // Recalculate and fix property status
    // Property can only be DISPONIVEL when ALL of these are set: brokerId, tenantId, and nextDueDate
    const statusUpdates: Promise<void>[] = [];
    const fixedProperties = await Promise.all(
      properties.map(async (p) => {
        // Check if status needs to be recalculated
        // Always recalculate if showing as available, missing required fields, or if status is EM_NEGOCIACAO (might need update if contract is ASSINADO)
        const needsRecalculation = 
          p.status === 'DISPONIVEL' || // Always recalculate if showing as available
          p.status === 'EM_NEGOCIACAO' || // Recalculate if in negotiation (contract might be signed now)
          (!p.brokerId || !p.tenantId || !p.nextDueDate); // Or if missing required fields
        
        if (needsRecalculation) {
          const correctStatus = await this.determinePropertyStatus(
            p.id, 
            p.tenantId, 
            p.brokerId, 
            p.nextDueDate
          );
          if (correctStatus !== p.status) {
            // Queue update in database (don't await to avoid blocking response)
            statusUpdates.push(
              this.prisma.property.update({
                where: { id: p.id },
                data: { status: correctStatus },
              }).then(() => {}).catch(err => console.error(`Error updating property ${p.id} status:`, err))
            );
            // Return corrected status immediately
            return { ...p, status: correctStatus };
          }
        }
        return p;
      })
    );

    // Execute all status updates in parallel (fire and forget)
    if (statusUpdates.length > 0) {
      Promise.all(statusUpdates).catch(err => console.error('Error updating property statuses:', err));
    }

    return {
      data: fixedProperties.map(p => this.serializeProperty(p)),
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

    // Recalculate and fix property status
    // Property can only be DISPONIVEL when ALL of these are set: brokerId, tenantId, and nextDueDate
    const needsRecalculation = 
      property.status === 'DISPONIVEL' || // Always recalculate if showing as available
      (!property.brokerId || !property.tenantId || !property.nextDueDate); // Or if missing required fields
    
    if (needsRecalculation) {
      const correctStatus = await this.determinePropertyStatus(
        property.id, 
        property.tenantId, 
        property.brokerId, 
        property.nextDueDate
      );
      if (correctStatus !== property.status) {
        // Update in database
        await this.prisma.property.update({
          where: { id: property.id },
          data: { status: correctStatus },
        });
        property.status = correctStatus;
      }
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
        // Property Classification
        propertyType: data.propertyType || null,
        useType: data.useType || null,
        // Rural Property Fields
        totalAreaHectares: data.totalAreaHectares || null,
        productiveArea: data.productiveArea || null,
        propertyRegistry: data.propertyRegistry || null,
        ccirNumber: data.ccirNumber || null,
        carNumber: data.carNumber || null,
        itrValue: data.itrValue || null,
        georeferencing: data.georeferencing || null,
        intendedUse: data.intendedUse || null,
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

    // Calculate status for INDEPENDENT_OWNER: only mark as INCOMPLETO if truly missing required data
    if (updated.owner?.role === 'INDEPENDENT_OWNER') {
      // Required fields for a complete property:
      // - address (minimum required)
      // - city (minimum required)
      // - monthlyRent or property value (for rental properties)
      const hasAddress = updated.address && updated.address.trim().length > 0;
      const hasCity = updated.city && updated.city.trim().length > 0;
      const hasRent = updated.monthlyRent && Number(updated.monthlyRent) > 0;
      
      // Only mark as INCOMPLETO if missing essential data
      const isIncomplete = !hasAddress || !hasCity || !hasRent;
      
      if (isIncomplete && updated.status !== 'INCOMPLETO') {
        // Only update status if it's not already INCOMPLETO to avoid unnecessary updates
        await this.prisma.property.update({
          where: { id: BigInt(id) },
          data: { status: 'INCOMPLETO' },
        });
        updated.status = 'INCOMPLETO';
      } else if (!isIncomplete && updated.status === 'INCOMPLETO') {
        // If status is INCOMPLETO but now has all required data, determine correct status
        // based on broker, tenant, nextDueDate and contract status
        const newStatus = await this.determinePropertyStatus(
          BigInt(id), 
          updated.tenantId, 
          updated.brokerId, 
          updated.nextDueDate
        );
        await this.prisma.property.update({
          where: { id: BigInt(id) },
          data: { status: newStatus },
        });
        updated.status = newStatus;
      } else if (!isIncomplete) {
        // Check if status needs to be updated based on broker, tenant, nextDueDate and contracts
        const correctStatus = await this.determinePropertyStatus(
          BigInt(id), 
          updated.tenantId, 
          updated.brokerId, 
          updated.nextDueDate
        );
        if (correctStatus !== updated.status) {
          await this.prisma.property.update({
            where: { id: BigInt(id) },
            data: { status: correctStatus },
          });
          updated.status = correctStatus;
        }
      }
    } else {
      // For all property owners, check if status needs to be updated
      const correctStatus = await this.determinePropertyStatus(
        BigInt(id), 
        updated.tenantId, 
        updated.brokerId, 
        updated.nextDueDate
      );
      if (correctStatus !== updated.status) {
        await this.prisma.property.update({
          where: { id: BigInt(id) },
          data: { status: correctStatus },
        });
        updated.status = correctStatus;
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
        // If status is INCOMPLETO but now has all required fields, determine correct status
        // based on broker, tenant, nextDueDate and contract status
        const newStatus = await this.determinePropertyStatus(
          BigInt(propertyId), 
          updated.tenantId, 
          updated.brokerId, 
          updated.nextDueDate
        );
        await this.prisma.property.update({
          where: { id: BigInt(propertyId) },
          data: { status: newStatus },
        });
        updated.status = newStatus;
      } else {
        // Check if status needs to be updated based on broker, tenant, nextDueDate and contracts
        const correctStatus = await this.determinePropertyStatus(
          BigInt(propertyId), 
          updated.tenantId, 
          updated.brokerId, 
          updated.nextDueDate
        );
        if (correctStatus !== updated.status) {
          await this.prisma.property.update({
            where: { id: BigInt(propertyId) },
            data: { status: correctStatus },
          });
          updated.status = correctStatus;
        }
      }
    } else {
      // For all property owners, check if status needs to be updated
      const correctStatus = await this.determinePropertyStatus(
        BigInt(propertyId), 
        updated.tenantId, 
        updated.brokerId, 
        updated.nextDueDate
      );
      if (correctStatus !== updated.status) {
        await this.prisma.property.update({
          where: { id: BigInt(propertyId) },
          data: { status: correctStatus },
        });
        updated.status = correctStatus;
      }
    }

    return this.serializeProperty(updated);
  }
}
