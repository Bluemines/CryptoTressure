import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { awardPoints } from '../common/utils/points';

const prisma = new PrismaClient();

@Injectable()
export class RewardJob {
  private readonly log = new Logger(RewardJob.name);

  // runs every day at 00:05
  @Cron('5 0 * * *', { name: 'daily-reward' })
  async handleDailyRewards() {
    this.log.log('⏰  Starting daily reward cycle …');

    // fetch all active user-products
    const today = new Date();
    const startOfDay = new Date(today.toISOString().substring(0, 10)); // 00:00

    const userProducts = await prisma.userProduct.findMany({
      where: {
        status: 'ACTIVE',
        product: { deletedAt: null },
      },
      include: {
        product: { select: { dailyIncome: true } },
      },
    });

    // one DB tx per userProduct keeps work isolated & safe
    for (const up of userProducts) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const amount = up.product.dailyIncome;

        // try to create reward row (will fail silently if exists)
        await tx.reward
          .create({
            data: {
              userId: up.userId,
              productId: up.productId,
              reward: amount,
              date: startOfDay,
            },
          })
          .catch(() => null); // duplicate → ignore

        // credit wallet
        await tx.wallet.update({
          where: { userId: up.userId },
          data: { balance: { increment: amount } },
        });

        // optional: +1 point per USD reward
        await awardPoints(up.userId, Number(amount), tx); // ★ NEW
      });
    }
    this.log.log('✅  Daily reward cycle complete');
  }
}
