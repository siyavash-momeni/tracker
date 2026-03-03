-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyEmailEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DailyEmailDispatchLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dispatchDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyEmailDispatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyEmailDispatchLog_dispatchDate_idx" ON "DailyEmailDispatchLog"("dispatchDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEmailDispatchLog_userId_dispatchDate_key" ON "DailyEmailDispatchLog"("userId", "dispatchDate");

-- AddForeignKey
ALTER TABLE "DailyEmailDispatchLog" ADD CONSTRAINT "DailyEmailDispatchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("clerkId") ON DELETE CASCADE ON UPDATE CASCADE;
