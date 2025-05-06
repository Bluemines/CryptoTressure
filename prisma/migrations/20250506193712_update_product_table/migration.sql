/*
  Warnings:

  - Made the column `roiPercent` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "roiPercent" SET NOT NULL,
ALTER COLUMN "roiPercent" SET DEFAULT 0.0;
