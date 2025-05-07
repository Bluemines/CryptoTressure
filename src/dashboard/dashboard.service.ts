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
    //   activeMachines,
      rewardsDistributed,
      platformBalance,
      totalRevenue,
      pendingWithdrawals
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
    //   this.prisma.machine.count({ where: { status: 'ACTIVE' } }),
      this.prisma.reward.aggregate({ _sum: { reward: true } }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.deposit.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      this.prisma.withdraw.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      activeMachines: 0,
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

    async getRevenueStats(range: 'ALL' | '12_MONTHS' | '30_DAYS' | '7_DAYS' | '24_HOURS') {
      let fromDate: Date | undefined;
  
      const now = new Date();
      switch (range) {
        case '12_MONTHS':
          fromDate = subMonths(now, 12);
          break;
        case '30_DAYS':
          fromDate = subDays(now, 30);
          break;
        case '7_DAYS':
          fromDate = subDays(now, 7);
          break;
        case '24_HOURS':
          fromDate = subDays(now, 1);
          break;
        case 'ALL':
        default:
          fromDate = undefined;
      }
  
      const deposits = await this.prisma.deposit.findMany({
        where: {
          status: 'SUCCESS',
          ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
  
      // Group revenue by day
      const grouped = new Map<string, number>();
      deposits.forEach((d) => {
        const date = startOfDay(d.createdAt).toISOString().split('T')[0];
        grouped.set(date, (grouped.get(date) || 0) + d.amount.toNumber());

      });
  
      // Return sorted results
      const sortedStats = Array.from(grouped.entries()).map(([date, value]) => ({
        date,
        revenue: value,
        sales: value, // For now, treating sales same as revenue
      }));
  
      return sortedStats;
    }
    async getUserDashboardStats() {
        return {
          currentDeposit: await this.getCurrentDeposit(),
          currentBalance: await this.getCurrentBalance(),
          totalWithdraw: await this.getTotalWithdraw(),
          totalReferralBonus: await this.getTotalReferralBonus()
        };
      }
    
      private async getCurrentDeposit() {
        const result = await this.prisma.deposit.aggregate({
          _sum: { amount: true },
          where: { status: 'SUCCESS' }
        });
        return result._sum.amount || 0;
      }
    
      private async getCurrentBalance() {
        const result = await this.prisma.wallet.aggregate({
          _sum: { balance: true }
        });
        return result._sum.balance || 0;
      }
    
      private async getTotalWithdraw() {
        const result = await this.prisma.withdraw.aggregate({
          _sum: { amount: true },
          where: { status: 'APPROVED' }
        });
        return result._sum.amount || 0;
      }
    
      private async getTotalReferralBonus() {
        const result = await this.prisma.commission.aggregate({
          _sum: { amount: true }
        });
        return result._sum.amount || 0;
      }
}
