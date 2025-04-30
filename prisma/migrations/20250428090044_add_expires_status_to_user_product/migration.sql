/*
  Warnings:

  - Added the required column `expiresAt` to the `UserProduct` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserProductStatus" AS ENUM ('ACTIVE', 'REFUNDED');

-- AlterTable
ALTER TABLE "UserProduct" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "status" "UserProductStatus" NOT NULL DEFAULT 'ACTIVE';
