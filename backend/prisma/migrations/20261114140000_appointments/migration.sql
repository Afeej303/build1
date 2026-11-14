-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CANCELLED', 'CHECKED_IN');

-- CreateTable
CREATE TABLE "AppointmentSlot" (
    "id" UUID NOT NULL,
    "queueId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED',

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSlot_queueId_startsAt_key" ON "AppointmentSlot"("queueId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- AddForeignKey
ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "HospitalQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AppointmentSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AppointmentSlot" ADD CONSTRAINT "AppointmentSlot_valid_interval" CHECK ("endsAt" > "startsAt");
CREATE UNIQUE INDEX "Appointment_one_active_booking_per_slot"
ON "Appointment" ("slotId") WHERE "status" IN ('BOOKED', 'CHECKED_IN');
ALTER TABLE "AppointmentSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Appointment" ADD COLUMN "queueTokenId" UUID;
CREATE UNIQUE INDEX "Appointment_queueTokenId_key" ON "Appointment"("queueTokenId");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_queueTokenId_fkey" FOREIGN KEY ("queueTokenId") REFERENCES "QueueToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
