import { Request, Response } from 'express';
import { AuditLogsService } from './audit.service';

export class AuditLogsController {
  private auditLogsService: AuditLogsService;
  
  constructor() {
    this.auditLogsService = new AuditLogsService();
  }
  
  getAuditLogs = async (req: Request, res: Response) => {
    const params = {
      entity: req.query.entity as string,
      entityId: req.query.entityId as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    
    const result = await this.auditLogsService.getAuditLogs(params);
    res.json(result);
  };
  
  getAuditLogById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await this.auditLogsService.getAuditLogById(id);
    res.json(result);
  };
}

