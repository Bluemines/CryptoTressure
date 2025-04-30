import { Injectable } from '@nestjs/common';
import { LoginDto, SendEmailDto, SignupDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { ApiError } from 'src/common';
import { generateCode } from 'src/common/helpers/generateCode';
import { MailService } from 'src/common/services/mail.service';
import { TrialFundService } from 'src/common/services/trial-fund.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { awardPoints } from 'src/common/utils/points';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private readonly trialFundSvc: TrialFundService,
    private jwt: JwtService,
    private config: ConfigService,
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
    const trialExpiry = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    // Transaction: create user, delete OTP, grant trial
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          password: hashed,
          emailVerified: true,
          status: 'APPROVED',
        },
      });

      await tx.wallet.create({
        data: { user: { connect: { id: user.id } }, balance: 0 },
      });

      await tx.userLevel.create({
        data: {
          user: { connect: { id: user.id } },
          level: {
            connectOrCreate: {
              where: { level: 1 },
              create: { level: 1, points: 0 },
            },
          },
        },
      });

      if (dto.referralCode) {
        const referrer = await tx.user.findUnique({
          where: { referralCode: dto.referralCode },
        });
        if (referrer) {
          await tx.referral.create({
            data: {
              code: dto.referralCode,
              referrerId: referrer.id,
              referredId: user.id,
            },
          });
          await tx.wallet.update({
            where: { userId: referrer.id },
            data: { balance: { increment: 10 } },
          });
          await awardPoints(referrer.id, 10, tx);
        }
      }

      await tx.verification.delete({ where: { email } });

      const defaultProduct = await tx.product.findFirst();
      const tfData: any = {
        user: { connect: { id: user.id } },
        amount: 200,
        grantedAt: new Date(),
        expiresAt: trialExpiry,
      };
      if (defaultProduct) {
        tfData.product = { connect: { id: defaultProduct.id } };
      }
      return tx.trialFund.create({ data: tfData });
    });

    // Schedule the auto-recovery
    await this.trialFundSvc.scheduleRecovery(result);
  }

  async signin(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError(400, 'User not found');
    }

    const match = await argon.verify(user.password, password);
    if (!match) {
      throw new ApiError(400, 'Invalid credentials');
    }

    const payload = { sub: user.id, email, role: user.role };

    const secret = this.config.get<string>('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '1d',
      secret: secret,
    });

    return { access_token: token };
  }

  async getCurrentUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return user;
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new ApiError(404, 'Email not found');

    const code = generateCode(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordReset.upsert({
      where: { userId: user.id },
      create: { userId: user.id, code, expiresAt },
      update: { code, expiresAt, used: false },
    });

    await this.mailService.sendMail(
      dto.email,
      'Your password reset code',
      `<p>Your code is <b>${code}</b> and expires at ${expiresAt.toLocaleTimeString()}.</p>`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const { email, code, newPassword, confirmPassword } = dto;
    if (newPassword !== confirmPassword) {
      throw new ApiError(400, 'Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, 'Email not found');

    const pr = await this.prisma.passwordReset.findUnique({
      where: { userId: user.id },
    });
    if (!pr || pr.used) throw new ApiError(400, 'No reset requested');
    if (pr.code !== code) throw new ApiError(400, 'Invalid code');
    if (pr.expiresAt < new Date()) throw new ApiError(400, 'Code expired');

    const hash = await argon.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hash },
      }),
      this.prisma.passwordReset.update({
        where: { userId: user.id },
        data: { used: true },
      }),
    ]);
  }
}
