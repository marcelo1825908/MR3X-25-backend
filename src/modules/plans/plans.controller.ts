import { Request, Response } from 'express';
import { PlansService } from './plans.service';
import { z } from 'zod';

const plansService = new PlansService();

const updatePlanSchema = z.object({
  price: z.number().min(0).optional(),
  propertyLimit: z.number().int().min(0).optional(),
  userLimit: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export class PlansController {
  getPlans = async (req: Request, res: Response): Promise<void> => {
    const plans = await plansService.getPlans();
    res.json(plans);
  };

  getPlanById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const plan = await plansService.getPlanById(id);
    res.json(plan);
  };

  updatePlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const validatedData = updatePlanSchema.parse(req.body);
      const plan = await plansService.updatePlan(id, validatedData);
      res.json(plan);
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

  updatePlanByName = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.params;
      const validatedData = updatePlanSchema.parse(req.body);
      const plan = await plansService.updatePlanByName(name, validatedData);
      res.json(plan);
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

  updateSubscriberCounts = async (req: Request, res: Response): Promise<void> => {
    const result = await plansService.updateSubscriberCounts();
    res.json(result);
  };
}

