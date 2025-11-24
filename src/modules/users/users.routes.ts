import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const usersController = new UsersController();

// Protected routes
router.use(authenticate);

// User management
router.get('/', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER'), usersController.listUsers);
router.post('/', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER'), usersController.createUser);
router.get('/details', usersController.getUserDetails);

// Tenant management (must come before /:id route)
router.get('/tenants', requireRole('CEO', 'ADMIN', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'), usersController.getTenants);
router.get('/tenants/without-properties', requireRole('CEO', 'ADMIN', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'), usersController.getTenantsWithoutProperties);
router.post('/tenants', requireRole('CEO', 'ADMIN', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'), usersController.createTenant);
router.put('/tenants/:tenantId', requireRole('CEO', 'ADMIN', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'), usersController.updateTenant);
router.delete('/tenants/:tenantId', requireRole('CEO', 'ADMIN', 'PROPRIETARIO', 'INDEPENDENT_OWNER', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'BROKER'), usersController.deleteTenant);

// Document validation (must come before /:id route)
router.get('/document/validate/:document', usersController.validateDocument);
router.get('/cnpj/razao-social/:cnpj', usersController.getRazaoSocialByCnpj);

// Parameterized routes (must come last)
router.get('/:id', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER', 'BROKER', 'PROPRIETARIO'), usersController.getUserById);
router.put('/:id', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER'), usersController.updateUser);
router.delete('/:id', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER'), usersController.deleteUser);
router.patch('/:id/status', requireRole('CEO', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_MANAGER', 'INDEPENDENT_OWNER'), usersController.changeStatus);

router.post('/change-password', usersController.changeOwnPassword);

export default router;

