import { Prisma, PrismaClient } from '../../../generated/prisma/client';

const prisma = new PrismaClient();

export async function awardPoints(
  userId: number,
  delta: number,
  tx: Prisma.TransactionClient = prisma,
) {
  const inc = Math.floor(Number(delta) || 0);
  if (inc === 0) return;

  // Increment points
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: { points: { increment: inc } },
    select: { id: true, points: true, level: true },
  });

  // Determine next eligible level
  const nextLevel = await tx.level.findFirst({
    where: { points: { lte: updatedUser.points } },
    orderBy: { level: 'desc' },
  });
  if (!nextLevel) return;
  if (nextLevel.level <= updatedUser.level) return;

  // Upgrade
  await tx.user.update({
    where: { id: userId },
    data: { level: nextLevel.level },
  });

  await tx.userLevel.upsert({
    where: {
      userId_levelId: { userId, levelId: nextLevel.id },
    },
    update: {},
    create: {
      userId,
      levelId: nextLevel.id,
    },
  });
}
