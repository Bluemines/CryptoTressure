/*
  Warnings:

  - You are about to drop the column `machineId` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `machineId` on the `Reward` table. All the data in the column will be lost.
  - You are about to drop the column `productType` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `machineId` on the `TrialFund` table. All the data in the column will be lost.
  - You are about to drop the `Machine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `NFT` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserNFT` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `productId` to the `Agreement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `Reward` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `TrialFund` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_machineId_fkey";

-- DropForeignKey
ALTER TABLE "Reward" DROP CONSTRAINT "Reward_machineId_fkey";

-- DropForeignKey
ALTER TABLE "TrialFund" DROP CONSTRAINT "TrialFund_machineId_fkey";

-- DropForeignKey
ALTER TABLE "UserNFT" DROP CONSTRAINT "UserNFT_nftId_fkey";

-- DropForeignKey
ALTER TABLE "UserNFT" DROP CONSTRAINT "UserNFT_userId_fkey";

-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "machineId",
ADD COLUMN     "productId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Reward" DROP COLUMN "machineId",
ADD COLUMN     "productId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SaleItem" DROP COLUMN "productType";

-- AlterTable
ALTER TABLE "TrialFund" DROP COLUMN "machineId",
ADD COLUMN     "productId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "Machine";

-- DropTable
DROP TABLE "NFT";

-- DropTable
DROP TABLE "UserNFT";

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "dailyIncome" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL,
    "level" INTEGER NOT NULL,
    "rentalDays" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProduct" (
    "id" SERIAL NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "UserProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProduct_userId_productId_key" ON "UserProduct"("userId", "productId");

-- AddForeignKey
ALTER TABLE "UserProduct" ADD CONSTRAINT "UserProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProduct" ADD CONSTRAINT "UserProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialFund" ADD CONSTRAINT "TrialFund_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
