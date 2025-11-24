import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  getDashboard = async (req: Request, res: Response) => {
    try {
    const userId = req.user!.userId;
    const role = req.user!.role;
      const agencyId = req.user!.agencyId;
      const brokerId = req.user!.brokerId;

      if (role === 'CEO' || role === 'ADMIN') {
        const result = await this.dashboardService.getCEODashboard();
        res.json(result);
      } else if (role === 'INQUILINO') {
      const result = await this.dashboardService.getTenantDashboard(userId);
      res.json(result);
      } else if (role === 'AGENCY_ADMIN') {
        const result = await this.dashboardService.getAgencyAdminDashboard(userId, agencyId);
        res.json(result);
      } else if (role === 'AGENCY_MANAGER') {
        const result = await this.dashboardService.getManagerDashboard(userId, agencyId);
        res.json(result);
      } else if (role === 'BROKER') {
        const result = await this.dashboardService.getBrokerDashboard(userId, agencyId, brokerId);
        res.json(result);
    } else {
      const result = await this.dashboardService.getOwnerDashboard(userId);
      res.json(result);
      }
    } catch (error: any) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };

  getTenantDocuments = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.dashboardService.getTenantDocuments(userId);
    res.json(result);
  };

  getTenantStatus = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.dashboardService.getTenantDashboard(userId);
    res.json(result);
  };

  getDueDates = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const agencyId = req.user!.agencyId;
    const brokerId = req.user!.brokerId;
    const result = await this.dashboardService.getDueDates(userId, role, agencyId, brokerId);
    res.json(result);
  };
}

