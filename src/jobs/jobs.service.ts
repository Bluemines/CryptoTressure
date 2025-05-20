import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { awardPoints } from 'src/common/utils/points';
import { Decimal } from 'generated/prisma/runtime/library';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

        /* 1) refund principal (balance↑, reserved↓) */
        await tx.wallet.update({
          where: { userId: up.userId },
          data: {
            balance: { increment: price },
            reserved: { decrement: price },
          },
        });

        /* 2) mark refunded */
        await tx.userProduct.update({
          where: { id: up.id },
          data: { status: 'REFUNDED' },
        });

        /* 3) adjust trial‑fund usage if any */
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

    // UTC start of “today”
    const today = new Date();
    const startOfDayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const userProducts = await this.prisma.userProduct.findMany({
      where: { status: 'ACTIVE', product: { deletedAt: null } },
      include: { product: { select: { dailyIncome: true } } },
    });

    for (const up of userProducts) {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const amount: Decimal = up.product.dailyIncome;

        /* 1) record reward (idempotent by unique constraint) */
        try {
          await tx.reward.create({
            data: {
              userId: up.userId,
              productId: up.productId,
              reward: amount,
              date: startOfDayUTC,
            },
          });
        } catch (e: any) {
          // ignore duplicate key (P2002) but re‑throw anything else
          if (e?.code !== 'P2002') throw e;
          return;
        }

        /* 2) credit wallet balance */
        await tx.wallet.update({
          where: { userId: up.userId },
          data: { balance: { increment: amount } },
        });

        /* 3) loyalty points: 1 pt per USD earned (rounded) */
        await awardPoints(up.userId, amount.toNumber(), tx);
      });
    }

    this.logger.log('✅  Daily reward cycle complete');
  }
}
