import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Reward } from '../../generated/prisma/client';
import { awardPoints } from '../common/utils/points';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindRewardsParams } from './interfaces/find-rewards-params.interface';

@Injectable()
export class RewardService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllAdmin({
    skip,
    take,
    userId,
    dateFrom,
    dateTo,
  }: FindRewardsParams): Promise<[Reward[], number]> {
    const where: Prisma.RewardWhereInput = {
      ...(userId ? { userId } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reward.findMany({
        skip,
        take,
        where,
        orderBy: { date: 'desc' },
        include: {
          user: { select: { id: true, username: true, email: true } },
          product: { select: { id: true, title: true } },
        },
      }),
      this.prisma.reward.count({ where }),
    ]);

    return [items, total];
  }
}
