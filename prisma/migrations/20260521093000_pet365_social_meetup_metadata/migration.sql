-- Store Pet365Care local meetup and walk mate metadata as first-class post fields.
ALTER TABLE "PetPost" ADD COLUMN "meetupType" TEXT;
ALTER TABLE "PetPost" ADD COLUMN "verifiedRegionName" TEXT;
ALTER TABLE "PetPost" ADD COLUMN "verifiedRegionLat" REAL;
ALTER TABLE "PetPost" ADD COLUMN "verifiedRegionLng" REAL;
ALTER TABLE "PetPost" ADD COLUMN "verifiedRegionAt" DATETIME;
ALTER TABLE "PetPost" ADD COLUMN "localTopic" TEXT;
ALTER TABLE "PetPost" ADD COLUMN "localJoinMode" TEXT;
ALTER TABLE "PetPost" ADD COLUMN "localRadiusKm" INTEGER;
ALTER TABLE "PetPost" ADD COLUMN "mateStartPlace" TEXT;
ALTER TABLE "PetPost" ADD COLUMN "mateStartTime" DATETIME;
ALTER TABLE "PetPost" ADD COLUMN "mateRouteSummary" TEXT;
ALTER TABLE "PetPost" ADD COLUMN "mateDurationMinutes" INTEGER;
ALTER TABLE "PetPost" ADD COLUMN "mateCapacity" INTEGER;

CREATE INDEX "PetPost_meetupType_idx" ON "PetPost"("meetupType");
CREATE INDEX "PetPost_verifiedRegionName_idx" ON "PetPost"("verifiedRegionName");
CREATE INDEX "PetPost_mateStartTime_idx" ON "PetPost"("mateStartTime");
