import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PropertyImagesService } from './property-images.service';

@ApiTags('Property Images (Public)')
@Controller('properties')
export class PropertyImagesPublicController {
  constructor(private readonly propertyImagesService: PropertyImagesService) {}

  @Get(':propertyId/image/public')
  @ApiOperation({ summary: 'Get primary image for a property (public endpoint)' })
  @ApiQuery({ name: 'imageId', required: false, description: 'Optional specific image ID' })
  async getPrimaryImagePublic(
    @Param('propertyId') propertyId: string,
    @Query('imageId') imageId: string,
    @Res() res: Response,
  ) {
    try {
      const images = await this.propertyImagesService.getPropertyImagesPublic(propertyId);

      let selectedImage;
      if (imageId) {
        selectedImage = images.find((img: any) => img.id.toString() === imageId);
      } else {
        selectedImage = images.find((img: any) => img.isPrimary) || images[0];
      }

      if (!selectedImage) {
        return res.status(404).json({ error: 'No images found' });
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      // Reduced cache time and add no-cache for deleted images
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');

      res.setHeader('Content-Type', selectedImage.mimeType || 'image/jpeg');

      const filePath = path.resolve(selectedImage.path);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        res.send(fileBuffer);
      } else {
        res.status(404).json({ error: 'Image file not found' });
      }
    } catch (error: any) {
      console.error('Error getting primary image (public):', error);
      res.status(500).json({ error: error.message || 'Failed to get primary image' });
    }
  }
}
