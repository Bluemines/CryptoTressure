-- AlterTable
ALTER TABLE "Withdraw" ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "msisdn" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
