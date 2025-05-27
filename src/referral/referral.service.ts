import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(private prisma: PrismaService) {}

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

  async getReferralTree(userId: number, maxDepth = 10) {
    const result = [];
  
    const fetchReferrals = async (referrerId: number, level: number) => {
      if (level > maxDepth) return;
  
      const referrals = await this.prisma.referral.findMany({
        where: { referrerId },
        include: {
          referred: {
            select: {
              id: true,
              username: true,
              email: true,
              referralCode: true,
              createdAt: true,
            },
          },
        },
      });
  
      for (const referral of referrals) {
        result.push({
          level,
          referralId: referral.id,
          referralCode: referral.code,
          invitedAt: referral.createdAt,
          referredId: referral.referred.id,
          username: referral.referred.username,
          email: referral.referred.email,
          joinedAt: referral.referred.createdAt,
        });
  
        await fetchReferrals(referral.referred.id, level + 1);
      }
    };
  
    await fetchReferrals(userId, 1);
    return result;
  }
  
  async getReferralTreeByAdmin(userId: number, maxDepth = 10) {
    const result = [];
  
    const fetchReferrals = async (referrerId: number, level: number) => {
      if (level > maxDepth) return;
  
      const referrals = await this.prisma.referral.findMany({
        where: { referrerId },
        include: {
          referred: {
            select: {
              id: true,
              username: true,
              email: true,
              referralCode: true,
              createdAt: true,
            },
          },
        },
      });
  
      for (const referral of referrals) {
        result.push({
          level,
          referralId: referral.id,
          referralCode: referral.code,
          invitedAt: referral.createdAt,
          referredId: referral.referred.id,
          username: referral.referred.username,
          email: referral.referred.email,
          joinedAt: referral.referred.createdAt,
        });
  
        await fetchReferrals(referral.referred.id, level + 1);
      }
    };
  
    await fetchReferrals(userId, 1);
    return result;
  }
  
// referral.service.ts
async getReferralListingByAdmin({
  referrerId,
  level = 1,
  page = 1,
  limit = 10,
}: {
  referrerId?: number;
  level?: number;
  page?: number;
  limit?: number;
}) {
  const skip = (page - 1) * limit;

  const whereClause = referrerId !== undefined ? { referrerId } : {};

  const referrals = await this.prisma.referral.findMany({
    where: whereClause,
    include: {
      referred: {
        select: {
          id: true,
          username: true,
          email: true,
          referralCode: true,
          createdAt: true,
        },
      },
    },
    skip,
    take: limit,
  });

  const result = referrals.map(referral => ({
    level,
    referralId: referral.id,
    referralCode: referral.code,
    invitedAt: referral.createdAt,
    referredId: referral.referred.id,
    username: referral.referred.username,
    email: referral.referred.email,
    joinedAt: referral.referred.createdAt,
  }));

  const total = await this.prisma.referral.count({
    where: whereClause,
  });

  return {
    data: result,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}


  
}
