-- CreateEnum
CREATE TYPE "TrialFundStatus" AS ENUM ('ACTIVE', 'RECOVERED');

-- CreateTable
CREATE TABLE "TrialFund" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 200,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "TrialFundStatus" NOT NULL DEFAULT 'ACTIVE',
    "recoveredAt" TIMESTAMP(3),
    "machineId" INTEGER,

    CONSTRAINT "TrialFund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialFund_userId_key" ON "TrialFund"("userId");

-- AddForeignKey
ALTER TABLE "TrialFund" ADD CONSTRAINT "TrialFund_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialFund" ADD CONSTRAINT "TrialFund_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
