import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateCode } from 'src/common';
import { makeReferralCode } from 'src/common/helpers/referralCode';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReferralService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async createReferralLink(userId: number) {
    const code = makeReferralCode(25);

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });

    const base = this.config.get<string>('APP_URL')!.replace(/\/$/, '');
    return `${base}/register?referral_code=${encodeURIComponent(code)}`;
  }
}
