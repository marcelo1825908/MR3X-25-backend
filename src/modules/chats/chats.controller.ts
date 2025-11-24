import { Request, Response } from 'express';
import { ChatsService } from './chats.service';
import { chatCreateSchema, messageCreateSchema } from './chats.dto';

export class ChatsController {
  private chatsService: ChatsService;

  constructor() {
    this.chatsService = new ChatsService();
  }

  getChats = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.chatsService.getChats(userId);
    res.json(result);
  };

  getMessages = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user!.userId;
    const result = await this.chatsService.getMessages(chatId, userId);
    res.json(result);
  };

  sendMessage = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user!.userId;
    const data = messageCreateSchema.parse(req.body);
    const result = await this.chatsService.sendMessage(chatId, userId, data);
    res.json(result);
  };

  createChat = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const data = chatCreateSchema.parse(req.body);
    const result = await this.chatsService.createChat(userId, data);
    res.json(result);
  };

  getAvailableUsers = async (req: Request, res: Response) => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;
      const result = await this.chatsService.getAvailableUsers(userId, role);
      res.json(result);
    } catch (error: any) {
      console.error('Error in getAvailableUsers:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  };

  deleteChat = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user!.userId;
    await this.chatsService.deleteChat(chatId, userId);
    res.status(200).json({ message: 'Chat deleted successfully' });
  };

  markAsRead = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user!.userId;
    await this.chatsService.markAsRead(chatId, userId);
    res.status(200).json({ message: 'Messages marked as read' });
  };
}

