import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CommonModule } from './common/common.module';
import { ProductService } from './product/product.service';
import { ProductModule } from './product/product.module';
import { LevelModule } from './level/level.module';
import { LevelService } from './level/level.service';
import { ReferralModule } from './referral/referral.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RewardModule } from './reward/reward.module';
import { WithdrawModule } from './withdraw/withdraw.module';
import { DepositModule } from './deposit/deposit.module';
import { WalletModule } from './wallet/wallet.module';
import { EasypaisaModule } from './easypaisa/easypaisa.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { NotificationsModule } from './notifications/notifications.module';
import { join } from 'path';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    CommonModule,
    ProductModule,
    LevelModule,
    ReferralModule,
    RewardModule,
    WithdrawModule,
    DepositModule,
    WalletModule,
    EasypaisaModule,
    JobsModule,
    RewardModule,
    NotificationsModule,
  ],
  providers: [ProductService, LevelService],
  controllers: [],
})
export class AppModule {}
