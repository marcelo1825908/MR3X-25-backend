import { Router } from 'express';
import { AuditLogsController } from './audit.controller';
import { authenticate, requireRole } from '../../middlewares/auth';
import { requirePermission } from '../../shared/middleware/rbac.middleware';

const router = Router();
const auditLogsController = new AuditLogsController();

// Protected routes - only CEO, ADMIN, and LEGAL_AUDITOR can access
router.use(authenticate);
router.use(requirePermission('audit:read'));

// Get all audit logs
router.get('/', auditLogsController.getAuditLogs);

// Get audit log by ID
router.get('/:id', auditLogsController.getAuditLogById);

export default router;

