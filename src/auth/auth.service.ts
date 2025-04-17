import { Injectable } from '@nestjs/common';
import { AuthDto, SendEmailDto, SignupDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as argon from 'argon2';
import { ApiError } from 'src/common';
import { generateCode } from 'src/common/helpers/generateCode';
import { MailService } from 'src/common/services/mail.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TrialFundService } from 'src/common/services/trial-fund.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private readonly trialFundSvc: TrialFundService,
  ) {}

  async sendEmail(dto: SendEmailDto): Promise<void> {
    const { email } = dto;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(400, 'Email already exists');
    }

    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.verification.upsert({
      where: { email },
      update: { code, expiresAt, userId: null },
      create: { email, code, expiresAt },
    });

    const info = await this.mailService.sendMail(
      email,
      'Verify your email',
      `<p>Your verification code is <b>${code}</b> and expires at ${expiresAt.toLocaleTimeString()}.</p>`,
    );

    if (!info) {
      throw new ApiError(500, 'Failed to send verification email');
    }
  }

  async signup(dto: SignupDto): Promise<void> {
    const { email, code, username, password } = dto;

    const v = await this.prisma.verification.findUnique({
      where: { email },
    });
    if (!v) {
      throw new ApiError(400, 'Email not found');
    }
    if (v.code !== code) {
      throw new ApiError(400, 'Invalid code');
    }
    if (v.expiresAt < new Date()) {
      throw new ApiError(400, 'Code expired');
    }

    const hashed = await argon.hash(password);
    const expires = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    // Transaction: create user, delete OTP, grant trial
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          password: hashed,
          emailVerified: true,
        },
      });

      await tx.verification.delete({ where: { email } });

      return tx.trialFund.create({
        data: {
          userId: user.id,
          amount: 200,
          grantedAt: new Date(),
          expiresAt: expires,
        },
      });
    });

    // Schedule the auto-recovery
    await this.trialFundSvc.scheduleRecovery(result);
  }

  async signin(dto: AuthDto) {
    return { msg: 'I have signed in' };
  }
}
