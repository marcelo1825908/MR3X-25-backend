import { Router } from 'express';
import { AgenciesController } from './agencies.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const agenciesController = new AgenciesController();

// All routes require authentication
router.use(authenticate);

// CEO and ADMIN can manage agencies
router.post('/', requireRole('CEO', 'ADMIN'), agenciesController.createAgency);
router.get('/', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER'), agenciesController.getAgencies);
router.get('/:id', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER'), agenciesController.getAgencyById);
router.put('/:id', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN'), agenciesController.updateAgency);
router.delete('/:id', requireRole('CEO', 'ADMIN'), agenciesController.deleteAgency);

export default router;

