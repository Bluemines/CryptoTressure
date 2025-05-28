import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { setTimeout } from 'timers';
import { TrialFund } from 'generated/prisma';
import { Decimal } from 'generated/prisma/runtime/library';

@Injectable()
export class TrialFundService {
  private readonly logger = new Logger(TrialFundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /* Schedule a one-off timeout right after issuing a trial fund */
  async scheduleRecovery(trial: TrialFund) {
    const delay = trial.expiresAt.getTime() - Date.now();
    if (delay <= 0) return this.recover(trial.id); // already expired

    const key = `trial-recover-${trial.id}`;
    const timeout = setTimeout(() => {
      this.recover(trial.id).catch((err) =>
        this.logger.error(`Failed auto-recover trial ${trial.id}`, err.stack),
      );
    }, delay);

    this.scheduler.addTimeout(key, timeout);
    this.logger.log(
      `⏳ Scheduled trialFund ${trial.id} recovery in ${delay} ms`,
    );
  }

  /* Recover a single TrialFund immediately */
  async recover(trialId: number) {
    const trial = await this.prisma.trialFund.findUnique({
      where: { id: trialId },
    });
    if (!trial || trial.status !== 'ACTIVE') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.trialFund.update({
        where: { id: trialId },
        data: { status: 'RECOVERED', recoveredAt: new Date(), usedAmount: 0 },
      });

      const ups = await tx.userProduct.findMany({
        where: {
          userId: trial.userId,
          status: 'ACTIVE',
          acquiredAt: { lte: trial.expiresAt },
        },
        include: { product: { select: { id: true } } },
      });

      for (const up of ups) {
        const reserveRelease = new Decimal(up.walletSpend);
        const refundReal = new Decimal(up.walletSpend);
        const revertTrial = new Decimal(up.trialSpend);

        await tx.wallet.update({
          where: { userId: trial.userId },
          data: {
            balance: { increment: refundReal },
            reserved: { decrement: reserveRelease },
          },
        });

        await tx.userProduct.update({
          where: { id: up.id },
          data: { status: 'REFUNDED' },
        });

        if (revertTrial.gt(0)) {
          await tx.reward.updateMany({
            where: { userId: trial.userId, productId: up.productId },
            data: { status: 'REVERSED' }, 
          });
        }
      }
    });

    const key = `trial-recover-${trialId}`;
    if (this.scheduler.doesExist('timeout', key)) {
      this.scheduler.deleteTimeout(key);
    }

    this.logger.log(`✅ Recovered trialFund ${trialId}`);
  }
}
