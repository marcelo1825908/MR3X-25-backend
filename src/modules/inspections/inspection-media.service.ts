import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

interface UploadedMedia {
  id: string;
  inspectionId: string;
  itemIndex?: number;
  room?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  type: 'IMAGE' | 'VIDEO';
  createdAt: Date;
}

@Injectable()
export class InspectionMediaService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadMedia(
    inspectionId: string,
    user: any,
    files: Express.Multer.File[],
    itemIndex?: number,
    room?: string,
  ): Promise<UploadedMedia[]> {
    // Verify inspection exists and user has access
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
      include: { property: true },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    // Check user access
    await this.checkAccess(inspection, user);

    const uploadedMedia: UploadedMedia[] = [];

    for (const file of files) {
      const isVideo = file.mimetype.startsWith('video/');
      const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

      // Create media record in database
      const media = await this.prisma.inspectionMedia.create({
        data: {
          inspectionId: BigInt(inspectionId),
          itemIndex: itemIndex,
          room: room,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          type: mediaType,
          uploadedById: BigInt(user.sub),
        },
      });

      uploadedMedia.push({
        id: media.id.toString(),
        inspectionId: inspectionId,
        itemIndex: media.itemIndex || undefined,
        room: media.room || undefined,
        filename: media.filename,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
        path: media.path,
        url: `/api/inspections/${inspectionId}/media/${media.id}/file`,
        type: mediaType as 'IMAGE' | 'VIDEO',
        createdAt: media.createdAt,
      });
    }

    return uploadedMedia;
  }

  async getInspectionMedia(
    inspectionId: string,
    user: any,
    itemIndex?: number,
  ): Promise<UploadedMedia[]> {
    // Verify inspection exists
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: BigInt(inspectionId) },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    const where: any = {
      inspectionId: BigInt(inspectionId),
    };

    if (itemIndex !== undefined) {
      where.itemIndex = itemIndex;
    }

    const mediaList = await this.prisma.inspectionMedia.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return mediaList.map((media) => ({
      id: media.id.toString(),
      inspectionId: inspectionId,
      itemIndex: media.itemIndex || undefined,
      room: media.room || undefined,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      path: media.path,
      url: `/api/inspections/${inspectionId}/media/${media.id}/file`,
      type: media.type as 'IMAGE' | 'VIDEO',
      createdAt: media.createdAt,
    }));
  }

  async getMediaById(inspectionId: string, mediaId: string): Promise<UploadedMedia | null> {
    const media = await this.prisma.inspectionMedia.findFirst({
      where: {
        id: BigInt(mediaId),
        inspectionId: BigInt(inspectionId),
      },
    });

    if (!media) {
      return null;
    }

    return {
      id: media.id.toString(),
      inspectionId: inspectionId,
      itemIndex: media.itemIndex || undefined,
      room: media.room || undefined,
      filename: media.filename,
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      path: media.path,
      url: `/api/inspections/${inspectionId}/media/${media.id}/file`,
      type: media.type as 'IMAGE' | 'VIDEO',
      createdAt: media.createdAt,
    };
  }

  async deleteMedia(inspectionId: string, mediaId: string, user: any): Promise<void> {
    const media = await this.prisma.inspectionMedia.findFirst({
      where: {
        id: BigInt(mediaId),
        inspectionId: BigInt(inspectionId),
      },
      include: {
        inspection: true,
      },
    });

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Check user access
    await this.checkAccess(media.inspection, user);

    // Delete file from disk
    if (media.path && fs.existsSync(media.path)) {
      try {
        fs.unlinkSync(media.path);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    // Delete from database
    await this.prisma.inspectionMedia.delete({
      where: { id: BigInt(mediaId) },
    });
  }

  private async checkAccess(inspection: any, user: any): Promise<void> {
    // CEO can access all
    if (user.role === 'CEO') {
      return;
    }

    // Agency users can access their agency's inspections
    if (user.agencyId && inspection.agencyId?.toString() === user.agencyId) {
      return;
    }

    // Creator can access their own inspections
    if (inspection.createdById?.toString() === user.sub) {
      return;
    }

    // Inspector can access inspections assigned to them
    if (inspection.inspectorId?.toString() === user.sub) {
      return;
    }

    throw new ForbiddenException('Access denied to this inspection');
  }
}
