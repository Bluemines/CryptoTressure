import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { subDays, subMonths, startOfDay } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      activeMachines,
      rewardsDistributed,
      platformBalance,
      totalRevenue,
      pendingWithdrawals,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.reward.aggregate({ _sum: { reward: true } }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.deposit.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.withdraw.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      activeMachines,
      rewardsDistributed: rewardsDistributed._sum.reward || 0,
      platformBalance: platformBalance._sum.balance || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingWithdrawals: pendingWithdrawals?._sum.amount || 0,
    };
  }

  async getRecentUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async getRecentWithdrawals() {
    return this.prisma.withdraw.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async getRevenueAndSales() {
    // 1. Fetch revenue data from deposits (successful deposits only)
    const revenueData = await this.prisma.deposit.groupBy({
      by: ['createdAt'],
      where: {
        status: 'SUCCESS',
      },
      _sum: {
        amount: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 2. Fetch sales data from completed sales
    const salesData = await this.prisma.sale.groupBy({
      by: ['date'],
      _sum: {
        total: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // 3. Format for monthly aggregation (example for current year)
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const currentYear = new Date().getFullYear();

    const monthlyRevenue = months.map((month, index) => {
      const monthStart = new Date(currentYear, index, 1);
      const monthEnd = new Date(currentYear, index + 1, 0);

      const monthlySum = revenueData
        .filter((d) => d.createdAt >= monthStart && d.createdAt <= monthEnd)
        .reduce((sum, item) => sum + (Number(item._sum.amount) || 0), 0);

      return { month, amount: Number(monthlySum.toFixed(2)) };
    });

    const monthlySales = months.map((month, index) => {
      const monthStart = new Date(currentYear, index, 1);
      const monthEnd = new Date(currentYear, index + 1, 0);

      const monthlySum = salesData
        .filter((s) => s.date >= monthStart && s.date <= monthEnd)
        .reduce((sum, item) => sum + (Number(item._sum.total) || 0), 0);

      return { month, amount: Number(monthlySum.toFixed(2)) };
    });

    return {
      revenue: monthlyRevenue,
      sales: monthlySales,
    };
  }

  async getUserDashboardStats(userId: number) {
    return {
      currentDeposit: await this.getCurrentDeposit(userId),
      currentBalance: await this.getCurrentBalance(userId),
      totalWithdraw: await this.getTotalWithdraw(userId),
      totalReferralBonus: await this.getTotalReferralBonus(userId),
    };
  }

  private async getCurrentDeposit(userId: number): Promise<number> {
    const { _sum } = await this.prisma.deposit.aggregate({
      _sum: { amount: true },
      where: { userId, status: 'SUCCESS' },
    });
    return _sum.amount?.toNumber() ?? 0;
  }

  private async getCurrentBalance(userId: number): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balance: true },
    });
    return wallet?.balance.toNumber() ?? 0;
  }

  private async getTotalWithdraw(userId: number): Promise<number> {
    const { _sum } = await this.prisma.withdraw.aggregate({
      _sum: { amount: true },
      where: { userId, status: 'APPROVED' },
    });
    return _sum.amount?.toNumber() ?? 0;
  }

  private async getTotalReferralBonus(userId: number): Promise<number> {
    const { _sum } = await this.prisma.commission.aggregate({
      _sum: { amount: true },
      where: { referral: { referrerId: userId } },
    });
    return _sum.amount?.toNumber() ?? 0;
  }
}
