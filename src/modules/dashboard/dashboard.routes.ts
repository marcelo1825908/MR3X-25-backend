import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const dashboardController = new DashboardController();

// Protected routes
router.use(authenticate);

router.get('/', dashboardController.getDashboard);
router.get('/due-dates', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER', 'GESTOR'), dashboardController.getDueDates);
router.get('/tenant/documents', requireRole('INQUILINO'), dashboardController.getTenantDocuments);
router.get('/tenant/status', requireRole('INQUILINO'), dashboardController.getTenantStatus);

export default router;

