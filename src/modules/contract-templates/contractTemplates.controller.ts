import { Request, Response } from 'express';
import { ContractTemplatesService } from './contractTemplates.service';

export class ContractTemplatesController {
  private templatesService: ContractTemplatesService;

  constructor() {
    this.templatesService = new ContractTemplatesService();
  }

  getAllTemplates = async (_req: Request, res: Response) => {
    const templates = this.templatesService.getAllTemplates();
    res.json(templates);
  };

  getTemplateById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const template = this.templatesService.getTemplateById(id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  };

  getTemplatesByType = async (req: Request, res: Response) => {
    const { type } = req.params;
    
    if (!['CTR', 'ACD', 'VST'].includes(type)) {
      return res.status(400).json({ error: 'Invalid template type. Must be CTR, ACD, or VST' });
    }
    
    const templates = this.templatesService.getTemplatesByType(type as 'CTR' | 'ACD' | 'VST');
    res.json(templates);
  };
}


