import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';

export interface AgencyCreateDTO {
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number;
}

export interface AgencyUpdateDTO {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  plan?: string;
  status?: string;
  maxProperties?: number;
  maxUsers?: number;
  agencyFee?: number; // Commission percentage for this agency (0-100)
}

export class AgenciesService {
  async createAgency(data: AgencyCreateDTO) {
    // Check if agency with this CNPJ already exists
    const cleanCnpj = data.cnpj.replace(/\D/g, '');
    const existingAgency = await prisma.agency.findUnique({
      where: { cnpj: cleanCnpj },
    });

    if (existingAgency) {
      throw new AppError('Agency with this CNPJ already exists', 400);
    }

    // Check if agency with this email already exists
    const existingEmail = await prisma.agency.findFirst({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new AppError('Agency with this email already exists', 400);
    }

    const agency = await prisma.agency.create({
      data: {
        name: data.name,
        cnpj: cleanCnpj,
        email: data.email,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zipCode || null,
        plan: data.plan || 'FREE',
        status: 'ACTIVE',
        maxProperties: data.maxProperties || 5,
        maxUsers: data.maxUsers || 3,
        agencyFee: data.agencyFee ?? 8,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return agency;
  }

  async getAgencies() {
    const agencies = await prisma.agency.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to match frontend expectations
    return agencies.map(agency => ({
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties || 0,
      maxUsers: agency.maxUsers || 0,
      agencyFee: agency.agencyFee ?? 8,
      userCount: agency._count.users,
      propertyCount: agency._count.properties,
    }));
  }

  async getAgencyById(id: string) {
    const agency = await prisma.agency.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        properties: {
          select: {
            id: true,
            name: true,
            address: true,
            status: true,
          },
        },
      },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    return {
      id: agency.id.toString(),
      name: agency.name,
      cnpj: agency.cnpj,
      email: agency.email,
      phone: agency.phone || '',
      address: agency.address || '',
      city: agency.city || '',
      state: agency.state || '',
      zipCode: agency.zipCode || '',
      status: agency.status,
      plan: agency.plan,
      maxProperties: agency.maxProperties,
      maxUsers: agency.maxUsers,
      agencyFee: agency.agencyFee,
      createdAt: agency.createdAt,
      updatedAt: agency.updatedAt,
      users: agency.users.map(u => ({
        id: u.id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
      properties: agency.properties.map(p => ({
        id: p.id.toString(),
        name: p.name,
        address: p.address,
        status: p.status,
      })),
    };
  }

  async updateAgency(id: string, data: AgencyUpdateDTO) {
    const agency = await prisma.agency.findUnique({
      where: { id: BigInt(id) },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    // If email is being updated, check for duplicates
    if (data.email && data.email !== agency.email) {
      const existingEmail = await prisma.agency.findFirst({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new AppError('Agency with this email already exists', 400);
      }
    }

    const updated = await prisma.agency.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        plan: data.plan,
        status: data.status,
        maxProperties: data.maxProperties,
        maxUsers: data.maxUsers,
        agencyFee: data.agencyFee !== undefined ? Math.max(0, Math.min(100, data.agencyFee)) : undefined,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        status: true,
        plan: true,
        maxProperties: true,
        maxUsers: true,
        agencyFee: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            properties: true,
          },
        },
      },
    });

    return {
      id: updated.id.toString(),
      name: updated.name,
      cnpj: updated.cnpj,
      email: updated.email,
      phone: updated.phone || '',
      address: updated.address || '',
      city: updated.city || '',
      state: updated.state || '',
      zipCode: updated.zipCode || '',
      status: updated.status,
      plan: updated.plan,
      maxProperties: updated.maxProperties,
      maxUsers: updated.maxUsers,
      agencyFee: updated.agencyFee,
      propertyCount: updated._count.properties,
      userCount: updated._count.users,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteAgency(id: string) {
    const agency = await prisma.agency.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: true,
        properties: true,
      },
    });

    if (!agency) {
      throw new NotFoundError('Agency not found');
    }

    if (agency.users.length > 0) {
      throw new AppError('Cannot delete agency with associated users', 400);
    }

    if (agency.properties.length > 0) {
      throw new AppError('Cannot delete agency with associated properties', 400);
    }

    await prisma.agency.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Agency deleted successfully' };
  }
}

