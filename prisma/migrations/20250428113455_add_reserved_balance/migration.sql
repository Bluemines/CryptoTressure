/*
  Warnings:

  - You are about to drop the column `pendingAmount` on the `Wallet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "pendingAmount",
ADD COLUMN     "reserved" DECIMAL(65,30) NOT NULL DEFAULT 0;
