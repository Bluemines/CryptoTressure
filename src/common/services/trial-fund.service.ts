import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { setTimeout } from 'timers';
import { TrialFund } from 'generated/prisma';

@Injectable()
export class TrialFundService {
  private readonly logger = new Logger(TrialFundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async scheduleRecovery(trial: TrialFund) {
    const delay = trial.expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      // already expired
      return this.recover(trial.id);
    }

    const key = `trial-recover-${trial.id}`;
    const timeout = setTimeout(() => {
      this.recover(trial.id).catch((err) => {
        this.logger.error(`Failed auto-recover trial ${trial.id}`, err.stack);
      });
    }, delay);

    this.scheduler.addTimeout(key, timeout);
    this.logger.log(`Scheduled trialFund ${trial.id} recovery in ${delay}ms`);
  }

  /**
   * Mark trial fund recovered AND refund any associated UserProduct purchases
   */
  async recover(trialId: number) {
    // 1) Load and mark the TrialFund itself
    const trial = await this.prisma.trialFund.findUnique({
      where: { id: trialId },
    });
    if (!trial || trial.status !== 'ACTIVE') {
      return;
    }

    await this.prisma.trialFund.update({
      where: { id: trialId },
      data: { status: 'RECOVERED', recoveredAt: new Date() },
    });
    this.logger.log(`Recovered trialFund ${trialId}`);

    // 2) Find any ACTIVE UserProduct rows for this trial
    const userProducts = await this.prisma.userProduct.findMany({
      where: {
        userId: trial.userId,
        status: 'ACTIVE',
        acquiredAt: { lte: trial.expiresAt },
      },
      include: { product: { select: { price: true } } },
    });

    // 3) Refund each one in its own transaction
    for (const up of userProducts) {
      await this.prisma.$transaction(async (tx) => {
        // 1) remove the reservation entirely
        const price = up.walletSpend.plus(up.trialSpend);
        // 2) refund only the wallet part
        await tx.wallet.update({
          where: { userId: up.userId },
          data: {
            reserved: { decrement: price },
            balance: { increment: up.walletSpend },
          },
        });
        // 3) mark refunded
        await tx.userProduct.update({
          where: { id: up.id },
          data: { status: 'REFUNDED' },
        });
      });
    }

    // 4) Clean up the scheduled timeout
    const key = `trial-recover-${trialId}`;
    if (this.scheduler.doesExist('timeout', key)) {
      this.scheduler.deleteTimeout(key);
    }
  }
}
