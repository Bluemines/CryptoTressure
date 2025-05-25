import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { awardPoints } from 'src/common/utils/points';
import { Decimal } from 'generated/prisma/runtime/library';
import { NotificationGateway } from 'src/notifications/notification.gateway';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private notificationGateway: NotificationGateway,
  ) {}

  /* ────────────────────────────────────────────────────────────────
     1. EXPIRY / REFUND  – runs hourly on the hour
  ──────────────────────────────────────────────────────────────── */
  @Cron('0 * * * *', { name: 'handleExpiredMachines' })
  async handleExpiredMachines() {
    const now = new Date();
    console.log('In HandleExiredMachines');

    const expired = await this.prisma.userProduct.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      include: {
        product: { select: { price: true } },
        user: { select: { id: true } },
      },
    });

    for (const up of expired) {
      await this.prisma.$transaction(async (tx) => {
        const price: Decimal = up.product.price;

        await tx.wallet.update({
          where: { userId: up.userId },
          data: {
            balance: { increment: price },
            reserved: { decrement: price },
          },
        });

        await tx.userProduct.update({
          where: { id: up.id },
          data: { status: 'REFUNDED' },
        });

        await tx.trialFund.updateMany({
          where: { userId: up.userId, status: 'ACTIVE', usedAmount: { gt: 0 } },
          data: { usedAmount: { decrement: price } },
        });
      });

      this.logger.log(
        `✅ Refunded ${up.product.price} to user ${up.userId} (machine ${up.productId})`,
      );
    }
  }

  /* ────────────────────────────────────────────────────────────────
     2. DAILY REWARDS  – runs at 00:05 UTC every day
  ──────────────────────────────────────────────────────────────── */
  @Cron('5 0 * * *', { name: 'daily-reward' })
  async handleDailyRewards() {
    this.logger.log('⏰  Starting daily reward cycle');

    const today = new Date();
    const startOfDayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const userProducts = await this.prisma.userProduct.findMany({
      where: { status: 'ACTIVE', product: { deletedAt: null } },
      include: { product: { select: { price: true, dailyIncome: true } } },
    });

    for (const up of userProducts) {
      const price: Decimal = up.product.price;
      const pct: Decimal = up.product.dailyIncome;
      const rewardAmount = price.mul(pct).div(100).toDecimalPlaces(2);

      let awarded = false;

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        try {
          await tx.reward.create({
            data: {
              userId: up.userId,
              productId: up.productId,
              reward: rewardAmount,
              date: startOfDayUTC,
            },
          });
          awarded = true;
        } catch (e: any) {
          if (e?.code !== 'P2002') throw e;
          return;
        }

        await tx.wallet.update({
          where: { userId: up.userId },
          data: { balance: { increment: rewardAmount } },
        });

        await awardPoints(up.userId, rewardAmount.toNumber(), tx);
      });

      this.notificationGateway.sendNotification(up.userId, {
        type: 'REWARD_EARNED',
        message: `🎉 You received a daily reward of ₨${rewardAmount.toFixed(2)}}!`,
      });
    }

    this.logger.log('✅  Daily reward cycle complete');
  }
}
