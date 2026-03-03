-- AlterTable
ALTER TABLE "User" ADD COLUMN     "weeklyEmailEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EmailDispatchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDispatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDispatchLog_weekStartDate_idx" ON "EmailDispatchLog"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDispatchLog_userId_weekStartDate_key" ON "EmailDispatchLog"("userId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "EmailDispatchLog" ADD CONSTRAINT "EmailDispatchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;
