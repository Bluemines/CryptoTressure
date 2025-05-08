import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateCode } from 'src/common';
import { makeReferralCode } from 'src/common/helpers/referralCode';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationGateway } from 'src/notifications/notification.gateway';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralResponseDto } from './dto/referral-response.dto';
@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notificationGateway: NotificationGateway,
  ) {}

  async createReferralLink(userId: number) {
    const code = makeReferralCode(25);

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });

    const appUrl = this.config.get<string>('APP_URL');
    if (!appUrl) {
      throw new Error('APP_URL is not defined in environment variables');
    }
    
    const base = appUrl.replace(/\/$/, '');
    const referralLink = `${base}/register?referral_code=${encodeURIComponent(code)}`;

     // Create notification
  await this.prisma.notification.create({
    data: {
      user: { connect: { id: userId } },
      type: 'REFERRAL_BONUS',
      title: 'Referral Link Created 🎉',
      message: `🎉 Your referral link has been created: ${referralLink}`,
    },
  });

  // Send via gateway if needed (optional)
  this.notificationGateway?.sendNotification(userId, {
    type: 'REFERRAL_CREATED',
    message: `🎉 Your referral link has been created: ${referralLink}`,
  });


    return referralLink
    
  }


  async createReferral(userId: number, createReferralDto: CreateReferralDto) {
    // Find the referred user by username
    const referredUser = await this.prisma.user.findUnique({
      where: { username: createReferralDto.referredUsername },
    });

    if (!referredUser) {
      throw new Error('User not found');
    }

    // Check if referral already exists
    const existingReferral = await this.prisma.referral.findFirst({
      where: {
        referrerId: userId,
        referredId: referredUser.id,
      },
    });

    if (existingReferral) {
      throw new Error('Referral already exists');
    }

    // Create the referral
    const referral = await this.prisma.referral.create({
      data: {
        referrerId: userId,
        referredId: referredUser.id,
        code: referredUser.referralCode, // Using the referred user's referral code
      },
    });

    // Update referrer's points (example: +100 points per referral)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        points: {
          increment: 100,
        },
      },
    });

    return this.mapToReferralResponseDto(referral);
  }

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
}




  // async getReferralLink(userId: number) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { referralCode: true },
  //   });

  //   if (!user) {
  //     throw new Error('User not found');
  //   }

  //   return {
  //     referralLink: `https://yourdomain.com/register?ref=${user.referralCode}`,
  //     referralCode: user.referralCode,
  //   };
  // }

 
  // async getReferralStats(userId: number) {
  //   const [totalReferrals, activeReferrals, totalCommissions] = await Promise.all([
  //     this.prisma.referral.count({
  //       where: { referrerId: userId },
  //     }),
  //     this.prisma.referral.count({
  //       where: {
  //         referrerId: userId,
  //         referred: {
  //           status: 'APPROVED',
  //         },
  //       },
  //     }),
  //     this.prisma.commission.aggregate({
  //       where: {
  //         referral: {
  //           referrerId: userId,
  //         },
  //       },
  //       _sum: {
  //         amount: true,
  //       },
  //     }),
  //   ]);

  //   return {
  //     totalReferrals,
  //     activeReferrals,
  //     totalCommissions: Number(totalCommissions._sum.amount || 0),
  //   };
  // }

 
