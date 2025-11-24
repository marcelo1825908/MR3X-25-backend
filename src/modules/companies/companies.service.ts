import { prisma } from '../../config/database';
import { AppError, NotFoundError } from '../../shared/errors/AppError';

export interface CompanyCreateDTO {
  name: string;
  cnpj: string;
  address: string;
  responsible: string;
  contacts?: string;
  plan?: string;
  propertyLimit?: number;
  contractDate?: string;
  nfseDocument?: string;
  serviceContract?: string;
}

export interface CompanyUpdateDTO {
  name?: string;
  address?: string;
  responsible?: string;
  contacts?: string;
  plan?: string;
  propertyLimit?: number;
  contractDate?: string;
  nfseDocument?: string;
  serviceContract?: string;
}

export class CompaniesService {
  async createCompany(data: CompanyCreateDTO) {
    const existingCompany = await prisma.company.findUnique({
      where: { cnpj: data.cnpj },
    });

    if (existingCompany) {
      throw new AppError('Company with this CNPJ already exists', 400);
    }

    const company = await prisma.company.create({
      data: {
        ...data,
        contractDate: data.contractDate ? new Date(data.contractDate) : null,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        address: true,
        responsible: true,
        contacts: true,
        plan: true,
        propertyLimit: true,
        contractDate: true,
        nfseDocument: true,
        serviceContract: true,
        createdAt: true,
      },
    });

    return company;
  }

  async getCompanies() {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        cnpj: true,
        address: true,
        responsible: true,
        contacts: true,
        plan: true,
        propertyLimit: true,
        contractDate: true,
        nfseDocument: true,
        serviceContract: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return companies;
  }

  async getCompanyById(id: string) {
    const company = await prisma.company.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        name: true,
        cnpj: true,
        address: true,
        responsible: true,
        contacts: true,
        plan: true,
        propertyLimit: true,
        contractDate: true,
        nfseDocument: true,
        serviceContract: true,
        createdAt: true,
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
      },
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    return company;
  }

  async updateCompany(id: string, data: CompanyUpdateDTO) {
    const company = await prisma.company.findUnique({
      where: { id: BigInt(id) },
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    const updated = await prisma.company.update({
      where: { id: BigInt(id) },
      data: {
        ...data,
        contractDate: data.contractDate ? new Date(data.contractDate) : undefined,
      },
      select: {
        id: true,
        name: true,
        cnpj: true,
        address: true,
        responsible: true,
        contacts: true,
        plan: true,
        propertyLimit: true,
        contractDate: true,
        nfseDocument: true,
        serviceContract: true,
        createdAt: true,
      },
    });

    return updated;
  }

  async deleteCompany(id: string) {
    const company = await prisma.company.findUnique({
      where: { id: BigInt(id) },
      include: {
        users: true,
      },
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    if (company.users.length > 0) {
      throw new AppError('Cannot delete company with associated users', 400);
    }

    await prisma.company.delete({
      where: { id: BigInt(id) },
    });

    return { message: 'Company deleted successfully' };
  }

  async validateCnpj(cnpj: string) {
    // Remove non-numeric characters
    const cleanCnpj = cnpj.replace(/\D/g, '');
    
    // Basic validation (CNPJ has 14 digits)
    if (cleanCnpj.length !== 14) {
      return false;
    }

    // TODO: Implement proper CNPJ validation algorithm
    return true;
  }

  async getCompanyByCnpj(cnpj: string) {
    const company = await prisma.company.findUnique({
      where: { cnpj },
      select: {
        id: true,
        name: true,
        cnpj: true,
        address: true,
        responsible: true,
        plan: true,
        propertyLimit: true,
      },
    });

    return company;
  }
}
