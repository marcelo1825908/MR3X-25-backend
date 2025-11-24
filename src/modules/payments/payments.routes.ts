import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authenticate, requireRole } from '../../middlewares/auth';
import { requirePermission } from '../../shared/middleware/rbac.middleware';

const router = Router();
const paymentsController = new PaymentsController();

// Protected routes
router.use(authenticate);

router.get('/', requirePermission('payments:read'), paymentsController.getPayments);
router.get('/reports/annual', requirePermission('payments:read'), paymentsController.getAnnualReport);
router.get('/:id', requirePermission('payments:read'), paymentsController.getPaymentById);
router.post('/', requirePermission('payments:create'), paymentsController.createPayment);
router.put('/:id', requirePermission('payments:update'), paymentsController.updatePayment);
router.delete('/:id', requirePermission('payments:delete'), paymentsController.deletePayment);

export default router;

