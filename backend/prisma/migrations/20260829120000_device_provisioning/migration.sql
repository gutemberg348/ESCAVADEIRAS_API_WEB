ALTER TABLE "Device"
ADD COLUMN "mqttUsername" TEXT,
ADD COLUMN "credentialHash" TEXT,
ADD COLUMN "hardwareConfig" JSONB,
ADD COLUMN "provisionedAt" TIMESTAMP(3),
ADD COLUMN "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Device_mqttUsername_key" ON "Device"("mqttUsername");
