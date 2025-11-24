import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { paymentCreateSchema, paymentUpdateSchema } from './payments.dto';

export class PaymentsController {
  private paymentsService: PaymentsService;

  constructor() {
    this.paymentsService = new PaymentsService();
  }

  getPayments = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const agencyId = req.user!.agencyId;
      const brokerId = req.user!.brokerId;
      const result = await this.paymentsService.getPayments(userId, role, agencyId, brokerId);
      res.json(result);
    } catch (error: any) {
      console.error('Error in getPayments:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };

  getPaymentById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const result = await this.paymentsService.getPaymentById(id, userId, role);
    res.json(result);
  };

  createPayment = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const data = paymentCreateSchema.parse(req.body);
    const result = await this.paymentsService.createPayment(userId, data);
    res.json(result);
  };

  updatePayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const data = paymentUpdateSchema.parse(req.body);
    const result = await this.paymentsService.updatePayment(id, userId, role, data);
    res.json(result);
  };

  deletePayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    await this.paymentsService.deletePayment(id, userId, role);
    res.status(204).send();
  };

  getAnnualReport = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const result = await this.paymentsService.getAnnualReport(userId, role, year);
      res.json(result);
    } catch (error: any) {
      console.error('Error in getAnnualReport:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };
}

