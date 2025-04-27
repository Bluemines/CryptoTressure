import { Prisma, PrismaClient } from '../../../generated/prisma/client';

const prisma = new PrismaClient();

export async function awardPoints(
  userId: number,
  delta: number,
  tx: Prisma.TransactionClient = prisma,
) {
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: { points: { increment: delta } },
    select: { id: true, points: true, level: true },
  });

  const nextLevel = await tx.level.findFirst({
    where: { points: { lte: updatedUser.points } },
    orderBy: { level: 'desc' },
  });

  if (!nextLevel) return;

  if (nextLevel.level > updatedUser.level) {
    await tx.user.update({
      where: { id: userId },
      data: { level: nextLevel.level },
    });

    await tx.userLevel.upsert({
      where: {
        userId_levelId: {
          userId: userId,
          levelId: nextLevel.id,
        },
      },
      update: {},
      create: {
        user: { connect: { id: userId } },
        level: { connect: { id: nextLevel.id } },
      },
    });
  }
}
