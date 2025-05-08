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
}
