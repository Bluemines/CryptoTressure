import { ForbiddenException, Injectable } from '@nestjs/common';
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
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { breakdown } from './helper/timerBreakDown';
import { LevelService } from 'src/level/level.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private readonly trialFundSvc: TrialFundService,
    private jwt: JwtService,
    private config: ConfigService,
    private readonly levelService: LevelService,
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
    console.log('code', code);
    const info = await this.mailService.sendMail(
      email,
      'Verify your email',
      `<p>Your verification code is <b>${code}</b> and expires at ${expiresAt.toLocaleTimeString()}.</p>`,
    );

    if (!info) {
      throw new ApiError(500, 'Failed to send verification email');
    }
  }

  /**
   * Signup flow:
   *  1. Verify OTP
   *  2. Create user, wallet, level row, trial fund; handle referral bonuses
   *  3. Delete verification row
   *  4. Send welcome e‑mail
   */
  async signup(dto: SignupDto): Promise<void> {
    const { email, code, username, password } = dto;
  
    // 1. OTP Validation
    const v = await this.prisma.verification.findUnique({ where: { email } });
    if (!v) throw new ApiError(400, 'Email not found');
    if (v.code !== code) throw new ApiError(400, 'Invalid code');
    if (v.expiresAt < new Date()) throw new ApiError(400, 'Code expired');
  
    // 2. Uniqueness Check
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }],
      },
    });
    if (existingUser) throw new ApiError(409, 'Email or username already exists');
  
    // 3. Password Hashing
    const hashed = await argon.hash(password);
  
    // 4. Constants
    const trialExpiry = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const referralBonusBase = 3; // % of deposit for referrer
  
    let trialFund;
    try {
      trialFund = await this.prisma.$transaction(async (tx) => {
        // A: Create User
        const user = await tx.user.create({
          data: {
            email: dto.email,
            phone: dto.phone,
            username: dto.username,
            password: hashed,
            referralCode: Date.now().toString().slice(-9),
            emailVerified: true,
            status: 'APPROVED',
          },
        });
  
        // B: Create Wallet
        await tx.wallet.create({ data: { userId: user.id, balance: 0, reserved: 0 } });
  
        // C: Create User Level
        await tx.userLevel.create({
          data: {
            user: {
              connect: { id: user.id },
            },
            level: {
              connectOrCreate: {
                where: { level: 0 },
                create: { level: 0, points: 0 },
              },
            },
          },
        });
  
        // D: Handle Referral
        if (dto.referralCode) {
          const referrer = await tx.user.findUnique({
            where: { referralCode: dto.referralCode },
          });
          if (!referrer) throw new ApiError(400, 'Referral code is invalid');
  
          // Link referral
          await tx.referral.create({
            data: {
              code: Date.now().toString().slice(-9),
              referrerId: referrer.id,
              referredId: user.id,
            },
          });
  
          // Save referralBonus config to user for later use (after deposit)
          await tx.user.update({
            where: { id: user.id },
            data: {
              referrerId: referrer.id,
              referralBonusPercent: referralBonusBase, // track for future bonus logic
            },
          });
          let currentReferrerId = referrer.id;
          for (let i = 0; i < 3 && currentReferrerId; i++) {
            await this.levelService.evaluateUserLevel(currentReferrerId);

            const parentReferral = await tx.user.findUnique({
              where: { id: currentReferrerId },
              select: { referrerId: true },
            });

            currentReferrerId = parentReferral?.referrerId ?? null;
         }
        }
  
        // E: Delete OTP
        await tx.verification.delete({ where: { email: dto.email } });
  
        // F: Default Product
        const defaultProduct = await tx.product.findFirst({
          where: { deletedAt: null },
          orderBy: { id: 'asc' },
        });
  
        // G: Trial Fund
        return tx.trialFund.create({
          data: {
            userId: user.id,
            productId: defaultProduct?.id,
            amount: 200,
            expiresAt: trialExpiry,
          },
        });
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiError(409, 'Email or username already exists');
      }
      throw e;
    }
  
    // 6. Schedule Trial Fund Recovery
    await this.trialFundSvc.scheduleRecovery(trialFund);
  
    // 7. Send Welcome Email
    await this.mailService.sendMail(
      dto.email,
      'Welcome to Bluemines',
      'Welcome to Bluemines',
    );
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

    const trialFund = await this.prisma.trialFund.findUnique({
      where: { userId: user.id },
    });
    const ms = trialFund ? trialFund.expiresAt.getTime() - Date.now() : 0;
    const trialFundTimeLeft = breakdown(ms);
    const trialFundAmount = trialFund
      ? trialFund.amount.minus(trialFund.usedAmount)
      : 0;
    let trialRemainingMs = 0;
    if (trialFund) {
      trialRemainingMs = trialFund.expiresAt.getTime() - Date.now();
    }

    const payload = {
      sub: user.id,
      email,
      role: user.role,
      points: user.points,
    };

    const secret = this.config.get<string>('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '6h',
      secret: secret,
    });

    return {
      access_token: token,
      ...payload,
      trialFundTimeLeft,
      trialFundAmount,
    };
  }

  async getCurrentUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        profile: true,
        phone: true,
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

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new ForbiddenException('User not found.');
    }

    // 1️⃣ verify current password

    const match = await argon.verify(user.password, currentPassword);
    if (!match) {
      throw new ApiError(400, 'Invalid credentials');
    }

    // 2️⃣ hash new password
    const hash = await argon.hash(newPassword);

    // 3️⃣ update
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }
}
