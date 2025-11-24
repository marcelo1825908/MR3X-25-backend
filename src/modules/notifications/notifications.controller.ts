import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';
import { notificationCreateSchema, notificationUpdateSchema } from './notifications.dto';

export class NotificationsController {
  private notificationsService: NotificationsService;

  constructor() {
    this.notificationsService = new NotificationsService();
  }

  getNotifications = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.notificationsService.getNotifications(userId);
    res.json(result);
  };

  createNotification = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const data = notificationCreateSchema.parse(req.body);
    const result = await this.notificationsService.createNotification(userId, data);
    res.json(result);
  };

  updateNotification = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const data = notificationUpdateSchema.parse(req.body);
    const result = await this.notificationsService.updateNotification(id, userId, data);
    res.json(result);
  };

  deleteNotification = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    await this.notificationsService.deleteNotification(id, userId);
    res.status(204).send();
  };

  getUserNotifications = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.notificationsService.getUserNotifications(userId);
    res.json(result);
  };

  getPropertyNotifications = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.notificationsService.getPropertyNotifications(userId);
    res.json(result);
  };

  getUserNotificationsById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const result = await this.notificationsService.getUserNotificationsById(userId, id);
    res.json(result);
  };

  getPropertyNotificationsById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const result = await this.notificationsService.getPropertyNotificationsById(userId, id);
    res.json(result);
  };

  deleteUserNotification = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    await this.notificationsService.deleteUserNotification(userId, id);
    res.status(204).send();
  };

  deletePropertyNotification = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;
    await this.notificationsService.deletePropertyNotification(userId, id);
    res.status(204).send();
  };
}

