/*
  Warnings:

  - You are about to drop the column `trialSpend` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `walletSpend` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "trialSpend",
DROP COLUMN "walletSpend";

-- AlterTable
ALTER TABLE "UserProduct" ADD COLUMN     "trialSpend" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "walletSpend" DECIMAL(65,30) NOT NULL DEFAULT 0;
