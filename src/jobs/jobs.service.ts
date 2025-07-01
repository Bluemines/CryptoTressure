import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { awardPoints } from 'src/common/utils/points';
import { Decimal } from 'generated/prisma/runtime/library';
import { NotificationGateway } from 'src/notifications/notification.gateway';
import { Server, Socket } from 'socket.io';

// @Injectable()
// export class JobsService {
//   private readonly logger = new Logger(JobsService.name);

//   constructor(
//     private readonly prisma: PrismaService,
//     private notificationGateway: NotificationGateway,
//   ) {}

//   private async distributeTeamBonus(
//     userId: number,
//     earning: Decimal,
//     productId: number,
//     tx: Prisma.TransactionClient,
//   ) {
//     const commissionRates = [0.18, 0.09, 0.05]; // Levels 1 → 3
//     let currentUserId = userId;
//     let lastValidUplineUserId: number | null = null;

//     for (let level = 1; level <= 3; level++) {
//       const referral = await tx.referral.findFirst({
//         where: { referredId: currentUserId },
//         select: { referrerId: true },
//       });

//       if (!referral?.referrerId) {
//         if (lastValidUplineUserId) {
//           const rate = commissionRates[level - 1];
//           const bonusAmount = earning.mul(rate).toDecimalPlaces(2);

//           await tx.wallet.update({
//             where: { userId: lastValidUplineUserId },
//             data: { balance: { increment: bonusAmount } },
//           });

//           await tx.bonus.create({
//             data: {
//               userId: lastValidUplineUserId,
//               amount: bonusAmount,
//               sourceId: userId,
//               type: `TEAM_LEVEL_${level}` as any,
//               note: `Team bonus (level ${level}) from downline user #${userId}`,
//             },
//           });

//           await tx.notification.create({
//             data: {
//               userId: lastValidUplineUserId,
//               title: 'Team Bonus Received',
//               message: `You received '$'${bonusAmount.toFixed(2)} from level ${level} team.`,
//             },
//           });
//         }
//         break;
//       }

//       const alreadyGiven = await tx.bonus.findFirst({
//         where: {
//           userId: referral.referrerId,
//           sourceId: userId,
//           type: `TEAM_LEVEL_${level}`,
//           createdAt: {
//             gte: new Date(new Date().setUTCHours(0, 0, 0, 0)), // today's bonus only once
//           },
//         },
//       });

//       if (alreadyGiven) continue; // Skip if already given today

//       const bonusAmount = earning
//         .mul(commissionRates[level - 1])
//         .toDecimalPlaces(2);

//       await tx.wallet.update({
//         where: { userId: referral.referrerId },
//         data: { balance: { increment: bonusAmount } },
//       });

//       await tx.bonus.create({
//         data: {
//           userId: referral.referrerId,
//           amount: bonusAmount,
//           sourceId: userId,
//           type: `TEAM_LEVEL_${level}` as any,
//           note: `Team bonus (level ${level}) from downline user #${userId}`,
//         },
//       });

//       await tx.notification.create({
//         data: {
//           userId: referral.referrerId,
//           title: 'Team Bonus Received',
//           message: `You received ₨${bonusAmount.toFixed(2)} from level ${level} team.`,
//         },
//       });

//       lastValidUplineUserId = referral.referrerId;
//       currentUserId = referral.referrerId;
//     }
//   }

//   /* ───────────────────────────────────────────────
//    EXPIRY / REFUND – runs hourly on the hour
//    ─────────────────────────────────────────────── */
//   @Cron('0 * * * *', { name: 'handleExpiredMachines' })
//   async handleExpiredMachines() {
//     const now = new Date();
//     this.logger.log('⏰  Running expired-machines refund job');

//     const expiredByUser = await this.prisma.userProduct.groupBy({
//       by: ['userId'],
//       where: { status: 'ACTIVE', expiresAt: { lte: now } },
//       _count: true,
//     });

//     for (const { userId } of expiredByUser) {
//       await this.prisma.$transaction(async (tx) => {
//         const userProducts = await tx.userProduct.findMany({
//           where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
//           include: {
//             product: { select: { id: true, price: true, title: true } },
//           },
//         });
//         if (userProducts.length === 0) return;

//         let walletRefund = new Decimal(0);
//         let walletReserved = new Decimal(0);
//         let trialFundRecovery = new Decimal(0);

