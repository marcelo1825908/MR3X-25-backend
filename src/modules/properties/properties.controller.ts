import { Request, Response } from 'express';
import { PropertiesService } from './properties.service';
import { propertyCreateSchema, propertyUpdateSchema } from './properties.dto';

export class PropertiesController {
  private propertiesService: PropertiesService;

  constructor() {
    this.propertiesService = new PropertiesService();
  }

  getProperties = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const brokerId = req.user!.brokerId;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await this.propertiesService.getProperties(userId, role, agencyId, brokerId, search);
    if (role === 'AGENCY_ADMIN') {
      console.log(`[PropertiesController] AGENCY_ADMIN ${userId} fetched ${Array.isArray(result) ? result.length : 0} properties for agency ${agencyId ?? 'none'}`);
    }
    res.json(result);
  };

  getPropertyById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const result = await this.propertiesService.getPropertyById(id, userId, role);
    res.json(result);
  };

  getPropertyAgreement = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const result = await this.propertiesService.getPropertyAgreement(id, userId);
    res.json(result);
  };

  createProperty = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const brokerId = req.user!.brokerId;
    const data = propertyCreateSchema.parse(req.body);
    const result = await this.propertiesService.createProperty(userId, role, agencyId, brokerId, data);
    res.json(result);
  };

  updateProperty = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const data = propertyUpdateSchema.parse(req.body);
    const agencyId = req.user!.agencyId;
    const result = await this.propertiesService.updateProperty(id, userId, role, data, agencyId);
    res.json(result);
  };

  deleteProperty = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    await this.propertiesService.deleteProperty(id, userId, role, agencyId);
    res.status(204).send();
  };

  assignBroker = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { brokerId } = req.body as { brokerId?: string | null };
    const user = req.user!;

    const result = await this.propertiesService.assignBroker(id, {
      userId: user.userId,
      role: user.role,
      agencyId: user.agencyId,
    }, brokerId ?? null);

    res.json(result);
  };
}

