import { Request, Response } from 'express';
import { UsersService } from './users.service';
import { userCreateSchema, tenantCreateSchema, userUpdateSchema, changeStatusSchema, changePasswordSchema } from './users.dto';

export class UsersController {
  private usersService: UsersService;

  constructor() {
    this.usersService = new UsersService();
  }

  listUsers = async (req: Request, res: Response) => {
    const { search, role, status, plan } = req.query as any;
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 10);
    const currentUserId = req.user!.userId; // Exclude current user from list
    // Apply tenancy scope: managers see only their agency; brokers see only own portfolio
    const scope: any = {}
    if (req.user?.role === 'AGENCY_ADMIN') {
      // AGENCY_ADMIN sees all users in their agency
      if (req.user.agencyId) {
        scope.agencyId = req.user.agencyId
        console.log(`[AGENCY_ADMIN] Filtering by agencyId: ${req.user.agencyId} for user ${req.user.userId}`)
      } else {
        // If AGENCY_ADMIN doesn't have agencyId, they shouldn't see any users
        // This should not happen, but adding safety check
        console.warn(`[AGENCY_ADMIN] User ${req.user.userId} has no agencyId - returning empty list`);
        return res.json({ items: [], total: 0, page, pageSize });
      }
    } else if (req.user?.role === 'AGENCY_MANAGER') {
      scope.managerId = req.user.userId
      if (req.user.agencyId) scope.agencyId = req.user.agencyId
    }
    if (req.user?.role === 'BROKER') scope.brokerId = req.user.userId
    
    console.log(`[listUsers] Role: ${req.user?.role}, Scope:`, scope);
    const result = await this.usersService.listUsers({ search, role, status, plan, page, pageSize }, scope, currentUserId);
    console.log(`[listUsers] Found ${result.items.length} users out of ${result.total} total`);
    if (req.user?.role === 'AGENCY_ADMIN') {
      console.log(`[UsersController] AGENCY_ADMIN ${req.user.userId} fetched ${result.items.length}/${result.total} users for agency ${req.user.agencyId ?? 'none'}`);
    }
    res.json(result);
  };

  getUserById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const result = await this.usersService.getUserById(id, currentUser);
      res.json(result);
    } catch (error: any) {
      console.error('[UsersController.getUserById] Error:', error);
      if (error.statusCode) {
        res.status(error.statusCode).json({ status: 'error', message: error.message });
      } else {
        res.status(500).json({ status: 'error', message: 'Internal server error' });
      }
    }
  };

  createUser = async (req: Request, res: Response) => {
    const data = userCreateSchema.parse(req.body);
    const requestingUserId = req.user!.userId;
    const requestingUserRole = req.user!.role;
    const result = await this.usersService.createUser(data, requestingUserId, requestingUserRole);
    res.json(result);
  };

  getTenants = async (req: Request, res: Response) => {
    const scope: any = {}
    if (req.user?.role === 'PROPRIETARIO' || req.user?.role === 'INDEPENDENT_OWNER') scope.ownerId = req.user.userId
    if (req.user?.role === 'AGENCY_ADMIN') {
      if (req.user.agencyId) {
        scope.agencyId = req.user.agencyId
      } else {
        return res.json([])
      }
    }
    if (req.user?.role === 'AGENCY_MANAGER') {
      scope.managerId = req.user.userId
      if (req.user.agencyId) scope.agencyId = req.user.agencyId
    }
    if (req.user?.role === 'BROKER') {
      scope.brokerId = req.user.userId
      if (req.user.agencyId) scope.agencyId = req.user.agencyId
    }
    const result = await this.usersService.getTenantsByScope(scope)
    res.json(result)
  };

  getTenantsWithoutProperties = async (req: Request, res: Response) => {
    const scope: any = {}
    if (req.user?.role === 'PROPRIETARIO' || req.user?.role === 'INDEPENDENT_OWNER') scope.ownerId = req.user.userId
    if (req.user?.role === 'AGENCY_MANAGER' && req.user.agencyId) scope.agencyId = req.user.agencyId
    const result = await this.usersService.getTenantsWithoutProperties(scope)
    res.json(result)
  };

  createTenant = async (req: Request, res: Response) => {
    const ownerId = req.user!.userId;
    const requestingUserRole = req.user!.role;
    const data = tenantCreateSchema.parse(req.body);
    const result = await this.usersService.createTenant(ownerId, data, requestingUserRole);
    res.json(result);
  };

  updateTenant = async (req: Request, res: Response) => {
    const requestingUserId = req.user!.userId;
    const requestingUserRole = req.user!.role;
    const { tenantId } = req.params;
    const data = userUpdateSchema.parse(req.body);
    const result = await this.usersService.updateTenant(requestingUserId, tenantId, data, requestingUserRole);
    res.json(result);
  };

  deleteTenant = async (req: Request, res: Response) => {
    const requestingUserId = req.user!.userId;
    const { tenantId } = req.params;
    
    console.log('Delete tenant request:', { requestingUserId, tenantId });
    
    await this.usersService.deleteTenant(requestingUserId, tenantId);
    res.status(204).send();
  };

  deleteUser = async (req: Request, res: Response) => {
    const requestingUserId = req.user!.userId;
    const requestingUserRole = req.user!.role;
    const { id } = req.params;
    
    console.log('Delete user request:', { requestingUserId, requestingUserRole, userId: id });
    
    await this.usersService.deleteUser(requestingUserId, requestingUserRole, id);
    res.status(204).send();
  };

  getUserDetails = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.usersService.getUserDetails(userId);
    res.json(result);
  };

  updateUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const requestingUserId = req.user!.userId;
    const requestingUserRole = req.user!.role;
    const data = userUpdateSchema.parse(req.body);
    const result = await this.usersService.updateUserById(id, data, requestingUserId, requestingUserRole);
    res.json(result);
  };

  changeStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const payload = changeStatusSchema.parse(req.body);
    const requestingUser = req.user!;
    const result = await this.usersService.changeStatus(id, payload, requestingUser);
    res.json(result);
  };

  changeOwnPassword = async (req: Request, res: Response) => {
    const payload = changePasswordSchema.parse(req.body);
    const userId = req.user!.userId;
    await this.usersService.changeOwnPassword(userId, payload.currentPassword, payload.newPassword);
    res.status(204).send();
  };

  validateDocument = async (req: Request, res: Response) => {
    const { document } = req.params;
    const isValid = await this.usersService.validateDocument(document);
    
    if (isValid) {
      res.status(200).json({ valid: true });
    } else {
      res.status(404).json({ valid: false });
    }
  };

  getRazaoSocialByCnpj = async (req: Request, res: Response) => {
    const { cnpj } = req.params;
    const result = await this.usersService.getRazaoSocialByCnpj(cnpj);
    res.json(result);
  };
}