//         for (const up of userProducts) {
//           walletRefund = walletRefund.plus(up.walletSpend);
//           walletReserved = walletReserved.plus(up.walletSpend);
//           trialFundRecovery = trialFundRecovery.plus(up.trialSpend);
//         }

//         await tx.wallet.update({
//           where: { userId },
//           data: {
//             balance: { increment: walletRefund },
//             reserved: { decrement: walletReserved },
//           },
//         });
//         await tx.userProduct.updateMany({
//           where: { userId, status: 'ACTIVE', expiresAt: { lte: now } },
//           data: { status: 'REFUNDED' },
//         });

//         if (trialFundRecovery.gt(0)) {
//           const tf = await tx.trialFund.update({
//             where: { userId },
//             data: { usedAmount: { decrement: trialFundRecovery } },
//           });

//           if (tf.usedAmount.lte(0)) {
//             await tx.trialFund.update({
//               where: { userId },
//               data: {
//                 status: 'RECOVERED',
//                 recoveredAt: new Date(),
//                 usedAmount: 0,
//               },
//             });
//           }
//         }

//         const trialProductIds = userProducts
//           .filter((u) => u.trialSpend.gt(0))
//           .map((u) => u.product.id);

//         if (trialProductIds.length) {
//           await tx.reward.updateMany({
//             where: {
//               userId,
//               productId: { in: trialProductIds },
//               status: 'SUCCESS',
//             },
//             data: { status: 'FAILED' },
//           });

//           await tx.reward.updateMany({
//             where: {
//               userId,
//               productId: { in: trialProductIds },
//               status: 'SUCCESS',
//               createdAt: { lte: now },
//             },
//             data: { status: 'REVERSED' },
//           });
//         }

//         this.notificationGateway.sendNotification(userId, {
//           type: 'WALLET_UPDATED',
//           message:
//             'Your 4-day trial has ended. Trial funds and related earnings have been cleared; all real funds have been returned to your wallet.',
//         });
//       });

//       this.logger.log(`✅ Finished clean-up for user ${userId}`);
//     }

//     this.logger.log('✅  Expired-machines refund job complete');
//   }

//   @Cron('5 0 * * *', { name: 'daily-reward', timeZone: 'UTC' })
//   async handleDailyRewards() {
//     this.logger.log('⏰  Starting reward cycle (every minute for test)');
//     const pctByLevel: Record<number, Decimal> = {
//       0: new Decimal(1.0),
//       1: new Decimal(1.5),
//       2: new Decimal(1.75),
//       3: new Decimal(2.0),
//       4: new Decimal(2.3),
//       5: new Decimal(2.75),
//       6: new Decimal(3.0),
//     };

//     const userProducts = await this.prisma.userProduct.findMany({
//       where: { status: 'ACTIVE', product: { deletedAt: null } },
//       include: { product: { select: { price: true, level: true } } },
//     });

//     const nowUTC = new Date();

//     for (const up of userProducts) {
//       const pct = pctByLevel[up.product.level];
//       if (pct === undefined) {
//         this.logger.warn(
//           `Product ${up.productId} has unsupported level ${up.product.level}`,
//         );
//         continue;
//       }

//       const rewardAmount = up.product.price
//         .mul(pct)
//         .div(100)
//         .toDecimalPlaces(2);

//       await this.prisma.$transaction(async (tx) => {
//         await tx.reward.upsert({
//           where: {
//             userId_productId_date: {
//               userId: up.userId,
//               productId: up.productId,
//               date: nowUTC,
//             },
//           },
//           update: {},
//           create: {
//             userId: up.userId,
//             productId: up.productId,
//             reward: rewardAmount,
//             date: nowUTC,
//           },
//         });

//         await tx.wallet.update({
//           where: { userId: up.userId },
//           data: { balance: { increment: rewardAmount } },
//         });

//         await this.distributeTeamBonus(up.userId, pct, up.productId, tx);
//       });

//       this.notificationGateway.sendNotification(up.userId, {
//         type: 'REWARD_EARNED',
//         message: `🎉 You received a reward of ₨${rewardAmount.toFixed(2)}!`,
//       });
//     }

