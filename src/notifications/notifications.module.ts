import { Module } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [NotificationGateway, NotificationService, PrismaService],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
