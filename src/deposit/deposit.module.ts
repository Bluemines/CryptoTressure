import { Module } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { DepositController } from './deposit.controller';
import { LevelService } from 'src/level/level.service';
import { LevelModule } from 'src/level/level.module';

@Module({
  imports: [HttpModule, PrismaModule, LevelModule],
  providers: [DepositService],
  controllers: [DepositController],
})
export class DepositModule {}
