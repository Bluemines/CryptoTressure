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

  /* ───────────────────────────────────────────────
   EXPIRY / REFUND – runs hourly on the hour
   ─────────────────────────────────────────────── */
  @Cron('0 * * * *', { name: 'handleExpiredMachines' })
  async handleExpiredMachines() {
    const now = new Date();
    this.logger.log('⏰  Running expired-machines refund job');

    const expiredByUser = await this.prisma.userProduct.groupBy({
      by: ['userId'],
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      _count: true,
    });

    for (const { userId } of expiredByUser) {
      await this.prisma.$transaction(async (tx) => {
        const userProducts = await tx.userProduct.findMany({
          where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
          include: {
            product: { select: { id: true, price: true, title: true } },
          },
        });
        if (userProducts.length === 0) return; 

        let walletRefund = new Decimal(0); 
        let walletReserved = new Decimal(0); 
        let trialFundRecovery = new Decimal(0); 

        for (const up of userProducts) {
          walletRefund = walletRefund.plus(up.walletSpend);
          walletReserved = walletReserved.plus(up.walletSpend);
          trialFundRecovery = trialFundRecovery.plus(up.trialSpend);
        }

        await tx.wallet.update({
          where: { userId },
          data: {
            balance: { increment: walletRefund },
            reserved: { decrement: walletReserved },
          },
        });

        await tx.userProduct.updateMany({
          where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
          data: { status: 'REFUNDED' },
        });

        if (trialFundRecovery.gt(0)) {
          const tf = await tx.trialFund.update({
            where: { userId },
            data: { usedAmount: { decrement: trialFundRecovery } },
          });

          if (tf.usedAmount.lte(0)) {
            await tx.trialFund.update({
              where: { userId },
              data: {
                status: 'RECOVERED',
                recoveredAt: new Date(),
                usedAmount: 0,
              },
            });
          }
        }

        const trialProductIds = userProducts
          .filter((u) => u.trialSpend.gt(0))
          .map((u) => u.product.id);

        if (trialProductIds.length) {
          await tx.reward.updateMany({
            where: {
              userId,
              productId: { in: trialProductIds },
              status: 'SUCCESS',
            },
            data: { status: 'FAILED' },
          });

          await tx.reward.updateMany({
            where: {
              userId,
              productId: { in: trialProductIds },
              status: null,
              createdAt: { lte: now },
            },
            data: { status: 'REVERSED' },
          });
        }

        this.notificationGateway.sendNotification(userId, {
          type: 'WALLET_UPDATED',
          message:
            'Your 4-day trial has ended. Trial funds and related earnings have been cleared; all real funds have been returned to your wallet.',
        });
      });

      this.logger.log(`✅ Finished clean-up for user ${userId}`);
    }

    this.logger.log('✅  Expired-machines refund job complete');
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
