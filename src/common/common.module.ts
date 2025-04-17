import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './services/mail.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TrialFundService } from './services/trial-fund.service';

@Global()
@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [MailService, TrialFundService],
  exports: [MailService, TrialFundService],
})
export class CommonModule {}
