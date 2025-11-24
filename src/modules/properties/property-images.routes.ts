import { Router } from 'express';
import { PropertyImagesController } from './property-images.controller';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../shared/middleware/rbac.middleware';

const router = Router();
const propertyImagesController = new PropertyImagesController();

// Upload images to a property
router.post(
  '/:propertyId/images',
  authenticate,
  requirePermission('properties:create'),
  propertyImagesController.getUploadMiddleware(),
  propertyImagesController.uploadImages
);

// Get primary image for a property (public endpoint for display)
router.get(
  '/:propertyId/image/public',
  propertyImagesController.getPrimaryImagePublic
);

// Handle CORS preflight for public image endpoint
router.options(
  '/:propertyId/image/public',
  (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
  }
);

// Get all images for a property
router.get(
  '/:propertyId/images',
  authenticate,
  requirePermission('properties:read'),
  propertyImagesController.getPropertyImages
);

// Get primary image for a property
router.get(
  '/:propertyId/image',
  authenticate,
  requirePermission('properties:read'),
  propertyImagesController.getPrimaryImage
);

// Set primary image
router.patch(
  '/:propertyId/images/:imageId/primary',
  authenticate,
  requirePermission('properties:update'),
  propertyImagesController.setPrimaryImage
);

// Delete an image
router.delete(
  '/:propertyId/images/:imageId',
  authenticate,
  requirePermission('properties:update'),
  propertyImagesController.deleteImage
);

export default router;
