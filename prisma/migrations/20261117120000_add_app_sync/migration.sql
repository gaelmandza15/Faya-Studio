-- AlterTable
ALTER TABLE "Project" ADD COLUMN "syncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "syncSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "appKey" TEXT;
ALTER TABLE "Project" ADD COLUMN "appKeyPrefix" TEXT;
ALTER TABLE "Project" ADD COLUMN "appKeyCreatedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "lastSyncAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Project_appKey_key" ON "Project"("appKey");

-- CreateTable
CREATE TABLE "SyncRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "data" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "seq" INTEGER NOT NULL,
    "deviceId" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'windows',
    "appVersion" TEXT,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncDevice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Webhook',
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" DATETIME,
    "lastStatus" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEndpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "responseCode" INTEGER,
    "error" TEXT,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncRecord_projectId_tableName_rowKey_key" ON "SyncRecord"("projectId", "tableName", "rowKey");

-- CreateIndex
CREATE INDEX "SyncRecord_projectId_seq_idx" ON "SyncRecord"("projectId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "SyncDevice_projectId_deviceId_key" ON "SyncDevice"("projectId", "deviceId");

-- CreateIndex
CREATE INDEX "SyncDevice_projectId_lastSeenAt_idx" ON "SyncDevice"("projectId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_projectId_createdAt_idx" ON "WebhookEndpoint"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery"("endpointId", "createdAt");
