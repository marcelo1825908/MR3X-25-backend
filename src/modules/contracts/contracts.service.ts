import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError, AppError } from '../../shared/errors/AppError';
import { ContractCreateDTO, ContractUpdateDTO, ContractDefaultDTO } from './contracts.dto';
import { generateContractPDF } from './pdf.service';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '../../shared/utils/audit-logger';
import { generateContractToken, generateContractHash } from '../../shared/utils/contract-security';
import { getTemplateById } from '../contract-templates/contractTemplates';

export class ContractsService {
  async getContracts(userId: string, role: string, userAgencyId?: string, userBrokerId?: string) {
    const where: any = { deleted: false };

    // CEO and ADMIN can see all contracts
    if (role === 'CEO' || role === 'ADMIN') {
      // No additional filtering - can see all contracts
    }
    // AGENCY_ADMIN can see all contracts in their agency
    else if (role === 'AGENCY_ADMIN') {
      if (userAgencyId) {
        where.agencyId = BigInt(userAgencyId);
      } else {
        where.id = BigInt(-1);
      }
    }
    // AGENCY_MANAGER can see contracts for:
    // 1. Properties they created
    // 2. Properties created by brokers they manage
    else if (role === 'AGENCY_MANAGER') {
      // Find all brokers managed by this manager (brokers created by this manager)
      const managedBrokers = await prisma.user.findMany({
        where: {
          role: 'BROKER',
          createdBy: BigInt(userId),
          ...(userAgencyId ? { agencyId: BigInt(userAgencyId) } : {}),
        },
        select: { id: true },
      });
      
      const managedBrokerIds = managedBrokers.map(b => b.id);
      
      // Manager sees contracts for properties:
      // 1. Created by the manager themselves
      // 2. Created by brokers managed by this manager
      const propertyFilters: any[] = [
        { createdBy: BigInt(userId) },
      ];
      
      if (managedBrokerIds.length > 0) {
        propertyFilters.push({ createdBy: { in: managedBrokerIds } });
      }
      
      where.AND = where.AND || [];
      where.AND.push({
        property: {
          OR: propertyFilters,
        },
      });
      
      // Also filter by agencyId if provided (to ensure contracts belong to the same agency)
      if (userAgencyId) {
        where.AND.push({ agencyId: BigInt(userAgencyId) });
      }
    }
    // BROKER can see contracts for properties:
    // 1. Assigned to them (brokerId = broker.id)
    // 2. Created by themselves (createdBy = broker.id)
    else if (role === 'BROKER') {
      const brokerFilterId = userBrokerId ? BigInt(userBrokerId) : BigInt(userId);
      where.property = {
        OR: [
          { brokerId: brokerFilterId },
          { createdBy: brokerFilterId },
        ],
      };
    }
    // PROPRIETARIO can only see contracts for their properties
    else if (role === 'PROPRIETARIO') {
      where.property = {
        ownerId: BigInt(userId),
      };
    }
    // INDEPENDENT_OWNER can only see contracts for their properties
    else if (role === 'INDEPENDENT_OWNER') {
      where.property = {
        ownerId: BigInt(userId),
      };
    }
    // INQUILINO can only see their own contracts
    else if (role === 'INQUILINO') {
      where.tenantId = BigInt(userId);
    }
    // LEGAL_AUDITOR can see all contracts (read-only)
    else if (role === 'LEGAL_AUDITOR') {
      // No additional filtering - can see all contracts
    }
    // Other roles have no access
    else {
      where.id = BigInt(-1); // This will return no results
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            neighborhood: true,
            createdBy: true,
          },
        },
        tenantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
          },
        },
        ownerUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Serialize BigInt fields for JSON response
    return contracts.map(contract => ({
      ...contract,
      id: contract.id.toString(),
      propertyId: contract.propertyId?.toString() || null,
      tenantId: contract.tenantId?.toString() || null,
      ownerId: contract.ownerId?.toString() || null,
      property: contract.property ? {
        ...contract.property,
        id: contract.property.id.toString(),
        createdBy: contract.property.createdBy?.toString() || null,
      } : null,
      tenantUser: contract.tenantUser ? {
        ...contract.tenantUser,
        id: contract.tenantUser.id.toString(),
      } : null,
      ownerUser: contract.ownerUser ? {
        ...contract.ownerUser,
        id: contract.ownerUser.id.toString(),
      } : null,
    }));
  }

  async getContractById(contractId: string, userId: string, role: string, userAgencyId?: string) {
    const contract = await prisma.contract.findFirst({
      where: {
        id: BigInt(contractId),
        deleted: false,
      },
      include: {
        property: {
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
          },
        },
        tenantUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            city: true,
            state: true,
          },
        },
        ownerUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    // Check access permissions based on role
    if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      if (contract.property.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'INQUILINO') {
      if (contract.tenantId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_ADMIN') {
      // AGENCY_ADMIN can view contracts in their agency
      const contractAgencyId = contract.agencyId?.toString();
      if (userAgencyId && contractAgencyId !== userAgencyId) {
        throw new ForbiddenError('Access denied');
      }
      if (!userAgencyId && contractAgencyId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      // AGENCY_MANAGER can view contracts for:
      // 1. Properties they created
      // 2. Properties created by brokers they manage
      if (contract.property.createdBy?.toString() !== userId) {
        // Check if property was created by a broker managed by this manager
        const propertyCreator = await prisma.user.findUnique({
          where: { id: contract.property.createdBy || BigInt(0) },
          select: { role: true, createdBy: true },
        });
        
        if (!(propertyCreator?.role === 'BROKER' && propertyCreator.createdBy?.toString() === userId)) {
          throw new ForbiddenError('Access denied');
        }
      }
    } else if (role === 'BROKER') {
      // BROKER can view contracts for properties:
      // 1. Assigned to them (brokerId = broker.id)
      // 2. Created by themselves (createdBy = broker.id)
      const hasPermission = 
        contract.property.brokerId?.toString() === userId ||
        contract.property.createdBy?.toString() === userId;
      
      if (!hasPermission) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role !== 'ADMIN' && role !== 'CEO' && role !== 'LEGAL_AUDITOR') {
      throw new ForbiddenError('Access denied');
    }

    // Serialize BigInt fields for JSON response
    return {
      ...contract,
      id: contract.id.toString(),
      propertyId: contract.propertyId?.toString() || null,
      tenantId: contract.tenantId?.toString() || null,
      ownerId: contract.ownerId?.toString() || null,
      agencyId: contract.agencyId?.toString() || null,
      monthlyRent: contract.monthlyRent ? contract.monthlyRent.toString() : null,
      deposit: contract.deposit ? contract.deposit.toString() : null,
      dueDay: contract.dueDay ? contract.dueDay.toString() : null,
      creci: contract.creci || null,
      contractToken: contract.contractToken || null,
      contractHash: contract.contractHash || null,
      templateId: contract.templateId || null,
      templateType: contract.templateType || null,
      clientIP: contract.clientIP || null,
      userAgent: contract.userAgent || null,
      property: contract.property ? {
        ...contract.property,
        id: contract.property.id.toString(),
        ownerId: contract.property.ownerId?.toString() || null,
        agencyId: contract.property.agencyId?.toString() || null,
        brokerId: contract.property.brokerId?.toString() || null,
        tenantId: contract.property.tenantId?.toString() || null,
        createdBy: contract.property.createdBy?.toString() || null,
        monthlyRent: contract.property.monthlyRent ? contract.property.monthlyRent.toString() : null,
        deposit: contract.property.deposit ? contract.property.deposit.toString() : null,
        dueDay: contract.property.dueDay ? contract.property.dueDay.toString() : null,
        owner: contract.property.owner ? {
          ...contract.property.owner,
          id: contract.property.owner.id.toString(),
        } : null,
      } : null,
      tenantUser: contract.tenantUser ? {
        ...contract.tenantUser,
        id: contract.tenantUser.id.toString(),
      } : null,
      ownerUser: contract.ownerUser ? {
        ...contract.ownerUser,
        id: contract.ownerUser.id.toString(),
      } : null,
    };
  }

  async createContract(
    userId: string, 
    role: string, 
    userAgencyId: string | undefined, 
    data: ContractCreateDTO,
    clientIP: string = '0.0.0.0',
    userAgent: string = ''
  ) {
    // Verify property exists and user has access
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(data.propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    // Check access based on role
    if ((role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') && property.ownerId?.toString() !== userId) {
      throw new ForbiddenError('Access denied: not your property');
    }
    if (role === 'BROKER') {
      // BROKER can create contracts for properties:
      // 1. Assigned to them (brokerId = broker.id)
      // 2. Created by themselves (createdBy = broker.id)
      const hasPermission = 
        property.brokerId?.toString() === userId ||
        property.createdBy?.toString() === userId;
      
      if (!hasPermission) {
        throw new ForbiddenError('Access denied: not your assigned property');
      }
    }
    if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId || property.agencyId?.toString() !== userAgencyId) {
        throw new ForbiddenError('Access denied: property belongs to another agency');
      }
    }
    if (role === 'AGENCY_MANAGER') {
      // AGENCY_MANAGER can create contracts for:
      // 1. Properties they created
      // 2. Properties created by brokers they manage
      if (property.createdBy?.toString() !== userId) {
        // Check if property was created by a broker managed by this manager
        const propertyCreator = await prisma.user.findUnique({
          where: { id: property.createdBy || BigInt(0) },
          select: { role: true, createdBy: true },
        });
        
        if (!(propertyCreator?.role === 'BROKER' && propertyCreator.createdBy?.toString() === userId)) {
          throw new ForbiddenError('Access denied: property not created by you or your managed brokers');
        }
      }
      
      // Also ensure property belongs to the same agency
      if (userAgencyId && property.agencyId) {
        if (property.agencyId.toString() !== userAgencyId) {
          throw new ForbiddenError('Access denied: property belongs to another agency');
        }
      }
    }

    // Verify tenant exists
    const tenant = await prisma.user.findUnique({
      where: { id: BigInt(data.tenantId) },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Determine the correct agencyId based on role
    let finalAgencyId: bigint | null | undefined = property.agencyId;
    
    if (role === 'AGENCY_MANAGER') {
      // For AGENCY_MANAGER: agencyId = manager's own ID (the manager IS the agency)
      finalAgencyId = BigInt(userId);
    } else if (userAgencyId) {
      // For other roles with agencyId: use the provided agencyId
      finalAgencyId = BigInt(userAgencyId);
    }

    // Generate contract token and hash
    const templateType = (data.templateType || 'CTR') as 'CTR' | 'ACD' | 'VST';
    const contractToken = generateContractToken(templateType);
    
    // Create contract data string for hash generation
    const contractDataString = JSON.stringify({
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      startDate: data.startDate,
      endDate: data.endDate,
      monthlyRent: data.monthlyRent,
      timestamp: new Date().toISOString(),
    });
    
    // Get broker/creator name for template
    const creator = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { name: true },
    });
    const brokerName = creator?.name || '';

    // Get template if templateId is provided
    let templateContent: string | null = null;
    if (data.templateId) {
      const template = getTemplateById(data.templateId);
      if (template) {
        templateContent = template.content;
      }
    }

    const contractHash = generateContractHash(contractDataString, clientIP);

    const contract = await prisma.contract.create({
      data: {
        propertyId: BigInt(data.propertyId),
        tenantId: BigInt(data.tenantId),
        ownerId: property.ownerId,
        agencyId: finalAgencyId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        monthlyRent: data.monthlyRent,
        deposit: data.deposit !== undefined ? data.deposit : null,
        dueDay: data.dueDay !== undefined ? data.dueDay : null,
        description: data.description || null,
        status: data.status,
        tenant: tenant.name || undefined,
        creci: data.creci || null,
        contractToken: contractToken,
        contractHash: contractHash,
        templateId: data.templateId || null,
        templateType: templateType,
        clientIP: clientIP,
        userAgent: userAgent,
      },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
      },
    });

    // Generate and save PDF automatically
    try {
      // Get full property and tenant data for PDF generation
      const propertyWithOwner = await prisma.property.findUnique({
        where: { id: BigInt(data.propertyId) },
        include: {
          owner: {
            select: {
              name: true,
              email: true,
              phone: true,
              document: true,
              address: true,
              city: true,
              state: true,
            },
          },
        },
      });

      const tenantData = await prisma.user.findUnique({
        where: { id: BigInt(data.tenantId) },
        select: {
          name: true,
          email: true,
          phone: true,
          document: true,
          address: true,
          city: true,
          state: true,
        },
      });

      if (propertyWithOwner && tenantData && propertyWithOwner.owner) {
        // Generate PDF
        const pdfBuffer = await generateContractPDF({
          property: {
            name: propertyWithOwner.name,
            address: propertyWithOwner.address,
            city: propertyWithOwner.city,
            neighborhood: propertyWithOwner.neighborhood || '',
            monthlyRent: propertyWithOwner.monthlyRent,
          },
          owner: {
            name: propertyWithOwner.owner.name,
            document: propertyWithOwner.owner.document,
            email: propertyWithOwner.owner.email,
            phone: propertyWithOwner.owner.phone,
            address: propertyWithOwner.owner.address,
            city: propertyWithOwner.owner.city,
            state: propertyWithOwner.owner.state,
          },
          tenant: {
            name: tenantData.name,
            document: tenantData.document,
            email: tenantData.email,
            phone: tenantData.phone,
            address: tenantData.address,
            city: tenantData.city,
            state: tenantData.state,
          },
          startDate: data.startDate,
          endDate: data.endDate,
          monthlyRent: Number(data.monthlyRent),
          city: propertyWithOwner.city || 'São Paulo',
          index: 'IGPM',
          contractToken: contractToken,
          contractHash: contractHash,
          creci: data.creci || null,
          templateId: data.templateId || null,
          templateContent: templateContent,
          brokerName: brokerName,
        });

        // Save PDF to disk
        const uniqueFilename = `${uuidv4()}.pdf`;
        const relativePath = `contracts/${uniqueFilename}`;
        const uploadsDir = path.join(process.cwd(), 'uploads', 'contracts');
        
        // Ensure directory exists
        await fs.mkdir(uploadsDir, { recursive: true });
        
        const filePath = path.join(uploadsDir, uniqueFilename);
        await fs.writeFile(filePath, pdfBuffer);

        // Update contract with PDF path
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            pdfPath: relativePath,
          },
        });

        // Update contract object for response
        contract.pdfPath = relativePath;
      }
    } catch (pdfError) {
      console.error('Error generating PDF for contract:', pdfError);
      // Don't fail contract creation if PDF generation fails
      // PDF can be uploaded later
    }

    // Create audit log
    await createAuditLog({
      event: 'CONTRACT_CREATED',
      userId: userId,
      entity: 'CONTRACT',
      entityId: contract.id.toString(),
      dataAfter: {
        propertyId: contract.propertyId.toString(),
        tenantId: contract.tenantId.toString(),
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
      },
    });

    // Serialize BigInt fields for JSON response (same format as getContractById)
    return {
      ...contract,
      id: contract.id.toString(),
      propertyId: contract.propertyId?.toString() || null,
      tenantId: contract.tenantId?.toString() || null,
      ownerId: contract.ownerId?.toString() || null,
      agencyId: contract.agencyId?.toString() || null,
      monthlyRent: contract.monthlyRent ? contract.monthlyRent.toString() : null,
      deposit: contract.deposit ? contract.deposit.toString() : null,
      dueDay: contract.dueDay ? contract.dueDay.toString() : null,
      creci: contract.creci || null,
      contractToken: contract.contractToken || null,
      contractHash: contract.contractHash || null,
      templateId: contract.templateId || null,
      templateType: contract.templateType || null,
      pdfPath: contract.pdfPath || null,
      clientIP: contract.clientIP || null,
      userAgent: contract.userAgent || null,
      property: contract.property ? {
        ...contract.property,
        id: contract.property.id.toString(),
        ownerId: contract.property.ownerId?.toString() || null,
        agencyId: contract.property.agencyId?.toString() || null,
        brokerId: contract.property.brokerId?.toString() || null,
        tenantId: contract.property.tenantId?.toString() || null,
        createdBy: contract.property.createdBy?.toString() || null,
        monthlyRent: contract.property.monthlyRent ? contract.property.monthlyRent.toString() : null,
        deposit: contract.property.deposit ? contract.property.deposit.toString() : null,
        dueDay: contract.property.dueDay ? contract.property.dueDay.toString() : null,
        owner: contract.property.owner ? {
          ...contract.property.owner,
          id: contract.property.owner.id.toString(),
        } : null,
      } : null,
      tenantUser: contract.tenantUser ? {
        ...contract.tenantUser,
        id: contract.tenantUser.id.toString(),
      } : null,
      ownerUser: contract.ownerUser ? {
        ...contract.ownerUser,
        id: contract.ownerUser.id.toString(),
      } : null,
    };
  }

  async updateContract(contractId: string, userId: string, role: string, data: ContractUpdateDTO, userAgencyId?: string | null) {
    const existing = await prisma.contract.findFirst({
      where: {
        id: BigInt(contractId),
        deleted: false,
      },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Contract not found');
    }

    // Check permissions
    const contractAgencyId = existing.agencyId ? existing.agencyId.toString() : null;

    if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId || contractAgencyId !== userAgencyId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      // AGENCY_MANAGER can update contracts for:
      // 1. Properties they created
      // 2. Properties created by brokers they manage
      if (existing.property.createdBy?.toString() !== userId) {
        // Check if property was created by a broker managed by this manager
        const propertyCreator = await prisma.user.findUnique({
          where: { id: existing.property.createdBy || BigInt(0) },
          select: { role: true, createdBy: true },
        });
        
        if (!(propertyCreator?.role === 'BROKER' && propertyCreator.createdBy?.toString() === userId)) {
          throw new ForbiddenError('Access denied');
        }
      }
      
      // Also ensure contract belongs to the same agency
      if (userAgencyId && existing.agencyId) {
        if (existing.agencyId.toString() !== userAgencyId) {
          throw new ForbiddenError('Access denied');
        }
      }
    } else if (role === 'BROKER') {
      // BROKER can update contracts for properties:
      // 1. Assigned to them (brokerId = broker.id)
      // 2. Created by themselves (createdBy = broker.id)
      const hasPermission = 
        existing.property.brokerId?.toString() === userId ||
        existing.property.createdBy?.toString() === userId;
      
      if (!hasPermission) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      if (existing.property.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role !== 'ADMIN' && role !== 'CEO') {
      throw new ForbiddenError('Access denied');
    }

    const dataBefore = {
      startDate: existing.startDate,
      endDate: existing.endDate,
      monthlyRent: existing.monthlyRent,
      deposit: existing.deposit,
      dueDay: existing.dueDay,
      description: existing.description,
      status: existing.status,
    };

    // If propertyId or tenantId is being updated, verify the new values
    if (data.propertyId) {
      const newProperty = await prisma.property.findFirst({
        where: {
          id: BigInt(data.propertyId),
          deleted: false,
        },
      });
      if (!newProperty) {
        throw new NotFoundError('Property not found');
      }
    }

    if (data.tenantId) {
      const newTenant = await prisma.user.findUnique({
        where: { id: BigInt(data.tenantId) },
      });
      if (!newTenant) {
        throw new NotFoundError('Tenant not found');
      }
    }

    const contract = await prisma.contract.update({
      where: { id: BigInt(contractId) },
      data: {
        propertyId: data.propertyId ? BigInt(data.propertyId) : undefined,
        tenantId: data.tenantId ? BigInt(data.tenantId) : undefined,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        monthlyRent: data.monthlyRent !== undefined ? data.monthlyRent : undefined,
        deposit: data.deposit !== undefined ? data.deposit : undefined,
        dueDay: data.dueDay !== undefined ? data.dueDay : undefined,
        description: data.description !== undefined ? data.description : undefined,
        status: data.status,
      },
      include: {
        property: true,
        tenantUser: true,
        ownerUser: true,
      },
    });

    // Create audit log
    await createAuditLog({
      event: 'CONTRACT_UPDATED',
      userId: userId,
      entity: 'CONTRACT',
      entityId: contract.id.toString(),
      dataBefore,
      dataAfter: {
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyRent: contract.monthlyRent,
        deposit: contract.deposit,
        dueDay: contract.dueDay,
        description: contract.description,
        status: contract.status,
      },
    });

    return contract;
  }

  async deleteContract(contractId: string, userId: string, role: string, userAgencyId?: string | null) {
    const existing = await prisma.contract.findFirst({
      where: {
        id: BigInt(contractId),
        deleted: false,
      },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Contract not found');
    }

    // Check permissions
    const contractAgencyId = existing.agencyId ? existing.agencyId.toString() : null;

    if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId || contractAgencyId !== userAgencyId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      // AGENCY_MANAGER can delete contracts for:
      // 1. Properties they created
      // 2. Properties created by brokers they manage
      if (existing.property.createdBy?.toString() !== userId) {
        // Check if property was created by a broker managed by this manager
        const propertyCreator = await prisma.user.findUnique({
          where: { id: existing.property.createdBy || BigInt(0) },
          select: { role: true, createdBy: true },
        });
        
        if (!(propertyCreator?.role === 'BROKER' && propertyCreator.createdBy?.toString() === userId)) {
          throw new ForbiddenError('Access denied');
        }
      }
      
      // Also ensure contract belongs to the same agency
      if (userAgencyId && existing.agencyId) {
        if (existing.agencyId.toString() !== userAgencyId) {
          throw new ForbiddenError('Access denied');
        }
      }
    } else if (role === 'BROKER') {
      // BROKER can delete contracts for properties:
      // 1. Assigned to them (brokerId = broker.id)
      // 2. Created by themselves (createdBy = broker.id)
      const hasPermission = 
        existing.property.brokerId?.toString() === userId ||
        existing.property.createdBy?.toString() === userId;
      
      if (!hasPermission) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
      if (existing.property.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role !== 'ADMIN' && role !== 'CEO') {
      throw new ForbiddenError('Access denied');
    }

    // Delete PDF file if exists
    if (existing.pdfPath) {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, existing.pdfPath);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.log('PDF file not found or already deleted');
      }
    }

    // Create audit log before soft delete
    await createAuditLog({
      event: 'CONTRACT_DELETED',
      userId: userId,
      entity: 'CONTRACT',
      entityId: existing.id.toString(),
      dataBefore: {
        startDate: existing.startDate,
        endDate: existing.endDate,
        monthlyRent: existing.monthlyRent,
        status: existing.status,
      },
    });

    // Soft delete
    await prisma.contract.update({
      where: { id: BigInt(contractId) },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: BigInt(userId),
      },
    });
  }

  async generateDefaultContract(userId: string, data: ContractDefaultDTO) {
    // Get property and related data
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(data.propertyId),
        ownerId: BigInt(userId),
        deleted: false,
      },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            city: true,
            state: true,
          },
        },
        tenant: {
          select: {
            name: true,
            email: true,
            phone: true,
            document: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    if (!property.tenant) {
      throw new AppError('Property has no tenant assigned', 400);
    }

    // Generate PDF
    const pdfBuffer = await generateContractPDF({
      property,
      owner: property.owner,
      tenant: property.tenant,
      startDate: data.startDate,
      endDate: data.endDate,
      monthlyRent: Number(property.monthlyRent || 0),
      city: data.city || property.city || 'São Paulo',
      index: data.index || 'IGPM',
    });

    return pdfBuffer;
  }

  async downloadContract(contractId: string, userId: string, role: string, userAgencyId?: string) {
    // Get contract with proper permission checks
    const contract = await this.getContractById(contractId, userId, role, userAgencyId);

    if (!contract.pdfPath) {
      throw new NotFoundError('Contract PDF not found');
    }

    // Read PDF file from disk
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, contract.pdfPath);

    try {
      const pdfBuffer = await fs.readFile(filePath);
      return pdfBuffer;
    } catch (error) {
      console.error('Error reading PDF file:', error);
      throw new NotFoundError('Contract PDF file not found on disk');
    }
  }

  async uploadContract(contractId: string, userId: string, role: string, pdfBuffer: Buffer, filename?: string, userAgencyId?: string | null) {
    const existing = await prisma.contract.findFirst({
      where: {
        id: BigInt(contractId),
        deleted: false,
      },
      include: {
        property: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Contract not found');
    }

    // Check permissions - same logic as updateContract
    const contractAgencyId = existing.agencyId ? existing.agencyId.toString() : null;

    if (role === 'AGENCY_ADMIN') {
      if (!userAgencyId || contractAgencyId !== userAgencyId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'AGENCY_MANAGER') {
      if (existing.property.createdBy?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role === 'BROKER') {
      if (existing.property.brokerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (role !== 'ADMIN' && role !== 'CEO') {
      if (role === 'PROPRIETARIO' || role === 'INDEPENDENT_OWNER') {
        if (existing.property.ownerId?.toString() !== userId) {
          throw new ForbiddenError('Access denied');
        }
      } else if (existing.property.ownerId?.toString() !== userId) {
        throw new ForbiddenError('Access denied');
      }
    }

    // Delete old PDF file if exists
    if (existing.pdfPath) {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const oldFilePath = path.join(uploadsDir, existing.pdfPath);
      try {
        await fs.unlink(oldFilePath);
      } catch (error) {
        console.log('Old PDF file not found or already deleted');
      }
    }

    // Generate unique filename
    const fileExtension = filename ? path.extname(filename) : '.pdf';
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const relativePath = `contracts/${uniqueFilename}`;
    
    // Save PDF to disk
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, relativePath);
    
    await fs.writeFile(filePath, pdfBuffer);

    // Update database with file path
    await prisma.contract.update({
      where: { id: BigInt(contractId) },
      data: {
        pdfPath: relativePath,
      },
    });

    return relativePath;
  }

  async acceptPatternContract(userId: string, data: ContractDefaultDTO, pdfBuffer: Buffer) {
    // Create contract with PDF
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(data.propertyId),
        ownerId: BigInt(userId),
      },
      include: {
        tenant: true,
      },
    });

    if (!property || !property.tenant) {
      throw new NotFoundError('Property or tenant not found');
    }

    // Generate unique filename and save PDF
    const uniqueFilename = `${uuidv4()}.pdf`;
    const relativePath = `contracts/${uniqueFilename}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, relativePath);
    
    await fs.writeFile(filePath, pdfBuffer);

    const contract = await prisma.contract.create({
      data: {
        propertyId: BigInt(data.propertyId),
        tenantId: property.tenantId!,
        ownerId: BigInt(userId),
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        monthlyRent: property.monthlyRent || 0,
        status: 'ATIVO',
        tenant: property.tenant.name || undefined,
        pdfPath: relativePath,
      },
    });

    // Create audit trail
    await prisma.contractAudit.create({
      data: {
        contractId: contract.id,
        action: 'ACCEPTED',
        performedBy: BigInt(userId),
        details: 'Contrato padrão aceito pelo proprietário',
      },
    });

    return contract;
  }
}

