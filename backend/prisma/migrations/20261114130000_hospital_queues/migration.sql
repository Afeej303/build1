-- CreateEnum
CREATE TYPE "QueueTokenStatus" AS ENUM ('WAITING', 'CALLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Hospital" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceptionAssignment" (
    "userId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,

    CONSTRAINT "ReceptionAssignment_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "userId" UUID,
    "patientNumber" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalQueue" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "doctorId" UUID,
    "publicQueueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomLabel" TEXT,
    "acceptingWalkIns" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueToken" (
    "id" UUID NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "patientId" UUID NOT NULL,
    "queueId" UUID NOT NULL,
    "status" "QueueTokenStatus" NOT NULL DEFAULT 'WAITING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Patient_userId_idx" ON "Patient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_hospitalId_patientNumber_key" ON "Patient"("hospitalId", "patientNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalQueue_publicQueueId_key" ON "HospitalQueue"("publicQueueId");

-- CreateIndex
CREATE INDEX "HospitalQueue_departmentId_idx" ON "HospitalQueue"("departmentId");

-- CreateIndex
CREATE INDEX "HospitalQueue_doctorId_idx" ON "HospitalQueue"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueToken_sequence_key" ON "QueueToken"("sequence");

-- CreateIndex
CREATE INDEX "QueueToken_queueId_status_issuedAt_sequence_idx" ON "QueueToken"("queueId", "status", "issuedAt", "sequence");

-- CreateIndex
CREATE INDEX "QueueToken_patientId_idx" ON "QueueToken"("patientId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionAssignment" ADD CONSTRAINT "ReceptionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionAssignment" ADD CONSTRAINT "ReceptionAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalQueue" ADD CONSTRAINT "HospitalQueue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalQueue" ADD CONSTRAINT "HospitalQueue_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueToken" ADD CONSTRAINT "QueueToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueToken" ADD CONSTRAINT "QueueToken_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "HospitalQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "QueueToken_one_active_per_patient_queue"
ON "QueueToken" ("patientId", "queueId")
WHERE "status" IN ('WAITING', 'CALLED');

CREATE UNIQUE INDEX "QueueToken_one_called_per_queue"
ON "QueueToken" ("queueId")
WHERE "status" = 'CALLED';

ALTER TABLE "Hospital" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReceptionAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HospitalQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QueueToken" ENABLE ROW LEVEL SECURITY;
