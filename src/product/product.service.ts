import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Product, Prisma, Sale } from '../../generated/prisma/client';
import { ApiError } from 'src/common';
import { join } from 'path';
import { unlink } from 'fs/promises';
import {
  FindProductsParams,
  MachineUpdateInput,
  ProductCreateInput,
} from './interfaces';
import { awardPoints } from 'src/common/utils/points';
import { REFERRAL_COMMISSION_RATE } from 'src/common/config/reward.constants';
import { Decimal } from 'generated/prisma/runtime/library';
import { round } from 'src/common/utils/round.util';
import { ConfigService } from '@nestjs/config';
import { UserProductWithRemaining } from './dto/UserProductWithRemaining.dto';
import { breakdown } from 'src/auth/helper/timerBreakDown';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ────────────────── ADMIN─────────────────────────────
  async createProduct(input: ProductCreateInput): Promise<Product> {
    const {
      title,
      description,
      price,
      dailyIncome,
      image,
      userId,
      rentalDays,
      level,
    } = input;
    const exists = await this.prisma.product.findFirst({ where: { title } });
    if (exists) throw new ApiError(400, 'Product already exists');

    const roiPercent = round(dailyIncome, 2);
    return this.prisma.product.create({
      data: {
        userId,
        title,
        description,
        image,
        price,
        dailyIncome,
        rentalDays,
        roiPercent,
        level,
      },
    });
  }

  async viewAllProducts({
    skip,
    take,
    search,
  }: FindProductsParams): Promise<[Product[], number]> {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(search
        ? { title: { contains: search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ skip, take, where }),
      this.prisma.product.count({ where }),
    ]);
    return [items, total];
  }

  async updateProduct(id: number, data: MachineUpdateInput): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Product not found');

    if (data.image && existing.image) {
      const oldFile = existing.image.replace(/^\/uploads\//, '');
      const oldPath = join(process.cwd(), 'uploads', oldFile);
      try {
        await unlink(oldPath);
      } catch (err: any) {
        console.warn(`Could not delete old image ${oldPath}: ${err.message}`);
      }
    }

    return this.prisma.product.update({ where: { id }, data });
  }

  async deleteProduct(id: number): Promise<Product> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: {
        userProducts: true, // Fetch related purchases
      },
    });

    if (!existing) throw new ApiError(404, 'Product not found');

    if (existing.userProducts.length > 0) {
      throw new ApiError(
        400,
        'Cannot be deleted now: Product has been bought by users',
      );
    }

    if (existing.image) {
      const file = existing.image.replace(/^\/uploads\//, '');
      const path = join(process.cwd(), 'uploads', file);
      try {
        await unlink(path);
      } catch {
        // Ignore file not found errors
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ────────────── CUSTOMER  ──────────────────────
  async getPopularProducts(limit = 7): Promise<Product[]> {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { rentals: true, saleItems: true },
        },
      },
    });

    type WithCount = Product & {
      _count: { rentals: number; saleItems: number };
      popularity: number;
    };
    const withPop: WithCount[] = products.map((p) => ({
      ...p,
      _count: p._count,
      popularity: p._count.rentals + p._count.saleItems,
    }));

    // Pick the ones with any activity
    const activeProducts: Product[] = withPop
      .filter((p) => p.popularity > 0)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit)
      .map(({ _count: _, popularity: __, ...rest }) => rest);

    if (activeProducts.length > 0) {
      return activeProducts;
    }

    // Fallback: random products
    const pool: Product[] = withPop.map(
      ({ _count: _, popularity: __, ...rest }) => rest,
    );
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, limit);
  }

    async getAllProducts(): Promise<Product[]> {
      const products = await this.prisma.product.findMany({
        where: { deletedAt: null },
      });
      return products;
    }

  async getUserProducts(userId: number): Promise<UserProductWithRemaining[]> {
    const ups = await this.prisma.userProduct.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        product: { deletedAt: null },
      },
      include: { product: true },
    });

    const now = Date.now();
    return ups.map((up) => {
      const msLeft = up.expiresAt.getTime() - now;
      const remaining = breakdown(msLeft);

      return {
        ...up.product,
        expiresAt: up.expiresAt,
        remaining,
      };
    });
  }

  async viewProduct(id: number) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        userId: true,
        description: true,
        image: true,
        price: true,
        dailyIncome: true,
        rentalDays: true,
        roiPercent: true,
        level: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { rentals: true, saleItems: true } },
      },
    });

    if (!product) throw new ApiError(404, 'Product not found');
    return product;
  }

  async buyProduct(userId: number, productId: number): Promise<Sale> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(400, 'User not found');

    const productExist = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!productExist) throw new ApiError(400, 'Product not found');

    const userLevel = user.level;
    const productLevel = productExist.level;

    if (userLevel < productLevel) {
      throw new ApiError(
        400,
        `User level ${userLevel} is not enough to buy this product of level ${productLevel}`,
      );
    }

    /* ─── 1. Load product & buyer wallet ─────────────────────────── */
    const [product, buyerWallet] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.wallet.findUnique({ where: { userId } }),
    ]);

    if (!product || product.deletedAt)
      throw new ApiError(404, 'Product not found or unavailable');
    if (!buyerWallet) throw new ApiError(400, 'Buyer wallet missing');

    const price = product.price.toNumber();
    let walletSpend = price;
    let trialFundSpend = 0;

    /* ─── 2. Check active trial fund & determine split ───────────── */
    const trial = await this.prisma.trialFund.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    if (trial) {
      const remaining = trial.amount.minus(trial.usedAmount).toNumber();
      if (remaining > 0) {
        trialFundSpend = Math.min(price, remaining);
        walletSpend = price - trialFundSpend;
      }
    }

    /* ─── 3. Validate balance ────────────────────────────────────── */
    const balance = buyerWallet.balance.toNumber();
    if (walletSpend > balance)
      throw new ApiError(400, 'Insufficient wallet funds');

    const sellerId = product.userId;

    /* ─── 5. Execute atomic transaction ──────────────────────────── */
    const sale = await this.prisma.$transaction(async (tx) => {
      /* 5‑A. Record SALE */
      const saleRow = await tx.sale.create({
        data: {
          total: price,
          sellerId,
          buyerId: userId,
        },
      });

      /* 5‑B. Ensure seller wallet exists */
      await tx.wallet.upsert({
        where: { userId: sellerId },
        update: {},
        create: { userId: sellerId, balance: 0 },
      });

      /* 5‑D. Update buyer wallet (balance ↓, reserved ↑) */
      if (walletSpend > 0) {
        await tx.wallet.update({
          where: { userId },
          data: {
            balance: { decrement: walletSpend },
            reserved: { increment: price },
          },
        });
      } else {
        // still lock principal even if fully covered by trial fund
        await tx.wallet.update({
          where: { userId },
          data: {
            reserved: { increment: price },
          },
        });
      }

      /* 5‑E. Update trial fund usage */
      if (trialFundSpend > 0 && trial) {
        await tx.trialFund.update({
          where: { id: trial.id },
          data: { usedAmount: { increment: trialFundSpend } },
        });
      }

      /* 5‑F. Credit seller wallet */
      await tx.wallet.update({
        where: { userId: sellerId },
        data: { balance: { increment: price } },
      });

      // Prevent duplicate purchase of the same product
      // const existing = await tx.userProduct.findFirst({
      //   where: { userId, productId, status: 'ACTIVE' },
      // });
      // if (existing) {
      //   throw new ApiError(400, 'You already own this product');
      // }

      const MS_IN_DAY = 24 * 60 * 60 * 1000;

      /* 5‑G. Create UserProduct row */
      await tx.userProduct.create({
        data: {
          userId,
          productId,
          acquiredAt: new Date(),
          expiresAt:
            trialFundSpend === price
              ? trial.expiresAt
              : new Date(Date.now() + product.rentalDays * MS_IN_DAY),
          walletSpend: walletSpend,
          trialSpend: trialFundSpend,
        },
      });

      /* 5‑H. Add SaleItem (quantity always 1) */
      await tx.saleItem.create({
        data: {
          saleId: saleRow.id,
          productId,
          quantity: 1,
        },
      });

      await tx.transaction.create({
        data: {
          amount: price,
          transactiontype: 'PURCHASED',
          status: 'SUCCESS',
          user: { connect: { id: userId } },
        },
      }),
        /* 5‑I. Award loyalty points (1 pt per 10 USD spend) */
        await awardPoints(userId, Math.floor(price / 10), tx);

      return saleRow;
    });

    return sale;
  }
}
