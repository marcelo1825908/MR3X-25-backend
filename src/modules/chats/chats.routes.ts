import { Router } from 'express';
import { ChatsController } from './chats.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();
const chatsController = new ChatsController();

// Protected routes
router.use(authenticate);

router.get('/', chatsController.getChats);
router.get('/available-users', chatsController.getAvailableUsers);
router.get('/:chatId/messages', chatsController.getMessages);
router.post('/', chatsController.createChat);
router.post('/:chatId/messages', chatsController.sendMessage);
router.patch('/:chatId/read', chatsController.markAsRead);
router.delete('/:chatId', chatsController.deleteChat);

export default router;

