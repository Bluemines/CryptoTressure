import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Product, Prisma } from '../../generated/prisma/client';
import { ApiError } from 'src/common';
import { join } from 'path';
import { unlink } from 'fs/promises';
import {
  FindProductsParams,
  MachineUpdateInput,
  ProductCreateInput,
} from './interfaces';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── ADMIN────────────────────────────────────────────
  async createProduct(input: ProductCreateInput): Promise<Product> {
    const {
      title,
      description,
      price,
      dailyIncome,
      fee,
      level,
      rentalDays,
      image,
    } = input;
    const exists = await this.prisma.product.findFirst({ where: { title } });
    if (exists) throw new ApiError(400, 'Product already exists');
    return this.prisma.product.create({
      data: {
        title,
        description,
        image,
        price,
        dailyIncome,
        fee,
        level,
        rentalDays,
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

  // ─── CUSTOMER methods (rent/buy) could be added here ──────────────────────
}
