/*
  Warnings:

  - You are about to drop the column `endDate` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `rentalDays` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SaleItem` table. All the data in the column will be lost.
  - Added the required column `content` to the `Agreement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Agreement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_productId_fkey";

-- DropForeignKey
ALTER TABLE "Agreement" DROP CONSTRAINT "Agreement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_sellerId_fkey";

-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "endDate",
DROP COLUMN "productId",
DROP COLUMN "startDate",
DROP COLUMN "status",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "rentalDays";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "amount",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "total" DECIMAL(65,30) NOT NULL;

-- AlterTable
ALTER TABLE "SaleItem" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "Rental" (
    "id" SERIAL NOT NULL,
    "rentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
