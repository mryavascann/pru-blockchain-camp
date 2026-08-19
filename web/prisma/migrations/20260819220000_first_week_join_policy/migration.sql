-- Kamp eğitmeni isterse 1. hafta katılımını da incelemeye alabilir.
-- Varsayılan kapalıdır: mevcut iki örnek kamp ve yeni kamplar 1. haftayı
-- doğrudan açar; ileri hafta talepleri uygulama katmanında daima bekletilir.
ALTER TABLE "Camp"
ADD COLUMN "firstWeekRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- Eski bekleyen 1. hafta başvuruları yeni varsayılan davranışla uyumlu olsun.
-- Önce erişim kaydını oluşturup sonra başvuruyu onaylıyoruz.
INSERT INTO "WeeklyCompletion" (
  "id",
  "address",
  "campId",
  "weekNumber",
  "source",
  "createdBy",
  "createdAt"
)
SELECT
  'join_' || md5(lower(application."address") || ':' || application."campId"::text || ':1'),
  lower(application."address"),
  application."campId",
  1,
  'join',
  NULL,
  CURRENT_TIMESTAMP
FROM "Application" AS application
INNER JOIN "Camp" AS camp ON camp."id" = application."campId"
WHERE application."status" = 'PENDING'
  AND application."declaredWeek" = 1
  AND camp."firstWeekRequiresApproval" = false
ON CONFLICT ("address", "campId", "weekNumber") DO NOTHING;

UPDATE "Application" AS application
SET
  "status" = 'APPROVED',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Camp" AS camp
WHERE camp."id" = application."campId"
  AND application."status" = 'PENDING'
  AND application."declaredWeek" = 1
  AND camp."firstWeekRequiresApproval" = false;
