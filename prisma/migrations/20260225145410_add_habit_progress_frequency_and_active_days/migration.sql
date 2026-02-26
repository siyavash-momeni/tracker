-- CreateEnum
CREATE TYPE "HabitFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN     "activeDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[],
ADD COLUMN     "frequency" "HabitFrequency" NOT NULL DEFAULT 'DAILY',
ADD COLUMN     "targetValue" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "HabitCompletion" ADD COLUMN     "value" INTEGER NOT NULL DEFAULT 1;
