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
import { RewardJob } from './reward/reward.service';
import { RewardModule } from './reward/reward.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
  providers: [ProductService, LevelService, RewardJob],
  controllers: [],
})
export class AppModule {}
