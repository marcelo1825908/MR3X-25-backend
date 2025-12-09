import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFiles, Res } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { PropertiesService } from './properties.service';
import { PropertyImagesService } from './property-images.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Configure multer storage
const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'properties');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// File filter for images only
const imageFileFilter = (_req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

@ApiTags('Properties')
@Controller('properties')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly propertyImagesService: PropertyImagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all properties' })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'agencyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Query('agencyId') agencyId?: string,
    @Query('status') status?: string,
    @Query('ownerId') ownerId?: string,
    @CurrentUser() user?: any,
  ) {
    // Data isolation based on role:
    // - CEO: sees ALL properties
    // - ADMIN: sees only properties they created
    // - INDEPENDENT_OWNER: sees only properties they created (no agencyId)
    // - Agency roles (AGENCY_OWNER, AGENCY_ADMIN, AGENCY_MANAGER, etc.): sees only properties of their agency

    let createdById: string | undefined;
    let effectiveAgencyId: string | undefined = agencyId;

    if (user?.role === 'CEO') {
      // CEO sees all - no filtering
    } else if (user?.role === 'ADMIN') {
      // ADMIN sees only properties they created
      createdById = user.sub;
    } else if (user?.role === 'INDEPENDENT_OWNER') {
      // INDEPENDENT_OWNER sees only their own properties (created by them)
      createdById = user.sub;
    } else if (user?.agencyId) {
      // Agency users see only their agency's properties
      effectiveAgencyId = user.agencyId;
    } else {
      // For any other role without agency, only show their own created properties
      createdById = user?.sub;
    }

    return this.propertiesService.findAll({ skip, take, agencyId: effectiveAgencyId, status, ownerId, createdById });
  }

  // ==================== Property Images Routes ====================
  // These must come BEFORE the generic :id route to avoid conflicts

  @Post(':propertyId/images')
  @ApiOperation({ summary: 'Upload images for a property' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', 20, {
      storage,
      fileFilter: imageFileFilter,
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadImages(
    @Param('propertyId') propertyId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    if (!files || files.length === 0) {
      return { success: false, error: 'No files uploaded' };
    }
    const uploadedImages = await this.propertyImagesService.uploadImages(propertyId, user, files);
    return {
      success: true,
      images: uploadedImages,
      message: `${uploadedImages.length} image(s) uploaded successfully`,
    };
  }

  @Get(':propertyId/images')
  @ApiOperation({ summary: 'Get all images for a property' })
  async getPropertyImages(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: any,
  ) {
    return this.propertyImagesService.getPropertyImages(propertyId, user);
  }

  @Get(':propertyId/images/primary')
  @ApiOperation({ summary: 'Get primary image for a property' })
  async getPrimaryImage(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const images = await this.propertyImagesService.getPropertyImages(propertyId, user);
    const primaryImage = images.find((img: any) => img.isPrimary) || images[0];
    if (!primaryImage) {
      return res.status(404).json({ error: 'No images found' });
    }
    if (fs.existsSync(primaryImage.path)) {
      res.sendFile(path.resolve(primaryImage.path));
    } else {
      res.status(404).json({ error: 'Image file not found' });
    }
  }

  @Put(':propertyId/images/:imageId/primary')
  @ApiOperation({ summary: 'Set an image as primary' })
  async setPrimaryImage(
    @Param('propertyId') propertyId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: any,
  ) {
    const updatedImage = await this.propertyImagesService.setPrimaryImage(propertyId, imageId, user);
    return { success: true, image: updatedImage, message: 'Primary image updated successfully' };
  }

  @Delete(':propertyId/images/:imageId')
  @ApiOperation({ summary: 'Delete an image' })
  async deleteImage(
    @Param('propertyId') propertyId: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: any,
  ) {
    await this.propertyImagesService.deleteImage(propertyId, imageId, user);
    return { success: true, message: 'Image deleted successfully' };
  }

  // ==================== End Property Images Routes ====================

  // ==================== Property Assignment Routes ====================

  @Put(':id/assign-broker')
  @ApiOperation({ summary: 'Assign a broker to a property' })
  async assignBroker(
    @Param('id') id: string,
    @Body() data: { brokerId: string | null },
    @CurrentUser() user: any,
  ) {
    return this.propertiesService.assignBroker(id, data.brokerId, user);
  }

  @Put(':id/assign-tenant')
  @ApiOperation({ summary: 'Assign a tenant to a property' })
  async assignTenant(
    @Param('id') id: string,
    @Body() data: { tenantId?: string | null },
    @CurrentUser() user: any,
  ) {
    return this.propertiesService.assignTenant(id, data, user);
  }

  // ==================== End Property Assignment Routes ====================

  @Get(':id')
  @ApiOperation({ summary: 'Get property by ID' })
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new property' })
  async create(@Body() data: any, @CurrentUser() user: any) {
    return this.propertiesService.create(data, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update property' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.propertiesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete property' })
  async remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.propertiesService.remove(id, userId);
  }
}
