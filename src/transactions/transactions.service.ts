import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AdminTransactionListDto } from './dto/admin-transaction-list.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async UserTransactions(userId: number) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async listAllTransactions(dto: AdminTransactionListDto) {
    const skip = (dto.page - 1) * dto.limit;
    const where = {}; 

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: dto.limit,
        orderBy: { date: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const items = rows.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      transactiontype: tx.transactiontype,
      status: tx.status,
      date: tx.date,
      user: { id: tx.user.id, email: tx.user.email },
    }));

    return { items, total };
  }
}
