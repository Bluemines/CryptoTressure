import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class PrincipalRefundJob {
  private readonly log = new Logger(PrincipalRefundJob.name);

  // run every night at 00:10
  @Cron('10 0 * * *', { name: 'principal-refund' })
  async handleRefunds() {
    this.log.log('⏰  Checking expired machines …');

    // pick all user-products that expired AND not refunded yet
    const expired = await prisma.userProduct.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date() },
        product: { deletedAt: null },
      },
      include: { product: { select: { price: true } } },
    });

    this.log.log(`Found ${expired.length} items to refund`);

    for (const up of expired) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1️⃣  credit principal
        await tx.wallet.update({
          where: { userId: up.userId },
          data: {
            reserved: { decrement: up.product.price },
            balance: { increment: up.product.price },
          },
        });

        // 2️⃣  mark purchase as refunded
        await tx.userProduct.update({
          where: { id: up.id },
          data: { status: 'REFUNDED' },
        });
      });
    }

    this.log.log('✅  Principal-refund job finished');
  }
}
