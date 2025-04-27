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

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────── ADMIN─────────────────────────────
  async createProduct(input: ProductCreateInput): Promise<Product> {
    const { title, description, price, dailyIncome, fee, image, userId } =
      input;
    const exists = await this.prisma.product.findFirst({ where: { title } });
    if (exists) throw new ApiError(400, 'Product already exists');
    return this.prisma.product.create({
      data: {
        userId,
        title,
        description,
        image,
        price,
        dailyIncome,
        fee,
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
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Product not found');

    if (existing.image) {
      const file = existing.image.replace(/^\/uploads\//, '');
      const path = join(process.cwd(), 'uploads', file);
      try {
        await unlink(path);
      } catch {
        /* ignore */
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ────────────── CUSTOMER  ──────────────────────
  async getPopularProducts(limit = 3): Promise<Product[]> {
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

  async getUserProducts(userId: number): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { userProducts: { some: { userId } } },
          { rentals: { some: { userId } } },
          {
            saleItems: {
              some: {
                sale: { buyerId: userId },
              },
            },
          },
        ],
      },
    });
  }

  async viewProduct(
    id: number,
  ): Promise<Product & { _count: { rentals: number; saleItems: number } }> {
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
        fee: true,
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
    const [product, buyerWallet] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.wallet.findUnique({ where: { userId } }),
    ]);
    if (!product) throw new ApiError(404, 'Product not found');
    if (!buyerWallet) throw new ApiError(400, 'Buyer wallet missing');

    const balance = buyerWallet.balance.toNumber();
    const price = product.price.toNumber();
    const sellerId = product.userId;
    if (balance < price) {
      throw new ApiError(400, 'Insufficient funds');
    }

    await this.prisma.wallet.upsert({
      where: { userId: sellerId },
      update: {},
      create: { user: { connect: { id: sellerId } }, balance: 0 },
    });

    const [sale] = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          total: price,
          seller: { connect: { id: sellerId } },
          buyer: { connect: { id: userId } },
        },
      });

      await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: price } },
      });

      await tx.wallet.update({
        where: { userId: sellerId },
        data: { balance: { increment: price } },
      });

      await tx.userProduct.create({
        data: {
          user: { connect: { id: userId } },
          product: { connect: { id: productId } },
        },
      });

      await awardPoints(userId, Number(price) * 0.1, tx);

      return [sale];
    });

    await this.prisma.saleItem.create({
      data: {
        sale: { connect: { id: sale.id } },
        product: { connect: { id: productId } },
        quantity: 1,
      },
    });

    return sale;
  }

  async sellToAdmin(userId: number, productId: number): Promise<Sale> {
    const ownership = await this.prisma.userProduct.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!ownership) {
      throw new ApiError(400, 'You do not own this product');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new ApiError(404, 'Product not found');
    const price = product.price;

    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    if (!admin) throw new ApiError(500, 'No admin account configured');
    const adminId = admin.id;

    const [userWallet, adminWallet] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.wallet.findUnique({ where: { userId: adminId } }),
    ]);
    if (!userWallet || !adminWallet) {
      throw new ApiError(500, 'Wallets not initialized');
    }

    if (adminWallet.balance.lt(price)) {
      throw new ApiError(400, 'Platform has insufficient funds');
    }

    const [sale] = await this.prisma.$transaction([
      this.prisma.sale.create({
        data: {
          total: price,
          seller: { connect: { id: userId } },
          buyer: { connect: { id: adminId } },
        },
      }),
      this.prisma.wallet.update({
        where: { userId: adminId },
        data: { balance: { decrement: price } },
      }),
      this.prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: price } },
      }),
      this.prisma.userProduct.delete({
        where: { userId_productId: { userId, productId } },
      }),
    ]);

    await this.prisma.saleItem.create({
      data: {
        sale: { connect: { id: sale.id } },
        product: { connect: { id: productId } },
        quantity: 1,
      },
    });

    return sale;
  }
}
