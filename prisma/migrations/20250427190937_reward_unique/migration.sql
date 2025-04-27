/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId,date]` on the table `Reward` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reward" ALTER COLUMN "date" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Reward_userId_productId_date_key" ON "Reward"("userId", "productId", "date");
