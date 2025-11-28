import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: { skip?: number; take?: number; agencyId?: string; status?: string; ownerId?: string; createdById?: string }) {
    const { skip = 0, take = 20, agencyId, status, ownerId, createdById } = params;

    const where: any = { deleted: false };
    if (agencyId) where.agencyId = BigInt(agencyId);
    if (status) where.status = status;
    if (ownerId) where.ownerId = BigInt(ownerId);
    if (createdById) where.createdBy = BigInt(createdById);

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          tenant: { select: { id: true, name: true, email: true } },
          broker: { select: { id: true, name: true, email: true } },
          agency: { select: { id: true, name: true } },
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
        owner: { select: { id: true, name: true, email: true, phone: true } },
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        broker: { select: { id: true, name: true, email: true } },
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

  async create(data: any, userId: string) {
    const property = await this.prisma.property.create({
      data: {
        address: data.address,
        neighborhood: data.neighborhood,
        city: data.city,
        cep: data.cep,
        monthlyRent: data.monthlyRent,
        status: data.status || 'DISPONIVEL',
        name: data.name,
        dueDay: data.dueDay,
        ownerId: data.ownerId ? BigInt(data.ownerId) : null,
        agencyId: data.agencyId ? BigInt(data.agencyId) : null,
        brokerId: data.brokerId ? BigInt(data.brokerId) : null,
        createdBy: BigInt(userId),
      },
    });

    return this.serializeProperty(property);
  }

  async update(id: string, data: any) {
    const property = await this.prisma.property.findUnique({
      where: { id: BigInt(id) },
    });

    if (!property || property.deleted) {
      throw new NotFoundException('Property not found');
    }

    const updateData: any = { ...data };
    if (data.ownerId) updateData.ownerId = BigInt(data.ownerId);
    if (data.tenantId) updateData.tenantId = BigInt(data.tenantId);
    if (data.brokerId) updateData.brokerId = BigInt(data.brokerId);
    if (data.agencyId) updateData.agencyId = BigInt(data.agencyId);

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

    // Soft delete the property
    await this.prisma.property.update({
      where: { id: BigInt(id) },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: BigInt(userId),
      },
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
      owner: property.owner ? { ...property.owner, id: property.owner.id.toString() } : null,
      tenant: property.tenant ? { ...property.tenant, id: property.tenant.id.toString() } : null,
      broker: property.broker ? { ...property.broker, id: property.broker.id.toString() } : null,
      agency: property.agency ? { ...property.agency, id: property.agency.id.toString() } : null,
    };
  }
}
