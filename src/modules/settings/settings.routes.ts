import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const settingsController = new SettingsController();

// All routes require authentication
router.use(authenticate);

// Get payment configuration (readable by all authenticated users)
router.get('/payment-config', settingsController.getPaymentConfig);

// Update payment configuration (only CEO, ADMIN, and AGENCY_ADMIN)
router.put('/payment-config', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN'), settingsController.updatePaymentConfig);

// Generic settings endpoints (only CEO and ADMIN)
router.get('/:key', requireRole('CEO', 'ADMIN'), settingsController.getSetting);
router.put('/:key', requireRole('CEO', 'ADMIN'), settingsController.updateSetting);
router.get('/', requireRole('CEO', 'ADMIN'), settingsController.getAllSettings);

export default router;

