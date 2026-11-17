-- AlterTable
ALTER TABLE "BuildJob" ADD COLUMN "creditTransactionId" TEXT;

-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN "creditTransactionId" TEXT;

-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN "refId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_refId_key" ON "CreditTransaction"("refId");
