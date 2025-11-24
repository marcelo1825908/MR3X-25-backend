import { Router } from 'express';
import { DocumentsController } from './documents.controller';
import { authenticate, requireRole } from '../../middlewares/auth';

const router = Router();
const documentsController = new DocumentsController();

// All routes require authentication
router.use(authenticate);

// Generate receipt
router.post('/receipt', 
  requireRole('CEO', 'ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER'),
  documentsController.generateReceipt
);

// Generate invoice
router.post('/invoice',
  requireRole('CEO', 'ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER'),
  documentsController.generateInvoice
);

// Generate receipt from payment (automatic)
router.post('/receipt/payment/:paymentId',
  requireRole('CEO', 'ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER'),
  documentsController.generateReceiptFromPayment
);

// Generate auto invoice
router.post('/invoice/auto/:contractId',
  requireRole('CEO', 'ADMIN', 'AGENCY_MANAGER', 'PROPRIETARIO', 'BROKER'),
  documentsController.generateAutoInvoice
);

export default router;

