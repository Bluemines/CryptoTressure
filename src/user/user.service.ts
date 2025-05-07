import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAllUsersDTO, UpdateUserDTO, UserRewardDTO } from './dto';
import { UserListView } from './interfaces';
import { ApiError } from 'src/common';
import { Reward, User, Prisma } from '../../generated/prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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
      where.emailVerified = true;
    } else if (status === 'INACTIVE') {
      where.emailVerified = false;
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

    return this.prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }
  // CUSTOMER
  async updateUser(userId: number, data: UpdateUserDTO): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new ApiError(404, 'User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}
