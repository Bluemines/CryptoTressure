-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('FIRST_DEPOSIT', 'REFERRAL', 'TEAM_LEVEL_1', 'TEAM_LEVEL_2', 'TEAM_LEVEL_3');

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "Commission" ALTER COLUMN "referralId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Bonus" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "BonusType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "sourceId" INTEGER,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Bonus_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
