import { contractTemplates, getTemplateById, ContractTemplate } from './contractTemplates';

export class ContractTemplatesService {
  /**
   * Get all contract templates
   */
  getAllTemplates(): ContractTemplate[] {
    return contractTemplates;
  }

  /**
   * Get template by ID
   */
  getTemplateById(id: string): ContractTemplate | undefined {
    return getTemplateById(id);
  }

  /**
   * Get templates by type (CTR, ACD, VST)
   */
  getTemplatesByType(type: 'CTR' | 'ACD' | 'VST'): ContractTemplate[] {
    return contractTemplates.filter(template => template.type === type);
  }
}


