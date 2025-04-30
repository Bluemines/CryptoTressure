// src/withdraw/withdraw.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { addHours } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WithdrawAutoFlagJob {
  private readonly log = new Logger(WithdrawAutoFlagJob.name);
  constructor(private readonly prisma: PrismaService) {}

  // every hour
  @Cron('0 * * * *')
  async handle() {
    const now = new Date();
    const timeout = await this.prisma.withdraw.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: addHours(now, -36) },
      },
    });
    if (!timeout.length) return;

    this.log.warn(`Flagging ${timeout.length} withdrawals as SUSPENDED`);
    await this.prisma.withdraw.updateMany({
      where: { id: { in: timeout.map((w) => w.id) } },
      data: { status: 'SUSPENDED' },
    });
  }
}
