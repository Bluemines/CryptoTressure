import { Module } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
@Module({
  imports: [NotificationsModule],
  providers: [ReferralService],
  controllers: [ReferralController]
})
export class ReferralModule {}
