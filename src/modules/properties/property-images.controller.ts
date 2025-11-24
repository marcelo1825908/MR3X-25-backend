import { Request, Response } from 'express';
import { PropertyImagesService } from './property-images.service';

export class PropertyImagesController {
  private propertyImagesService: PropertyImagesService;

  constructor() {
    this.propertyImagesService = new PropertyImagesService();
  }

  uploadImages = async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const user = req.user!
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const uploadedImages = await this.propertyImagesService.uploadImages(propertyId, user, files);
      
      res.json({
        success: true,
        images: uploadedImages,
        message: `${uploadedImages.length} image(s) uploaded successfully`
      });
    } catch (error: any) {
      console.error('Error uploading images:', error);
      res.status(500).json({ error: error.message || 'Failed to upload images' });
    }
  };

  getPropertyImages = async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const user = req.user!

      const images = await this.propertyImagesService.getPropertyImages(propertyId, user);
      
      res.json(images);
    } catch (error: any) {
      console.error('Error getting property images:', error);
      res.status(500).json({ error: error.message || 'Failed to get images' });
    }
  };

  getPrimaryImagePublic = async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const { imageId } = req.query;

      // Get images without authentication check (public endpoint)
      const images = await this.propertyImagesService.getPropertyImagesPublic(propertyId);
      
      let selectedImage;
      if (imageId) {
        // If specific imageId is requested, find that image
        selectedImage = images.find(img => img.id.toString() === imageId);
      } else {
        // Otherwise, get primary image or first image
        selectedImage = images.find(img => img.isPrimary) || images[0];
      }
      
      if (!selectedImage) {
        return res.status(404).json({ error: 'No images found' });
      }

      // Set CORS headers first
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      
      // Set Content-Type header
      res.setHeader('Content-Type', selectedImage.mimeType || 'image/jpeg');
      
      // Read file and send as buffer to ensure headers are preserved
      const fs = require('fs');
      const path = require('path');
      const fileBuffer = fs.readFileSync(path.resolve(selectedImage.path));
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('Error getting primary image (public):', error);
      res.status(500).json({ error: error.message || 'Failed to get primary image' });
    }
  };

  getPrimaryImage = async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const user = req.user!

      const images = await this.propertyImagesService.getPropertyImages(propertyId, user);
      const primaryImage = images.find(img => img.isPrimary) || images[0];
      
      if (!primaryImage) {
        return res.status(404).json({ error: 'No images found' });
      }

      // Serve the image file
      const fs = require('fs');
      const path = require('path');
      
      if (fs.existsSync(primaryImage.path)) {
        res.sendFile(path.resolve(primaryImage.path));
      } else {
        res.status(404).json({ error: 'Image file not found' });
      }
    } catch (error: any) {
      console.error('Error getting primary image:', error);
      res.status(500).json({ error: error.message || 'Failed to get primary image' });
    }
  };

  setPrimaryImage = async (req: Request, res: Response) => {
    try {
      const { propertyId, imageId } = req.params;
      const user = req.user!

      const updatedImage = await this.propertyImagesService.setPrimaryImage(propertyId, imageId, user);
      
      res.json({
        success: true,
        image: updatedImage,
        message: 'Primary image updated successfully'
      });
    } catch (error: any) {
      console.error('Error setting primary image:', error);
      res.status(500).json({ error: error.message || 'Failed to set primary image' });
    }
  };

  deleteImage = async (req: Request, res: Response) => {
    try {
      const { propertyId, imageId } = req.params;
      const user = req.user!

      const result = await this.propertyImagesService.deleteImage(propertyId, imageId, user);
      
      res.json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting image:', error);
      res.status(500).json({ error: error.message || 'Failed to delete image' });
    }
  };

  getUploadMiddleware() {
    return this.propertyImagesService.getUploadMiddleware();
  }
}
