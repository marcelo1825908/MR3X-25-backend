import { Router } from 'express';
import { AddressController } from './address.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();
const addressController = new AddressController();

// Protected routes
router.use(authenticate);

router.get('/cep/:cep', addressController.getByCep);

export default router;

