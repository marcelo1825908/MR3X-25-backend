import { Request, Response } from 'express';
import { CompaniesService } from './companies.service';
import { z } from 'zod';

const companiesService = new CompaniesService();

const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cnpj: z.string().min(1, 'CNPJ is required'),
  address: z.string().min(1, 'Address is required'),
  responsible: z.string().min(1, 'Responsible is required'),
  contacts: z.string().optional(),
  plan: z.string().optional(),
  propertyLimit: z.number().optional(),
  contractDate: z.string().optional(),
  nfseDocument: z.string().optional(),
  serviceContract: z.string().optional(),
});

const updateCompanySchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  responsible: z.string().optional(),
  contacts: z.string().optional(),
  plan: z.string().optional(),
  propertyLimit: z.number().optional(),
  contractDate: z.string().optional(),
  nfseDocument: z.string().optional(),
  serviceContract: z.string().optional(),
});

export class CompaniesController {
  createCompany = async (req: Request, res: Response): Promise<void> => {
    try {
      const validatedData = createCompanySchema.parse(req.body);
      const company = await companiesService.createCompany(validatedData);
      res.status(201).json(company);
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

  getCompanies = async (req: Request, res: Response): Promise<void> => {
    const companies = await companiesService.getCompanies();
    res.json(companies);
  };

  getCompanyById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const company = await companiesService.getCompanyById(id);
    res.json(company);
  };

  updateCompany = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validatedData = updateCompanySchema.parse(req.body);
      const company = await companiesService.updateCompany(id, validatedData);
      res.json(company);
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

  deleteCompany = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const result = await companiesService.deleteCompany(id);
    res.json(result);
  };

  validateCnpj = async (req: Request, res: Response): Promise<void> => {
    const { cnpj } = req.params;
    const isValid = await companiesService.validateCnpj(cnpj);
    res.json({ valid: isValid });
  };

  getCompanyByCnpj = async (req: Request, res: Response): Promise<void> => {
    const { cnpj } = req.params;
    const company = await companiesService.getCompanyByCnpj(cnpj);
    res.json(company);
  };
}
