-- CreateTable
CREATE TABLE "BuildJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "artifactPath" TEXT,
    "artifactName" TEXT,
    "artifactSize" INTEGER,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BuildJob_projectId_createdAt_idx" ON "BuildJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BuildJob_status_createdAt_idx" ON "BuildJob"("status", "createdAt");
