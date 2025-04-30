import { Module } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { DepositController } from './deposit.controller';

@Module({
  imports: [HttpModule, PrismaModule],
  providers: [DepositService],
  controllers: [DepositController],
})
export class DepositModule {}
