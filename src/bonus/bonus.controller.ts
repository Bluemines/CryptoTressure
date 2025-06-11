import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BonusType } from './constants';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('bonus')
export class BonusController {
  constructor(private prisma: PrismaService) {}

  @Get('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async getBonuses(@Req() req) {
    const bonuses = await this.prisma.bonus.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    });

    return new ApiResponse(200, bonuses, 'Bonuses retrieved successfully');
  }

  @Get('team/summary')
  @UseGuards(AuthGuard('jwt'))
  async getTeamBonusSummary(@Req() req) {
    const userId = req.user.sub;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const types: BonusType[] = [
      BonusType.TEAM_LEVEL_1,
      BonusType.TEAM_LEVEL_2,
      BonusType.TEAM_LEVEL_3,
    ];

    const [today, total, downlines] = await Promise.all([
      this.prisma.bonus.groupBy({
        by: ['type'],
        where: {
          userId,
          type: { in: types },
          createdAt: { gte: todayStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.bonus.groupBy({
        by: ['type'],
        where: { userId, type: { in: types } },
        _sum: { amount: true },
      }),

      this.prisma.referral.findMany({
        where: { referrerId: userId },
        select: {
          referred: {
            select: {
              id: true,
              referralsMade: {
                select: {
                  referred: {
                    select: {
                      id: true,
                      referralsMade: {
                        select: {
                          referred: { select: { id: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const summaryMap = {
      TEAM_LEVEL_1: { today: 0, total: 0, count: 0 },
      TEAM_LEVEL_2: { today: 0, total: 0, count: 0 },
      TEAM_LEVEL_3: { today: 0, total: 0, count: 0 },
    };

    today.forEach((row) => {
      summaryMap[row.type].today = Number(row._sum.amount || 0);
    });
    total.forEach((row) => {
      summaryMap[row.type].total = Number(row._sum.amount || 0);
    });

    // Count downlines for each level
    summaryMap.TEAM_LEVEL_1.count = downlines.length;
    summaryMap.TEAM_LEVEL_2.count = downlines.flatMap(
      (d) => d.referred.referralsMade,
    ).length;
    summaryMap.TEAM_LEVEL_3.count = downlines
      .flatMap((d) => d.referred.referralsMade)
      .flatMap((d2) => d2.referred.referralsMade).length;

    return Object.entries(summaryMap).map(([type, data]) => ({
      type,
      level: type.split('_')[2],
      today: data.today,
      total: data.total,
      count: data.count,
    }));
  }

  @Get('team/logs')
  @UseGuards(AuthGuard('jwt'))
  async getTeamBonusLogs(
    @Req() req,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const userId = req.user.sub;

    const teamBonusLogs = await this.prisma.bonus.findMany({
      where: {
        userId,
        type: { in: ['TEAM_LEVEL_1', 'TEAM_LEVEL_2', 'TEAM_LEVEL_3'] },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new ApiResponse(
      200,
      teamBonusLogs,
      'Team bonus logs retrieved successfully',
    );
  }
}
