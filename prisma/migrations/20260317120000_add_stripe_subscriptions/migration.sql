DO $$
BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM (
    'FREE',
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'INCOMPLETE',
    'INCOMPLETE_EXPIRED',
    'UNPAID'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SubscriptionInterval" AS ENUM (
    'NONE',
    'MONTHLY',
    'YEARLY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "subscriptionInterval" "SubscriptionInterval" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "subscriptionCurrentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
