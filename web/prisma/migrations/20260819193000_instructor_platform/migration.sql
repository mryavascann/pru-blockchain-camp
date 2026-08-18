-- Eğitmen kamp platformu: bütün değişiklikler mevcut uygulamayla geriye
-- uyumlu ve eklemelidir. Mevcut kamp kimlikleri zincir kimliği olarak korunur.

CREATE TYPE "CampLifecycle" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CampMemberRole" AS ENUM ('OWNER', 'EDITOR', 'REVIEWER');
CREATE TYPE "WeekContentSource" AS ENUM ('NOTION', 'EDITOR');
CREATE TYPE "MediaKind" AS ENUM ('CAMP_COVER', 'WEEK_ART');

CREATE SEQUENCE "Camp_id_seq";
SELECT setval('"Camp_id_seq"', COALESCE((SELECT MAX("id") FROM "Camp"), 1), true);
ALTER SEQUENCE "Camp_id_seq" OWNED BY "Camp"."id";
ALTER TABLE "Camp" ALTER COLUMN "id" SET DEFAULT nextval('"Camp_id_seq"');

ALTER TABLE "Camp"
  ADD COLUMN "chainCampId" INTEGER,
  ADD COLUMN "lifecycle" "CampLifecycle" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "ownerAddress" TEXT,
  ADD COLUMN "instructorName" TEXT,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "coverAssetId" TEXT;

-- Eski iki kampın DB id'si zaten kontrattaki campId'dir.
UPDATE "Camp" SET "chainCampId" = "id" WHERE "chainCampId" IS NULL;

ALTER TABLE "Week"
  ADD COLUMN "editorBody" TEXT,
  ADD COLUMN "resources" JSONB,
  ADD COLUMN "contentSource" "WeekContentSource" NOT NULL DEFAULT 'NOTION',
  ADD COLUMN "imageAssetId" TEXT;

CREATE TABLE "CampMember" (
  "id" TEXT NOT NULL,
  "campId" INTEGER NOT NULL,
  "address" TEXT NOT NULL,
  "role" "CampMemberRole" NOT NULL DEFAULT 'EDITOR',
  "addedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "campId" INTEGER NOT NULL,
  "ownerAddress" TEXT NOT NULL,
  "kind" "MediaKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Camp_chainCampId_key" ON "Camp"("chainCampId");
CREATE UNIQUE INDEX "Camp_coverAssetId_key" ON "Camp"("coverAssetId");
CREATE INDEX "Camp_lifecycle_displayOrder_idx" ON "Camp"("lifecycle", "displayOrder");
CREATE INDEX "Camp_ownerAddress_idx" ON "Camp"("ownerAddress");

CREATE UNIQUE INDEX "Week_imageAssetId_key" ON "Week"("imageAssetId");

CREATE UNIQUE INDEX "CampMember_campId_address_key" ON "CampMember"("campId", "address");
CREATE INDEX "CampMember_address_idx" ON "CampMember"("address");

CREATE INDEX "MediaAsset_campId_kind_createdAt_idx" ON "MediaAsset"("campId", "kind", "createdAt");
CREATE INDEX "MediaAsset_sha256_idx" ON "MediaAsset"("sha256");

ALTER TABLE "CampMember"
  ADD CONSTRAINT "CampMember_campId_fkey"
  FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_campId_fkey"
  FOREIGN KEY ("campId") REFERENCES "Camp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Camp"
  ADD CONSTRAINT "Camp_coverAssetId_fkey"
  FOREIGN KEY ("coverAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Week"
  ADD CONSTRAINT "Week_imageAssetId_fkey"
  FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
