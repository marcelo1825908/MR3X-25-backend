import { Router } from 'express';
import { PropertiesController } from './properties.controller';
import { authenticate, requireRole } from '../../middlewares/auth';
import { requirePermission } from '../../shared/middleware/rbac.middleware';
import propertyImagesRoutes from './property-images.routes';

const router = Router();
const propertiesController = new PropertiesController();

// Public routes (before authentication)
router.use('/', propertyImagesRoutes);

// Protected routes
router.use(authenticate);

router.get('/', requirePermission('properties:read'), propertiesController.getProperties);
router.get('/:id', requirePermission('properties:read'), propertiesController.getPropertyById);
router.get('/acordos/:id', requireRole('PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_MANAGER', 'ADMIN', 'BROKER'), propertiesController.getPropertyAgreement);
router.post('/', requirePermission('properties:create'), propertiesController.createProperty);
router.put('/:id', requirePermission('properties:update'), propertiesController.updateProperty);
router.put('/:id/assign-broker', requirePermission('properties:update'), propertiesController.assignBroker);
router.delete('/:id', requirePermission('properties:delete'), propertiesController.deleteProperty);

export default router;

