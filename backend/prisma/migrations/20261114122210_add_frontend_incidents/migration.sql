-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('UI_ERROR', 'API_ERROR', 'AUTH_ERROR', 'PERFORMANCE', 'QUEUE_OPERATION', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED');

-- DropForeignKey
ALTER TABLE "HospitalActivity" DROP CONSTRAINT "HospitalActivity_departmentId_fkey";

-- CreateTable
CREATE TABLE "frontend_incidents" (
    "id" UUID NOT NULL,
    "reportedBy" UUID,
    "severity" "IncidentSeverity" NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "affected_route" TEXT,
    "component" TEXT,
    "error_message" TEXT,
    "diagnostics" JSONB,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frontend_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "frontend_incidents_status_created_at_idx" ON "frontend_incidents"("status", "created_at");

-- CreateIndex
CREATE INDEX "frontend_incidents_severity_created_at_idx" ON "frontend_incidents"("severity", "created_at");
