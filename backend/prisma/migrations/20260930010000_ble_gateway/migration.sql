ALTER TABLE "Device" ADD COLUMN "bleSecret" TEXT;
ALTER TABLE "MachineCurrentState" ADD COLUMN "gatewaySampleAt" TIMESTAMP(3);
CREATE TABLE "GatewayReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatewayReceipt_deviceId_eventId_key" UNIQUE ("deviceId", "eventId")
);
