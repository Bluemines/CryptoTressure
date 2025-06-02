import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAllUsersDTO, UpdateUserDTO, UserRewardDTO } from './dto';
import { UserListView } from './interfaces';
import { ApiError } from 'src/common';
import { Reward, User, Prisma } from '../../generated/prisma/client';
import { NotificationGateway } from 'src/notifications/notification.gateway';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private notificationGateway: NotificationGateway,
  ) {}

  async getAllUsers(
    dto: GetAllUsersDTO,
  ): Promise<{ items: UserListView[]; total: number }> {
    const { page = 1, limit = 10, search, status, time = 'ALL' } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { role: 'USER' };

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status === 'APPROVED') {
      // only email-verified, non-suspended users
      where.emailVerified = true;
      where.status = 'APPROVED';
    } else if (status === 'INACTIVE') {
      // folks who haven’t verified their email
      where.emailVerified = false;
    } else if (status === 'SUSPENDED') {
      // only suspended accounts
      where.status = 'SUSPENDED';
    }

    if (time && time !== 'ALL') {
      const cutoff = new Date();
      if (time === '24H') {
        cutoff.setHours(cutoff.getHours() - 24);
      } else if (time.endsWith('d')) {
        const days = parseInt(time.slice(0, -1), 10);
        cutoff.setDate(cutoff.getDate() - days);
      }
      where.createdAt = { gte: cutoff };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          username: true,
          phone: true,
          email: true,
          emailVerified: true,
          level: true,
          referralCode: true,
          role: true,
          status: true,
          wallet: {
            select: {
              balance: true,
            },
          },
          referralsReceived: {
            select: {
              referrer: {
                select: {
                  username: true,
                },
              },
            },
            take: 1,
          },
          rewards: {
            select: {
              reward: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async getUserById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        username: true,
        phone: true,
        email: true,
        emailVerified: true,
        level: true,
        referralCode: true,
        role: true,
        status: true,
        profile:true,
        wallet: {
          select: {
            balance: true,
          },
        },
        referralsReceived: {
          select: {
            referrer: {
              select: {
                username: true,
              },
            },
          },
          take: 1,
        },
      },
    });
  }

  async suspendUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (user.status === 'SUSPENDED') {
      throw new ApiError(400, 'User already suspended');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
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

      this.prisma.notification.create({
        data: {
          user: { connect: { id: userId } },
          type: 'REWARD_EARNED',
          title: 'Reward Earned 🎉',
          message: `🎉 You received a reward of ₨${amount}!`,
        },
      }),
    ]);

    this.notificationGateway.sendNotification(userId, {
      type: 'REWARD_EARNED',
      message: `🎉 You received a reward of ₨${amount}!`,
    });

    return rewardRecord;
  }

  async updateUser(
    userId: number,
    data: UpdateUserDTO & { profile?: string },
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getUserStats() {
    const [
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      //   activeMachines,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.product.count(),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      suspendedUsers,
      activeMachines: 0,
    };
  }
}
