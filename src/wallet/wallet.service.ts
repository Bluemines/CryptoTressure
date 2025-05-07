import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTotals } from './helper/wallet.helper';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  /** one user – returns { available,reserved,total } */
  async getUserWallet(userId: number) {
    const w = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!w) return { available: 0, reserved: 0, total: 0 };
    return getTotals(w);
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
