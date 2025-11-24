import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export class PropertyImagesService {
  // Configure multer for file uploads
  private storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'properties');
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    }
  });

  private upload = multer({
    storage: this.storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only allow image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  getUploadMiddleware() {
    return this.upload.array('images', 20); // Allow up to 20 images
  }

  async uploadImages(propertyId: string, user: { userId: string; role: string; agencyId?: string | null; brokerId?: string | null; }, files: Express.Multer.File[]) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    const hasAgencyAdminAccess = Boolean(
      property.agencyId &&
      user.agencyId &&
      property.agencyId.toString() === user.agencyId &&
      user.role === 'AGENCY_ADMIN'
    );

    const hasManagerAccess = Boolean(
      user.role === 'AGENCY_MANAGER' && property.createdBy?.toString() === user.userId
    );

    const hasBrokerAccess = Boolean(
      property.brokerId && user.role === 'BROKER' && property.brokerId.toString() === user.userId
    );

    const hasPlatformAccess = user.role === 'CEO' || user.role === 'ADMIN';

    const hasAccess =
      property.ownerId?.toString() === user.userId ||
      hasAgencyAdminAccess ||
      hasManagerAccess ||
      hasBrokerAccess ||
      hasPlatformAccess;

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    const uploadedImages = [];

    for (const file of files) {
      const image = await prisma.propertyImage.create({
        data: {
          propertyId: BigInt(propertyId),
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: file.path,
          uploadedBy: BigInt(user.userId),
        },
      });

      uploadedImages.push(image);
    }

    return uploadedImages;
  }

  async getPropertyImagesPublic(propertyId: string) {
    // Public method - no authentication check
    const images = await prisma.propertyImage.findMany({
      where: {
        propertyId: BigInt(propertyId),
      },
      orderBy: [
        { isPrimary: 'desc' },
        { uploadedAt: 'asc' },
      ],
    });

    return images;
  }

  async getPropertyImages(propertyId: string, user: { userId: string; role: string; agencyId?: string | null; brokerId?: string | null; }) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    const hasAgencyAdminAccess = Boolean(
      property.agencyId &&
      user.agencyId &&
      property.agencyId.toString() === user.agencyId &&
      user.role === 'AGENCY_ADMIN'
    );

    const hasManagerAccess = Boolean(
      user.role === 'AGENCY_MANAGER' && property.createdBy?.toString() === user.userId
    );

    const hasBrokerAccess = Boolean(
      property.brokerId && user.role === 'BROKER' && property.brokerId.toString() === user.userId
    );

    const hasPlatformAccess = user.role === 'CEO' || user.role === 'ADMIN';

    const hasAccess =
      property.ownerId?.toString() === user.userId ||
      hasAgencyAdminAccess ||
      hasManagerAccess ||
      hasBrokerAccess ||
      hasPlatformAccess;

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    const images = await prisma.propertyImage.findMany({
      where: {
        propertyId: BigInt(propertyId),
      },
      orderBy: [
        { isPrimary: 'desc' },
        { uploadedAt: 'asc' },
      ],
    });

    return images;
  }

  async setPrimaryImage(propertyId: string, imageId: string, user: { userId: string; role: string; agencyId?: string | null; brokerId?: string | null; }) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    const hasAgencyAdminAccess = Boolean(
      property.agencyId &&
      user.agencyId &&
      property.agencyId.toString() === user.agencyId &&
      user.role === 'AGENCY_ADMIN'
    );

    const hasManagerAccess = Boolean(
      user.role === 'AGENCY_MANAGER' && property.createdBy?.toString() === user.userId
    );

    const hasBrokerAccess = Boolean(
      property.brokerId && user.role === 'BROKER' && property.brokerId.toString() === user.userId
    );

    const hasPlatformAccess = user.role === 'CEO' || user.role === 'ADMIN';

    const hasAccess =
      property.ownerId?.toString() === user.userId ||
      hasAgencyAdminAccess ||
      hasManagerAccess ||
      hasBrokerAccess ||
      hasPlatformAccess;

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    // Check if image exists and belongs to this property
    const image = await prisma.propertyImage.findFirst({
      where: {
        id: BigInt(imageId),
        propertyId: BigInt(propertyId),
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Remove primary flag from all images of this property
    await prisma.propertyImage.updateMany({
      where: {
        propertyId: BigInt(propertyId),
      },
      data: {
        isPrimary: false,
      },
    });

    // Set the selected image as primary
    const updatedImage = await prisma.propertyImage.update({
      where: {
        id: BigInt(imageId),
      },
      data: {
        isPrimary: true,
      },
    });

    return updatedImage;
  }

  async deleteImage(propertyId: string, imageId: string, user: { userId: string; role: string; agencyId?: string | null; brokerId?: string | null; }) {
    const property = await prisma.property.findFirst({
      where: {
        id: BigInt(propertyId),
        deleted: false,
      },
    });

    if (!property) {
      throw new NotFoundError('Property not found');
    }

    const hasAgencyAdminAccess = Boolean(
      property.agencyId &&
      user.agencyId &&
      property.agencyId.toString() === user.agencyId &&
      user.role === 'AGENCY_ADMIN'
    );

    const hasManagerAccess = Boolean(
      user.role === 'AGENCY_MANAGER' && property.createdBy?.toString() === user.userId
    );

    const hasBrokerAccess = Boolean(
      property.brokerId && user.role === 'BROKER' && property.brokerId.toString() === user.userId
    );

    const hasPlatformAccess = user.role === 'CEO' || user.role === 'ADMIN';

    const hasAccess =
      property.ownerId?.toString() === user.userId ||
      hasAgencyAdminAccess ||
      hasManagerAccess ||
      hasBrokerAccess ||
      hasPlatformAccess;

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    // Check if image exists and belongs to this property
    const image = await prisma.propertyImage.findFirst({
      where: {
        id: BigInt(imageId),
        propertyId: BigInt(propertyId),
      },
    });

    if (!image) {
      throw new NotFoundError('Image not found');
    }

    // Delete the file from filesystem
    try {
      if (fs.existsSync(image.path)) {
        fs.unlinkSync(image.path);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete the image record from database
    await prisma.propertyImage.delete({
      where: {
        id: BigInt(imageId),
      },
    });

    // If the deleted image was primary, set another image as primary
    if (image.isPrimary) {
      const remainingImages = await prisma.propertyImage.findMany({
        where: {
          propertyId: BigInt(propertyId),
        },
        orderBy: {
          uploadedAt: 'asc',
        },
        take: 1,
      });

      if (remainingImages.length > 0) {
        await prisma.propertyImage.update({
          where: {
            id: remainingImages[0].id,
          },
          data: {
            isPrimary: true,
          },
        });
      }
    }

    return { success: true };
  }
}
