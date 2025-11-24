import { Request, Response } from 'express';
import { AgenciesService } from './agencies.service';
import { z } from 'zod';

const agenciesService = new AgenciesService();

const createAgencySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cnpj: z.string().min(1, 'CNPJ is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  plan: z.string().optional(),
  maxProperties: z.number().optional(),
  maxUsers: z.number().optional(),
});

const updateAgencySchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  plan: z.string().optional(),
  status: z.string().optional(),
  maxProperties: z.number().optional(),
  maxUsers: z.number().optional(),
  agencyFee: z.number().min(0).max(100).optional(),
});

export class AgenciesController {
  createAgency = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createAgencySchema.parse(req.body);
      const agency = await agenciesService.createAgency(validatedData);
      res.status(201).json(agency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      throw error;
    }
  };

  getAgencies = async (req: Request, res: Response): Promise<void> => {
    const agencies = await agenciesService.getAgencies();
    res.json(agencies);
  };

  getAgencyById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agency = await agenciesService.getAgencyById(id);
    res.json(agency);
  };

  updateAgency = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validatedData = updateAgencySchema.parse(req.body);
      const agency = await agenciesService.updateAgency(id, validatedData);
      res.json(agency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }
      throw error;
    }
  };

  deleteAgency = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await agenciesService.deleteAgency(id);
    res.json(result);
  };
}

