import {
    Controller,
    Get,
    Patch,
    Param,
    UseGuards,
    Req,
    ParseIntPipe,
  } from '@nestjs/common';
  import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
  import { NotificationService } from './notification.service';
import { Roles, RolesGuard } from 'src/common';
  
  @Controller('notifications')
  export class NotificationsController {
    constructor(private svc: NotificationService) {}
  
    @Get('me')
     @UseGuards(JwtAuthGuard, RolesGuard)
      @Roles('USER') 
    async myNotifications(@Req() req) {
      return this.svc.findAll(req.user.id);
    }
    @Patch(':id/read')
    async markRead(@Param('id', ParseIntPipe) id: number) {
      return this.svc.markAsRead(id);
    }
  }
  