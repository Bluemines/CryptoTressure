import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTotals } from './helper/wallet.helper';
import { Prisma } from '../../generated/prisma/client';
import { endOfDay, startOfDay } from 'date-fns';
import { Decimal } from 'generated/prisma/runtime/library';
import { AdminWalletDto } from './dto/admin-userWallets.dto';
import { AdminWalletSummary } from './interfaces/AdminWalletSummary';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  /** one user – returns { available,reserved,total } */
  async getUserWallet(userId: number) {
    // 1. Get user wallet
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    // 2. Get direct referral commissions (level 1 only)
    const referralCommissions = await this.prisma.commission.findMany({
      where: {
        referral: { referrerId: userId },
        levelDepth: 1, // direct referral
      },
      select: { amount: true },
    });
    const referralEarnings = referralCommissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    // 3. Get team earnings (level 2 and 3 commissions only)
    const teamCommissions = await this.prisma.commission.findMany({
      where: {
        levelDepth: { in: [2, 3] },
        referral: {
          referrerId: userId,
        },
      },
      select: { amount: true },
    });
    const teamEarnings = teamCommissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    // 4. Get investment earnings (mining rewards)
    const rewards = await this.prisma.reward.findMany({
      where: { userId },
      select: { reward: true },
    });
    const investmentEarnings = rewards.reduce(
      (sum, r) => sum + Number(r.reward),
      0,
    );

    // 5. Final return
    return {
      balance: Number(wallet?.balance || 0),
      reservedAmount: Number(wallet?.reserved || 0),
      referralEarnings,
      teamEarnings,
      investmentEarnings,
      total:
        Number(wallet?.balance || 0) +
        Number(wallet?.reserved || 0) +
        referralEarnings +
        teamEarnings +
        investmentEarnings,
    };
  }

  async getAdminWalletSummary(): Promise<AdminWalletSummary> {
    // 1) sum balances & reserved
    const walletAgg = await this.prisma.wallet.aggregate({
      _sum: { balance: true, reserved: true },
    });

    // 2) sum level-1 referral commissions
    const directAgg = await this.prisma.commission.aggregate({
      where: { levelDepth: 1 },
      _sum: { amount: true },
    });

    // 3) sum level-2 & 3 team commissions
    const teamAgg = await this.prisma.commission.aggregate({
      where: { levelDepth: { in: [2, 3] } },
      _sum: { amount: true },
    });

    // 4) sum all rewards
    const investAgg = await this.prisma.reward.aggregate({
      _sum: { reward: true },
    });

    // convert Decimal | null to number
    const toNum = (d: Decimal | null | undefined) =>
      d ? Number(d.toString()) : 0;

    return {
      balance: toNum(walletAgg._sum.balance),
      reservedAmount: toNum(walletAgg._sum.reserved),
      referralEarnings: toNum(directAgg._sum.amount),
      teamEarnings: toNum(teamAgg._sum.amount),
      investmentEarnings: toNum(investAgg._sum.reward),
    };
  }

  /** admin list (with pagination & optional search) */
  async listWallets(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.WalletWhereInput = search
      ? {
          user: {
            is: {
              username: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          },
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wallet.findMany({
        where,
        skip,
        take: limit,
        include: { user: { select: { username: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.wallet.count({ where }),
    ]);

    return { items, total };
  }

  /** admin – single wallet + user meta */
  async getWalletByUser(userId: number) {
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: { select: { username: true, email: true, role: true } },
      },
    });
  }

  async getWalletOverview(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found for this user');
    }

    const availableBalance = wallet.balance;
    const reservedBalance = wallet.reserved;
    const totalBalance = Number(availableBalance) + Number(reservedBalance);

    return {
      availableBalance,
      reservedBalance,
      totalBalance,
    };
  }
}
