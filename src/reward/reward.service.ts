import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Reward } from '../../generated/prisma/client';
import { awardPoints } from '../common/utils/points';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindRewardsParams } from './interfaces/find-rewards-params.interface';
import { UserRewardDTO } from 'src/user/dto';
import { ApiError } from 'src/common';

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

  async userReward(dto: UserRewardDTO): Promise<Reward> {
    const { id: userId, product: productId, reward: amount } = dto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'User not found');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new ApiError(404, 'Product not found');

    const [rewardRecord] = await this.prisma.$transaction([
      this.prisma.reward.create({
        data: {
          user: { connect: { id: userId } },
          product: { connect: { id: productId } },
          reward: amount,
          date: new Date(),
        },
      }),
      this.prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: amount } },
      }),
    ]);

    return rewardRecord;
  }
}
