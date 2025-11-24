import { Router } from 'express';
import { ValidationController } from './validation.controller';

const router = Router();
const validationController = new ValidationController();

// Document validation routes
router.post('/cpf', validationController.validateCPF);
router.post('/cnpj', validationController.validateCNPJ);
router.post('/document', validationController.validateDocument);

// CEP validation and data routes
router.post('/cep', validationController.validateCEP);
router.get('/cep/:cep', validationController.fetchCEPData);

// Formatting routes
router.post('/format/cpf', validationController.formatCPF);
router.post('/format/cnpj', validationController.formatCNPJ);
router.post('/format/cep', validationController.formatCEP);

export default router;
