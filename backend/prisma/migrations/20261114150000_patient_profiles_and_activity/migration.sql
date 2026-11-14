ALTER TABLE "Patient" ADD COLUMN "phone" TEXT, ADD COLUMN "gender" TEXT, ADD COLUMN "dateOfBirth" DATE;
CREATE TABLE "HospitalActivity" (
  "id" UUID PRIMARY KEY,
  "departmentId" UUID NOT NULL REFERENCES "Department"("id"),
  "actorId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "appointmentId" UUID,
  "tokenId" UUID,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HospitalActivity_departmentId_createdAt_id_idx" ON "HospitalActivity" ("departmentId", "createdAt", "id");
ALTER TABLE "HospitalActivity" ENABLE ROW LEVEL SECURITY;
