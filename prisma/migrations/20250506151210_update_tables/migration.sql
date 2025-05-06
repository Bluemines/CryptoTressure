/*
  Warnings:

  - Added the required column `levelDepth` to the `Commission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roiPercent` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "levelDepth" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "roiPercent" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "type" "ProductType" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstDepositBonus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstLoginBonus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Withdraw" ADD COLUMN     "processedAt" TIMESTAMP(3);
