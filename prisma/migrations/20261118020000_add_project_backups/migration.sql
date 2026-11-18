-- CreateTable
CREATE TABLE "ProjectBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "versionNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectBackup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProjectBackup_projectId_createdAt_idx" ON "ProjectBackup"("projectId", "createdAt");
