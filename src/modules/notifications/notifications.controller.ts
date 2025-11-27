import { Controller, Get, Put, Delete, Param, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the current user' })
  async getNotifications(@Request() req: any) {
    try {
      const userId = BigInt(req.user.sub);
      return await this.notificationsService.getNotifications(userId);
    } catch (error) {
      this.logger.error('Error in getNotifications:', error);
      return { items: [], total: 0 };
    }
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: any) {
    try {
      const userId = BigInt(req.user.sub);
      const count = await this.notificationsService.getUnreadCount(userId);
      return { count };
    } catch (error) {
      this.logger.error('Error in getUnreadCount:', error);
      return { count: 0 };
    }
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    try {
      const userId = BigInt(req.user.sub);
      const notificationId = BigInt(id);
      await this.notificationsService.markAsRead(notificationId, userId);
      return { success: true };
    } catch (error) {
      this.logger.error('Error in markAsRead:', error);
      return { success: false };
    }
  }

  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req: any) {
    try {
      const userId = BigInt(req.user.sub);
      await this.notificationsService.markAllAsRead(userId);
      return { success: true };
    } catch (error) {
      this.logger.error('Error in markAllAsRead:', error);
      return { success: false };
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Param('id') id: string, @Request() req: any) {
    try {
      const userId = BigInt(req.user.sub);
      const notificationId = BigInt(id);
      await this.notificationsService.deleteNotification(notificationId, userId);
      return { success: true };
    } catch (error) {
      this.logger.error('Error in deleteNotification:', error);
      return { success: false };
    }
  }
}
