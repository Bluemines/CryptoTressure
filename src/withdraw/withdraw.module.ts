import { Module } from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { WithdrawController } from './withdraw.controller';
import { WithdrawAutoFlagJob } from './job/withdraw.job';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EasypaisaModule } from 'src/easypaisa/easypaisa.module';

@Module({
  imports: [PrismaModule, EasypaisaModule],
  providers: [WithdrawService, WithdrawAutoFlagJob],
  controllers: [WithdrawController],
})
export class WithdrawModule {}
