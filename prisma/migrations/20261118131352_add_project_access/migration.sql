-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "accessMode" TEXT NOT NULL DEFAULT 'organization',
    CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("acceptanceError", "acceptanceFailed", "acceptancePassed", "acceptanceReport", "acceptanceRunAt", "acceptanceStatus", "acceptanceTotal", "appKey", "appKeyCreatedAt", "appKeyPrefix", "createdAt", "createdById", "icon", "id", "lastActivityAt", "lastSyncAt", "name", "organizationId", "prompt", "status", "syncEnabled", "syncSeq", "target", "updatedAt") SELECT "acceptanceError", "acceptanceFailed", "acceptancePassed", "acceptanceReport", "acceptanceRunAt", "acceptanceStatus", "acceptanceTotal", "appKey", "appKeyCreatedAt", "appKeyPrefix", "createdAt", "createdById", "icon", "id", "lastActivityAt", "lastSyncAt", "name", "organizationId", "prompt", "status", "syncEnabled", "syncSeq", "target", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_appKey_key" ON "Project"("appKey");
CREATE INDEX "Project_organizationId_lastActivityAt_idx" ON "Project"("organizationId", "lastActivityAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
