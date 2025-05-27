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

  private async distributeTeamBonus(
    userId: number,
    earning: Decimal,
    productId: number,
    tx: Prisma.TransactionClient,
  ) {
    const commissionRates = [0.18, 0.09, 0.05];
    let currentUserId = userId;

    for (let level = 0; level < 3; level++) {
      // 1. Get the referral record of the current user
      const referral = await tx.referral.findFirst({
        where: { referredId: currentUserId },
        select: { id: true, referrerId: true },
      });

      if (!referral) break;

      const commissionAmount = earning.toNumber() * commissionRates[level];

      // 2. Create commission linked to the Referral
      await tx.commission.create({
        data: {
          amount: commissionAmount,
          percentage: commissionRates[level] * 100,
          levelDepth: level + 1,
          referralId: referral.id, // ✅ Correctly linking to Referral table
          status: 'SUCCESS',
        },
      });

      // 3. Credit the wallet of the upline user
      await tx.wallet.update({
        where: { userId: referral.referrerId },
        data: { balance: { increment: commissionAmount } },
      });

      // 4. Notify upline user
      await tx.notification.create({
        data: {
          userId: referral.referrerId,
          title: 'Team Bonus Received',
          message: `You received $${commissionAmount.toFixed(
            2,
          )} from level ${level + 1} referral's daily income.`,
        },
      });

      // 5. Move to next upline
      currentUserId = referral.referrerId;
    }
  }

  /* ────────────────────────────────────────────────────────────────
     1. EXPIRY / REFUND  – runs hourly on the hour
  ──────────────────────────────────────────────────────────────── */
  @Cron('0 * * * *', { name: 'handleExpiredMachines' })
  async handleExpiredMachines() {
    const now = new Date();
    this.logger.log('⏰  Running expired‐machines refund job');

    const expired = await this.prisma.userProduct.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      include: {
        product: { select: { id: true, price: true, title: true } },
        user: { select: { id: true } },
      },
    });

    for (const up of expired) {
      const price: Decimal = up.product.price;
      const userId = up.user.id;
      const productTitle = up.product.title;

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1) refund wallet
        await tx.wallet.update({
          where: { userId },
          data: {
            balance: { increment: price },
            reserved: { decrement: price },
          },
        });

        // 2) mark as refunded
        await tx.userProduct.update({
          where: { id: up.id },
          data: { status: 'REFUNDED' },
        });

        // 3) rollback any trial usage
        await tx.trialFund.updateMany({
          where: { userId, status: 'ACTIVE', usedAmount: { gt: price } },
          data: { usedAmount: { decrement: price } },
        });
      });

      // 4) send notification
      this.notificationGateway.sendNotification(userId, {
        type: 'WALLET_UPDATED',
        message: `🔄 Your rental of "${productTitle}" has expired and ₨${price.toFixed(2)} has been returned to your wallet.`,
      });

      this.logger.log(
        `✅ Refunded ₨${price.toFixed(2)} to user ${userId} for product ${up.product.id}`,
      );
    }

    this.logger.log('✅  Expired‐machines refund job complete');
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

        await this.distributeTeamBonus(up.userId, pct, up.productId, tx);
      });

      this.notificationGateway.sendNotification(up.userId, {
        type: 'REWARD_EARNED',
        message: `🎉 You received a daily reward of ₨${rewardAmount.toFixed(2)}}!`,
      });
    }

    this.logger.log('✅  Daily reward cycle complete');
  }
}
