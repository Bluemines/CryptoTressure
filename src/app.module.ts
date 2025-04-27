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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    CommonModule,
    ProductModule,
    LevelModule,
    ReferralModule,
  ],
  providers: [ProductService, LevelService],
  controllers: [],
})
export class AppModule {}
