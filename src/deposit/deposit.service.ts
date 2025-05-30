import { HttpService } from '@nestjs/axios';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateId } from './helpers/index';
import * as crypto from 'node:crypto';
import { AdminDepositDto } from './dto/adminDeposit.dto';
import { ApiError } from 'src/common';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '../../generated/prisma';
import { AdminDepositListDto } from './dto/admin-deposit-list.dto';
import {
  REFERRAL_BONUS_PERCENT,
  DEPOSIT_BONUS_PERCENT,
  DEPOSIT_LOCK_DAYS,
  BONUS_LOCK_DAYS
} from 'src/constant/deposit';
import { LevelService } from 'src/level/level.service';




@Injectable()
export class DepositService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private readonly levelService: LevelService,
  ) {}

  async userDepositsService(userId: number) {
    const deposits = this.prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!deposits) {
      throw new ApiError(400, 'User has zero deposits');
    }

    return deposits;
  }

  /** 1. user clicks “Top-up” */
  async initDeposit(userId: number, amount: number) {
    // create local record first
    const deposit = await this.prisma.deposit.create({
      data: {
        userId,
        amount,
        reference: generateId(), // use your own helper
      },
    });

    // call Easypaisa “create payment” REST
    const payload = {
      merchant_id: process.env.EASYPAISA_MERCHANT_ID,
      amount,
      order_ref: deposit.reference,
      callback: process.env.EASYPAISA_CALLBACK_URL,
    };

    const { data } = await this.http
      .post('https://easypaisa.com/api/v1/payment', payload, {
        headers: this.sign(payload),
      })
      .toPromise();

    /* data.pay_url => redirect the user in front-end */
    return { payUrl: data.pay_url, reference: deposit.reference };
  }

  /** 2. Easypaisa webhook hits us */
  // async handleIPN(body: any, signature: string) {
  //   // const verified = this.verifySig(JSON.stringify(body), signature);
  //   // if (!verified) throw new ForbiddenException('Bad signature');

  //   const { reference, transactionId, status } = body;

  //   const deposit = await this.prisma.deposit.findUnique({
  //     where: { reference: reference },
  //   });
  //   if (!deposit || deposit.status !== 'PENDING') return;

  //   if (status === 'SUCCESS') {
  //     await this.prisma.$transaction([
  //       this.prisma.deposit.update({
  //         where: { id: deposit.id },
  //         data: {
  //           status: 'SUCCESS',
  //           externalId: transactionId,
  //           verifiedAt: new Date(),
  //         },
  //       }),
  //       this.prisma.wallet.update({
  //         where: { userId: deposit.userId },
  //         data: { balance: { increment: deposit.amount } },
  //       }),
  //     ]);
  //   } else {
  //     await this.prisma.deposit.update({
  //       where: { id: deposit.id },
  //       data: { status: 'FAILED', externalId: transactionId },
  //     });
  //   }

  // }
  async handleIPN(body: any, signature: string) {
    // const verified = this.verifySig(JSON.stringify(body), signature);
    // if (!verified) throw new ForbiddenException('Bad signature');
  
    const { reference, transactionId, status } = body;
  
    const deposit = await this.prisma.deposit.findUnique({
      where: { reference },
    });
  
    if (!deposit || deposit.status !== 'PENDING') return;
  
    if (status === 'SUCCESS') {
      await this.prisma.$transaction(async (tx) => {
        // 1. Update main deposit
        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'SUCCESS',
            externalId: transactionId,
            verifiedAt: new Date(),
            lockedUntil: new Date(Date.now() + DEPOSIT_LOCK_DAYS * 86400000),
          },
        });
  
        // 2. Update wallet with main deposit
        await tx.wallet.update({
          where: { userId: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        });

        await tx.transaction.create({
          data: {
            transactiontype: 'DEPOSIT',
            amount: Number(deposit.amount),
            status: 'SUCCESS',
            userId: deposit.userId,
          },
        });
  
        // 3. First deposit bonus logic
        const user = await tx.user.findUnique({
          where: { id: deposit.userId },
        });
  
        if (!user?.firstDepositBonus) {
          const bonusAmount = Number(deposit.amount) * (DEPOSIT_BONUS_PERCENT / 100);
  
          // Create bonus deposit
          await tx.deposit.create({
            data: {
              userId: deposit.userId,
              amount: bonusAmount,
              reference: `BONUS-${deposit.reference}`,
              lockedUntil: new Date(Date.now() + BONUS_LOCK_DAYS * 86400000),
              status: 'SUCCESS',
              provider: 'BONUS',
              verifiedAt: new Date(),
            },
          });
  
          // Update user and wallet for bonus
          await Promise.all([
            tx.user.update({
              where: { id: deposit.userId },
              data: { firstDepositBonus: true },
            }),
            tx.wallet.update({
              where: { userId: deposit.userId },
              data: { balance: { increment: bonusAmount } },
            }),
          ]);
        }
      });
  
      const referral = await this.prisma.referral.findFirst({
        where: { referredId: deposit.userId },
        include: { referrer: true },
      });
  
      if (referral) {
        const previousDeposits = await this.prisma.deposit.count({
          where: {
            userId: deposit.userId,
            status: 'SUCCESS',
            id: { not: deposit.id },
            provider: { not: 'BONUS' },
          },
        });
  
        if (previousDeposits === 0) {
          const commissionAmount = Number(deposit.amount) * (REFERRAL_BONUS_PERCENT / 100);
  
          await this.prisma.commission.create({
            data: {
              amount: commissionAmount,
              percentage: REFERRAL_BONUS_PERCENT,
              levelDepth: 1,
              referralId: referral.id,
              status: 'APPROVED', 
            },
          });
  
          await this.prisma.wallet.update({
            where: { userId: referral.referrer.id },
            data: { balance: { increment: commissionAmount } },
          });
        }
      }
      await this.levelService.evaluateUserLevel(deposit.userId);
    
    } else {
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: 'FAILED', externalId: transactionId },
      });
    }
  }

  // --- helpers --------------------------------------------------------------
  private sign(payload: object) {
    const hmac = crypto
      .createHmac('sha256', process.env.EASYPAISA_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    return { 'X-Sign': hmac };
  }

  private verifySig(raw: string, sig: string) {
    const h = crypto.createHmac('sha256', process.env.EASYPAISA_SECRET);
    h.update(raw);
    return h.digest('hex') === sig;
  }

  async adminDepositService(dto: AdminDepositDto) {
    const { amount, email } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    await this.prisma.$transaction([
      this.prisma.deposit.create({
        data: {
          reference: uuidv4(),
          amount,
          status: 'SUCCESS',
          provider: 'admin-manual',
          verifiedAt: new Date(),
          user: { connect: { id: user.id } },
        },
      }),
      this.prisma.wallet.update({
        where: { userId: user.id },
        data: { balance: { increment: amount } },
      }),
      this.prisma.transaction.create({
        data: {
          amount,
          transactiontype: 'DEPOSIT',
          status: 'SUCCESS',
          user: { connect: { id: user.id } },
        },
      }),
    ] as Prisma.PrismaPromise<unknown>[]);

    return { success: true };
  }

  async listAdminDepositsForUsers(dto: AdminDepositListDto) {
    const skip = (dto.page - 1) * dto.limit;
    const where = { provider: 'admin-manual' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deposit.findMany({
        where,
        skip,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, username: true },
          },
        },
      }),
      this.prisma.deposit.count({ where }),
    ]);

    const data = items.map((d) => ({
      id: d.id,
      reference: d.reference,
      amount: d.amount,
      status: d.status,
      provider: d.provider,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
      user: {
        id: d.user.id,
        email: d.user.email,
        username: d.user.username,
      },
    }));

    return { items: data, total };
  }
 
  
  async getDeposits(params: {
    page: number;
    limit: number;
    status?: string;
    userId: number; // Ensure type is number
  }) {
    const { page, limit, status, userId } = params;
  
    const where: any = { userId };
    if (status) where.status = status;
  
    const [deposits, total] = await Promise.all([
      this.prisma.deposit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
      this.prisma.deposit.count({ where }),
    ]);
  
    return {
      data: deposits,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
  
}
