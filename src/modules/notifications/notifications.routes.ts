import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const notificationsController = new NotificationsController();

// Protected routes
router.use(authenticate);
router.use(requireRole('PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'ADMIN', 'BROKER'));

router.get('/', notificationsController.getNotifications);
router.get('/users', notificationsController.getUserNotifications);
router.get('/properties', notificationsController.getPropertyNotifications);
router.get('/users/:id', notificationsController.getUserNotificationsById);
router.get('/properties/:id', notificationsController.getPropertyNotificationsById);
router.post('/', notificationsController.createNotification);
router.put('/:id', notificationsController.updateNotification);
router.delete('/:id', notificationsController.deleteNotification);
router.delete('/users/:id', notificationsController.deleteUserNotification);
router.delete('/properties/:id', notificationsController.deletePropertyNotification);

export default router;

