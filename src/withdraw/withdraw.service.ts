import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestWithdrawDto } from './dto/request-withdraw.dto';
import { ApiError } from 'src/common';
import { Decimal } from '@prisma/client/runtime/library';
import { WithdrawStatus } from '../../generated/prisma/client';
import { EasypaisaClient } from 'src/easypaisa/easypaisa.client';
import { NotificationGateway } from 'src/notifications/notification.gateway';

const FEE_RATE = 0.03; // 3 %

@Injectable()
export class WithdrawService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly easypaisa: EasypaisaClient,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /* ───────────────────── USER FLOW ───────────────────── */
  async request(userId: number, dto: RequestWithdrawDto) {
    console.log('1');
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    console.log('2');
    if (!wallet) throw new ApiError(400, 'Wallet not found');

    const amount = new Decimal(dto.amount);
    const fee = amount.mul(FEE_RATE).toDecimalPlaces(2);
    const total = amount.plus(fee);

    if (wallet.balance.lt(total))
      throw new ApiError(400, 'Insufficient balance');

    return this.prisma.$transaction(async (tx) => {
      /* 1️⃣  lock the money in “reserved” */
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: total },
          reserved: { increment: total },
        },
      });

      /* 2️⃣  create the withdraw row (PENDING by default) */
      return tx.withdraw.create({
        data: {
          userId,
          amount,
          fee,
          total,
          msisdn: dto.msisdn ?? null,
          cnic: dto.cnic ?? null,
        },
      });
    });
  }

  /* ───────────────────── ADMIN FLOW ──────────────────── */

  listPending() {
    return this.prisma.withdraw.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { username: true, email: true } } },
    });
  }

  /* ─────────────────── ADMIN approve (send money) ───────────────────── */
  async approve(id: number) {
    const wd = await this.prisma.withdraw.findUnique({ where: { id } });
    if (!wd || wd.status !== 'PENDING')
      throw new ApiError(400, 'Withdraw not pending');

    const fee = new Decimal(wd.amount).mul(0.03).toDecimalPlaces(2);
    const netAmount = new Decimal(wd.amount).minus(fee);

    const identifier = wd.msisdn
      ? { msisdn: wd.msisdn }
      : wd.cnic
        ? { cnic: wd.cnic }
        : null;
    if (!identifier) throw new ApiError(400, 'No msisdn or cnic attached');

    // TODO: Uncomment when payment integration is done
    // const easypaisaTxnId = await this.easypaisa.sendMoney({
    //   ...identifier,
    //   amount: netAmount.toString(),
    //   reference: `WD-${wd.id}`,
    // });

    await this.prisma.$transaction([
      this.prisma.withdraw.update({
        where: { id },
        data: {
          status: 'APPROVED',
          // externalId: easypaisaTxnId,
          externalId: 'XXX',
          fee: fee,
          total: netAmount,
          processedAt: new Date(),
        },
      }),
      this.prisma.wallet.update({
        where: { userId: wd.userId },
        data: { reserved: { decrement: wd.amount } },
      }),
    ]);

    this.notificationGateway.sendNotification(wd.userId, {
      type: 'WALLET_UPDATED',
      message: `✅ Your withdrawal request of ₨${wd.amount.toFixed(2)} has been approved. A fee of ₨${fee.toFixed(2)} was applied and ₨${netAmount.toFixed(2)} has been sent to you.`,
    });

    return { success: true };
  }

  /* ─────────────── ADMIN reject ─────────────────── ─────── */
  async reject(id: number) {
    const wd = await this.prisma.withdraw.findUnique({ where: { id } });
    if (!wd || wd.status !== 'PENDING')
      throw new ApiError(400, 'Withdraw not pending');

    await this.prisma.$transaction(async (tx) => {
      // mark row as suspended
      await tx.withdraw.update({
        where: { id },
        data: { status: WithdrawStatus.SUSPENDED },
      });

      // give the money back (reserved → balance)
      await tx.wallet.update({
        where: { userId: wd.userId },
        data: {
          reserved: { decrement: wd.total },
          balance: { increment: wd.total },
        },
      });
    });
  }

  // src/withdraw/withdraw.service.ts
  async getPaginatedWithdrawals(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await this.prisma.$transaction([
      this.prisma.withdraw.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.withdraw.count(),
    ]);

    return {
      data: withdrawals,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  // src/withdraw/withdraw.service.ts

  async getUserWithdrawals(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await this.prisma.$transaction([
      this.prisma.withdraw.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.withdraw.count({ where: { userId } }),
    ]);

    return {
      data: withdrawals,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }
}
