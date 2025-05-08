import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateCode } from 'src/common';
import { makeReferralCode } from 'src/common/helpers/referralCode';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationGateway } from 'src/notifications/notification.gateway';
import { CreateReferralDto } from './dto/create-referral.dto';
import { PaginatedReferralResponseDto, ReferralResponseDto } from './dto/referral-response.dto';
import { ReferralFilterDto } from './dto/referral-filter.dto';
@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationGateway: NotificationGateway,
  ) {}

  

  async getReferralHistory(userId: number) {
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true,
            status: true,
          },
        },
        commissions: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return referrals.map((referral) => {
      const totalCommissions = referral.commissions.reduce(
        (sum, commission) => sum + Number(commission.amount),
        0,
      );

      return {
        id: referral.id,
        username: referral.referred.username,
        email: referral.referred.email,
        joinedDate: referral.referred.createdAt,
        status: referral.referred.status,
        earnedCommissions: totalCommissions,
      };
    });
  }

 private mapToReferralResponseDto(referral: any): ReferralResponseDto {
    return {
      id: referral.id,
      createdAt: referral.createdAt,
      referrerId: referral.referrerId,
      referredId: referral.referredId,
      code: referral.code,
    };
  }


  async getReferrals(filter: ReferralFilterDto): Promise<PaginatedReferralResponseDto> {
    const where: any = {};

    if (filter.search) {
      where.OR = [
        { referrer: { username: { contains: filter.search } } },
        { referred: { username: { contains: filter.search } } }
      ];
    }

    if (filter.level) {
      where.commissions = {
        some: { levelDepth: filter.level }
      };
    }

    if (filter.status) {
      where.commissions = {
        some: { status: filter.status.toUpperCase() }
      };
    }

    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = new Date(filter.fromDate);
      if (filter.toDate) where.createdAt.lte = new Date(filter.toDate);
    }

    const [total, referrals] = await Promise.all([
      this.prisma.referral.count({ where }),
      this.prisma.referral.findMany({
        where,
        include: {
          referrer: { select: { username: true } },
          referred: { select: { username: true } },
          commissions: {
            select: {
              amount: true,
              levelDepth: true,
              status: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const data = referrals.flatMap(referral => 
      referral.commissions.map(commission => ({
        id: referral.id,
        referrerName: referral.referrer.username,
        level: commission.levelDepth,
        referredName: referral.referred.username,
        commission: Number(commission.amount),
        date: commission.createdAt,
        status: commission.status === 'SUCCESS' ? 'Success' : 'Failed'
      }))
    );

    return {
      data,
      total,
      page: filter.page,
      limit: filter.limit
    };
  }

}