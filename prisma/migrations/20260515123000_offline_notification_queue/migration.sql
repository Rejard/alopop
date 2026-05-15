-- Add retention and delivery metadata for privacy-safe offline notification signals.
ALTER TABLE "OfflineMessage" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'NOTICE';
ALTER TABLE "OfflineMessage" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "OfflineMessage" ADD COLUMN "expiresAt" DATETIME NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE "OfflineMessage" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "OfflineMessage" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "OfflineMessage"
SET "expiresAt" = CASE
  WHEN typeof("createdAt") = 'integer' THEN datetime("createdAt" / 1000, 'unixepoch', '+7 days')
  ELSE datetime("createdAt", '+7 days')
END
WHERE "expiresAt" = '1970-01-01T00:00:00.000Z';
CREATE INDEX "OfflineMessage_expiresAt_idx" ON "OfflineMessage"("expiresAt");
