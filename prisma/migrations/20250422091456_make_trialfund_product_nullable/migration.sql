-- DropForeignKey
ALTER TABLE "TrialFund" DROP CONSTRAINT "TrialFund_productId_fkey";

-- AlterTable
ALTER TABLE "TrialFund" ALTER COLUMN "productId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TrialFund" ADD CONSTRAINT "TrialFund_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
