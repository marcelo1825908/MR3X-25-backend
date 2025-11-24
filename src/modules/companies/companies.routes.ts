import { Router } from 'express';
import { CompaniesController } from './companies.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const companiesController = new CompaniesController();

// All routes require authentication
router.use(authenticate);

// Only ADMIN and CEO can manage companies
router.post('/', requireRole('ADMIN', 'CEO'), companiesController.createCompany);
router.get('/', requireRole('ADMIN', 'CEO', 'MANAGER'), companiesController.getCompanies);
router.get('/:id', requireRole('ADMIN', 'CEO', 'MANAGER'), companiesController.getCompanyById);
router.put('/:id', requireRole('ADMIN', 'CEO'), companiesController.updateCompany);
router.delete('/:id', requireRole('ADMIN', 'CEO'), companiesController.deleteCompany);

// Public validation endpoints
router.get('/validate-cnpj/:cnpj', companiesController.validateCnpj);
router.get('/cnpj/:cnpj', companiesController.getCompanyByCnpj);

export default router;