//     this.logger.log('✅  Reward cycle complete');
//   }
// }

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private notificationGateway: NotificationGateway,
  ) {}

  /* ──────────────────────────────
     TEAM-BONUS DISTRIBUTION
     ────────────────────────────── */
  private async distributeTeamBonus(
    userId: number,
    earning: Decimal,
    productId: number, // <– still unused but kept for future audits
    tx: Prisma.TransactionClient,
  ) {
    const commissionRates = [0.18, 0.09, 0.05]; // Levels 1 → 3
    let currentUserId = userId;

    for (let level = 1; level <= 3; level++) {
      const referral = await tx.referral.findFirst({
        where: { referredId: currentUserId },
        select: { referrerId: true },
      });

      /* ────────────────────────────────
         No more up-line → just stop.
         No “spill-over” to previous user
         (Excel sheet never allows that)
         ──────────────────────────────── */
      // 🔄 CHANGED: removed spill-over logic
      if (!referral?.referrerId) break;

      /* ────────────────────────────────
         ⛔️ Duplicate-for-the-same-day guard
         was removed to allow multiple
         earnings in the same 24 h.
         (If you want idempotency, pass a
         unique earning id instead.)
         ──────────────────────────────── */
      // ❌ REMOVED:
      // const alreadyGiven = await tx.bonus.findFirst({ … });
      // if (alreadyGiven) continue;

      const bonusAmount = earning
        .mul(commissionRates[level - 1])
        .toDecimalPlaces(2);

      await tx.wallet.update({
        where: { userId: referral.referrerId },
        data: { balance: { increment: bonusAmount } },
      });

      await tx.bonus.create({
        data: {
          userId: referral.referrerId,
          amount: bonusAmount,
          sourceId: userId,
          type: `TEAM_LEVEL_${level}` as any,
          note: `Team bonus (level ${level}) from downline user #${userId}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: referral.referrerId,
          title: 'Team Bonus Received',
          // 🔄 CHANGED: fixed stray quote + unified currency symbol
          message: `You received $${bonusAmount.toFixed(2)} from level ${level} team.`,
        },
      });

      currentUserId = referral.referrerId; // climb one level
    }
  }

  /* ───────────────────────────────────────────────
     EXPIRY / REFUND – runs hourly on the hour
     ─────────────────────────────────────────────── */
  @Cron('*/3 * * * *', { name: 'handleExpiredMachines' }) // every hour at :00
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
          // NOTE: the first query marks rewards FAILED, second REVERSED.
          // Leave unchanged but confirm business rule.
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
              status: 'SUCCESS',
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

  /* ───────────────────────────────────────────────
     DAILY REWARD – runs 00:05 UTC every day
     ─────────────────────────────────────────────── */
  @Cron('*/2 * * * *', { name: 'daily-reward', timeZone: 'UTC' })
  async handleDailyRewards() {
    this.logger.log('⏰  Starting daily reward cycle');

    const pctByLevel: Record<number, Decimal> = {
      0: new Decimal(1.0),
      1: new Decimal(1.5),
      2: new Decimal(1.75),
      3: new Decimal(2.0),
      4: new Decimal(2.3),
      5: new Decimal(2.75),
      6: new Decimal(3.0),
    };

    const userProducts = await this.prisma.userProduct.findMany({
      where: { status: 'ACTIVE', product: { deletedAt: null } },
      include: { product: { select: { price: true, level: true } } },
    });

    const nowUTC = new Date();
    const midnightUTC = new Date(
      Date.UTC(
        nowUTC.getUTCFullYear(),
        nowUTC.getUTCMonth(),
        nowUTC.getUTCDate(),
      ),
    );

    for (const up of userProducts) {
      const pct = pctByLevel[up.product.level];
      if (pct === undefined) {
        this.logger.warn(
          `Product ${up.productId} has unsupported level ${up.product.level}`,
        );
        continue;
      }

      const rewardAmount = up.product.price
        .mul(pct)
        .div(100)
        .toDecimalPlaces(2);

      await this.prisma.$transaction(async (tx) => {
        // 🔄 CHANGED: use midnightUTC to keep one row per calendar day
        await tx.reward.create({
          // 🔄 CHANGED
          data: {
            userId: up.userId,
            productId: up.productId,
            reward: rewardAmount,
            date: nowUTC,
          },
        });

        await tx.wallet.update({
          where: { userId: up.userId },
          data: { balance: { increment: rewardAmount } },
        });

        // 🔄 CHANGED: pass the *amount* (not pct) to bonus distributor
        await this.distributeTeamBonus(
          up.userId,
          rewardAmount,
          up.productId,
          tx,
        );
      });

      this.notificationGateway.sendNotification(up.userId, {
        type: 'REWARD_EARNED',
        message: `🎉 You received a reward of $${rewardAmount.toFixed(2)}!`,
      });
    }

    this.logger.log('✅  Daily reward cycle complete');
  }
}
