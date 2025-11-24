import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { ContractsController } from './contracts.controller';
import { authenticate, requireRole } from '../../middlewares/auth';
import { requirePermission } from '../../shared/middleware/rbac.middleware';

const router = Router();
const contractsController = new ContractsController();

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Public route to serve PDF files
router.get('/pdf/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(process.cwd(), 'uploads', 'contracts', filename);
    
    // Check if file exists
    await fs.access(filePath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: 'PDF not found' });
  }
});

// Protected routes
router.use(authenticate);

router.get('/', requirePermission('contracts:read'), contractsController.getContracts);
router.get('/:id', requirePermission('contracts:read'), contractsController.getContractById);
router.get('/download/:id', contractsController.downloadContract);
router.post('/', requirePermission('contracts:create'), contractsController.createContract);
router.post('/default', requirePermission('contracts:create'), contractsController.generateDefaultContract);
router.post('/default/owner-sign', requirePermission('contracts:update'), contractsController.acceptPatternContract);
router.post('/accept-pattern', requirePermission('contracts:update'), upload.single('pdf'), contractsController.acceptPatternContract);
router.post('/upload', requirePermission('contracts:update'), upload.single('contract'), contractsController.uploadContract);
router.put('/:id', requirePermission('contracts:update'), contractsController.updateContract);
router.delete('/:id', requirePermission('contracts:delete'), contractsController.deleteContract);

export default router;

