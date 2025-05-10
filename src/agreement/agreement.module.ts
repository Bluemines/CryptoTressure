import { Module } from '@nestjs/common';
import { AgreementService } from './agreement.service';
import { AgreementController } from './agreement.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [AgreementController],
  providers: [AgreementService, PrismaService],
})
export class AgreementModule {}
