import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { WithdrawAutoFlagJob } from './job/withdraw.job';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EasypaisaModule } from 'src/easypaisa/easypaisa.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [PrismaModule, EasypaisaModule, NotificationsModule],
  providers: [WithdrawService, WithdrawAutoFlagJob],
  controllers: [WithdrawController],
})
export class WithdrawModule {}
