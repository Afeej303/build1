CREATE TABLE "DoctorBreak" (
  "id" UUID NOT NULL PRIMARY KEY,
  "doctorId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "DoctorBreak_doctorId_startsAt_idx" ON "DoctorBreak" ("doctorId", "startsAt");
ALTER TABLE "DoctorBreak" ENABLE ROW LEVEL SECURITY;
