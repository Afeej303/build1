CREATE TABLE "HospitalAdminAssignment" (
  "hospitalId" UUID NOT NULL REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("hospitalId", "userId")
);
CREATE INDEX "HospitalAdminAssignment_userId_idx" ON "HospitalAdminAssignment" ("userId");
ALTER TABLE "HospitalAdminAssignment" ENABLE ROW LEVEL SECURITY;
