import { Request, Response } from 'express';
import { ContractsService } from './contracts.service';
import { contractCreateSchema, contractUpdateSchema, contractDefaultSchema } from './contracts.dto';

export class ContractsController {
  private contractsService: ContractsService;

  constructor() {
    this.contractsService = new ContractsService();
  }

  getContracts = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const brokerId = req.user!.brokerId;
    const result = await this.contractsService.getContracts(userId, role, agencyId, brokerId);
    res.json(result);
  };

  getContractById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const result = await this.contractsService.getContractById(id, userId, role, agencyId);
    res.json(result);
  };

  createContract = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const data = contractCreateSchema.parse(req.body);
    
    // Get client IP address
    const clientIP = req.ip || 
      req.headers['x-forwarded-for']?.toString().split(',')[0] || 
      req.headers['x-real-ip']?.toString() || 
      req.socket.remoteAddress || 
      '0.0.0.0';
    
    // Get user agent
    const userAgent = req.headers['user-agent'] || '';
    
    const result = await this.contractsService.createContract(
      userId, 
      role, 
      agencyId, 
      data,
      clientIP,
      userAgent
    );
    res.json(result);
  };

  updateContract = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const data = contractUpdateSchema.parse(req.body);
    const agencyId = req.user!.agencyId;
    const result = await this.contractsService.updateContract(id, userId, role, data, agencyId);
    res.json(result);
  };

  deleteContract = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    await this.contractsService.deleteContract(id, userId, role, agencyId);
    res.status(204).send();
  };

  generateDefaultContract = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const data = contractDefaultSchema.parse(req.body);
    const pdfBuffer = await this.contractsService.generateDefaultContract(userId, data);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=contrato.pdf');
    res.send(pdfBuffer);
  };

  downloadContract = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const pdfBuffer = await this.contractsService.downloadContract(id, userId, role, agencyId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contrato-${id}.pdf`);
    res.send(pdfBuffer);
  };

  uploadContract = async (req: Request, res: Response): Promise<void> => {
    const { contractId } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    
    // Get file from request (assuming multer middleware)
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const pdfPath = await this.contractsService.uploadContract(contractId, userId, role, file.buffer, file.originalname, agencyId);
    res.status(200).json({ message: 'Contract uploaded successfully', pdfPath });
  };

  acceptPatternContract = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    
    // If PDF is provided
    if (req.file) {
      const data = contractDefaultSchema.parse({
        propertyId: req.body.propertyId,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        city: req.body.city,
        index: req.body.index,
      });
      
      const result = await this.contractsService.acceptPatternContract(userId, data, req.file.buffer);
      res.status(200).json(result);
      return;
    }
    
    // If only data is provided, generate PDF and create contract
    const data = contractDefaultSchema.parse(req.body);
    const pdfBuffer = await this.contractsService.generateDefaultContract(userId, data);
    const result = await this.contractsService.acceptPatternContract(userId, data, pdfBuffer);
    res.status(202).json(result);
  };
}

