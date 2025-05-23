import { HttpService } from '@nestjs/axios';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { generateId } from './helpers/index';
import * as crypto from 'node:crypto';
import { AdminDepositDto } from './dto/adminDeposit.dto';
import { ApiError } from 'src/common';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class DepositService {
  constructor(
    private prisma: PrismaService,
    private http: HttpService,
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
  async handleIPN(body: any, signature: string) {
    const verified = this.verifySig(JSON.stringify(body), signature);
    if (!verified) throw new ForbiddenException('Bad signature');

    const { order_ref, tx_id, status } = body;

    const deposit = await this.prisma.deposit.findUnique({
      where: { reference: order_ref },
    });
    if (!deposit || deposit.status !== 'PENDING') return;

    if (status === 'SUCCESS') {
      await this.prisma.$transaction([
        this.prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'SUCCESS',
            externalId: tx_id,
            verifiedAt: new Date(),
          },
        }),
        this.prisma.wallet.update({
          where: { userId: deposit.userId },
          data: { balance: { increment: deposit.amount } },
        }),
      ]);
    } else {
      await this.prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: 'FAILED', externalId: tx_id },
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
}
