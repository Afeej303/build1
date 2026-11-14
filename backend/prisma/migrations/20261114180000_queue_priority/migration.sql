ALTER TABLE "QueueToken" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "QueueToken" ADD CONSTRAINT "QueueToken_priority_check" CHECK ("priority" IN (0, 1));
ALTER TABLE "HospitalActivity" ADD COLUMN "reason" TEXT;
