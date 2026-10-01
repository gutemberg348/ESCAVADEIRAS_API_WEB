ALTER TABLE "Device" ALTER COLUMN "machineId" DROP NOT NULL;
ALTER TABLE "Device" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Device_archivedAt_idx" ON "Device"("archivedAt");
