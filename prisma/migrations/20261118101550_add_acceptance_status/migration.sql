-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'cube',
    "status" TEXT NOT NULL DEFAULT 'generating',
    "target" TEXT NOT NULL DEFAULT 'desktop',
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncSeq" INTEGER NOT NULL DEFAULT 0,
    "appKey" TEXT,
    "appKeyPrefix" TEXT,
    "appKeyCreatedAt" DATETIME,
    "lastSyncAt" DATETIME,
    "acceptanceStatus" TEXT,
    "acceptancePassed" INTEGER NOT NULL DEFAULT 0,
    "acceptanceTotal" INTEGER NOT NULL DEFAULT 0,
    "acceptanceFailed" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRunAt" DATETIME,
    "acceptanceError" TEXT,
    "acceptanceReport" TEXT,
    CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("appKey", "appKeyCreatedAt", "appKeyPrefix", "createdAt", "createdById", "icon", "id", "lastActivityAt", "lastSyncAt", "name", "organizationId", "prompt", "status", "syncEnabled", "syncSeq", "target", "updatedAt") SELECT "appKey", "appKeyCreatedAt", "appKeyPrefix", "createdAt", "createdById", "icon", "id", "lastActivityAt", "lastSyncAt", "name", "organizationId", "prompt", "status", "syncEnabled", "syncSeq", "target", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_appKey_key" ON "Project"("appKey");
CREATE INDEX "Project_organizationId_lastActivityAt_idx" ON "Project"("organizationId", "lastActivityAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
