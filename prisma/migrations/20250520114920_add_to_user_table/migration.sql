/*
  Warnings:

  - You are about to drop the column `content` on the `Agreement` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Agreement` table. All the data in the column will be lost.
  - Added the required column `agreement` to the `Agreement` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "UserProduct_userId_productId_key";

-- AlterTable
ALTER TABLE "Agreement" DROP COLUMN "content",
DROP COLUMN "title",
ADD COLUMN     "agreement" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trialSpend" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "walletSpend" DECIMAL(65,30) NOT NULL DEFAULT 0;
