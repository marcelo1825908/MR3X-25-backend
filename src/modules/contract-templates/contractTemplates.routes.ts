import { Router } from 'express';
import { ContractTemplatesController } from './contractTemplates.controller';
import { authenticate } from '../../middlewares/auth';
import { requirePermission } from '../../shared/middleware/rbac.middleware';

const router = Router();
const templatesController = new ContractTemplatesController();

// Public routes (templates can be viewed by authenticated users)
router.use(authenticate);

router.get('/', requirePermission('contracts:read'), templatesController.getAllTemplates);
router.get('/:id', requirePermission('contracts:read'), templatesController.getTemplateById);
router.get('/type/:type', requirePermission('contracts:read'), templatesController.getTemplatesByType);

export default router;


