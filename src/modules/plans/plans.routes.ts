import { Router } from 'express';
import { PlansController } from './plans.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const plansController = new PlansController();

router.use(authenticate);

router.get('/', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER', 'INQUILINO'), plansController.getPlans);
router.get('/:id', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER', 'INQUILINO'), plansController.getPlanById);
router.put('/:id', requireRole('CEO', 'ADMIN'), plansController.updatePlan);
router.put('/name/:name', requireRole('CEO', 'ADMIN'), plansController.updatePlanByName);
router.post('/update-counts', requireRole('ADMIN'), plansController.updateSubscriberCounts);

export default router;

