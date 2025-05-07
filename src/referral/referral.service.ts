import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateCode } from 'src/common';
import { makeReferralCode } from 'src/common/helpers/referralCode';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationGateway } from 'src/notifications/notification.gateway';
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
}
