import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Level } from '../../generated/prisma/client';
import { ApiError } from 'src/common/utils/api-error';
import { CreateLevelDto } from './dto';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { UpdateLevelDto } from './dto/update-level.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { NotificationGateway } from 'src/notifications/notification.gateway';

@Injectable()
export class LevelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  /* ─────────── CRUD for admin panel ─────────── */

  async create(dto: CreateLevelDto): Promise<Level> {
    try {
      return await this.prisma.level.create({ data: dto });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiError(400, `Level ${dto.level} already exists`);
      }
      throw e;
    }
  }

  findAll(): Promise<Level[]> {
    return this.prisma.level.findMany({ orderBy: { level: 'asc' } });
  }

  async findOne(id: number): Promise<Level> {
    const lvl = await this.prisma.level.findUnique({ where: { id } });
    if (!lvl) throw new ApiError(404, 'Level not found');
    return lvl;
  }

  async update(id: number, dto: UpdateLevelDto): Promise<Level> {
    try {
      return await this.prisma.level.update({ where: { id }, data: dto });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new ApiError(404, 'Level not found');
      }
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiError(400, `Level ${dto.level} already exists`);
      }
      throw e;
    }
  }

  async remove(id: number): Promise<Level> {
    try {
      return await this.prisma.level.delete({ where: { id } });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new ApiError(404, 'Level not found');
      }
      throw e;
    }
  }

  /* ─────────── Referral helpers ─────────── */

  async getTeamMembers(userId: number) {
    const result = { C: 0, B: 0, A: 0 };

    const level1 = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      select: { referredId: true },
    });
    result.A = level1.length;

    const level2 = await this.prisma.referral.findMany({
      where: { referrerId: { in: level1.map((r) => r.referredId) } },
      select: { referredId: true },
    });
    result.B = level2.length;

    const level3 = await this.prisma.referral.findMany({
      where: { referrerId: { in: level2.map((r) => r.referredId) } },
      select: { referredId: true },
    });
    result.C = level3.length;

    return result;
  }

  /* ─────────── Main evaluator ─────────── */

  /**
   * Re-calculate user’s level.
   * A level is granted when **either**
   *  • personal deposit ≥ threshold **OR**
   *  • team counts meet thresholds.
   */
  async evaluateUserLevel(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    /* 1️⃣ personal deposit (exclude bonuses & still-locked funds) */
    const { _sum } = await this.prisma.deposit.aggregate({
      where: {
        userId,
        status: 'SUCCESS',
        provider: { not: 'BONUS' },
        // lockedUntil: { lt: new Date() },
      },
      _sum: { amount: true },
    });
    const personalDep = _sum.amount ?? new Decimal(0);

    /* 2️⃣ team counts (A = level-1, B = level-2, C = level-3) */
    const team = await this.getTeamMembers(userId);

    /* 3️⃣ level matrix (top-down) */
    const LEVELS = [
      { level: 6, deposit: 6000, A: 70, B: 35, C: 20 },
      { level: 5, deposit: 4500, A: 50, B: 20, C: 15 },
      { level: 4, deposit: 3000, A: 30, B: 15, C: 7 },
      { level: 3, deposit: 1500, A: 20, B: 10, C: 6 },
      { level: 2, deposit: 500, A: 10, B: 4, C: 4 },
      { level: 1, deposit: 100, A: 4, B: 2, C: 2 },
      { level: 0, deposit: 0, A: 0, B: 0, C: 0 }, // fallback
    ];

    let newLevel = user.level;

    for (const row of LEVELS) {
      /* ─────────────────────────────────────────
         OR logic   ( personal  **OR**  team )
         ───────────────────────────────────────── */
      if (
        personalDep.gte(row.deposit) || // <-- OR
        (team.A >= row.A && team.B >= row.B && team.C >= row.C)
      ) {
        newLevel = row.level;
        break;
      }
    }

    /* 4️⃣ write only if level actually changed */
    if (newLevel !== user.level) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });

      this.notificationGateway.sendNotification(userId, {
        type: 'LEVEL_UP',
        message: `🎉 Congratulations! You’re now Level 0${newLevel}.`,
      });
    }
  }
}
