/**
 * PATCH /api/admin/weeks — Hafta ve kamp ayarları
 *
 * Notion'da OLMAYAN, bu sistemde yönetilen üç şeyi düzenler:
 *
 *   1. teaser           → kilitli ekranda gösterilecek vitrin metni
 *   2. status           → TASLAK / YAYINDA
 *   3. publicWeekNumber → hangi hafta herkese açık (kamp seviyesinde)
 *
 * ---------------------------------------------------------------------------
 * TEASER NEDEN BURADA, NOTION'DA DEĞİL
 *
 * Kilitli ekrana giden metin, kilitli içerikten TÜRETİLMEMELİDİR. Notion'da
 * bilerek yazılmış bir `callout`/`quote` varsa senkron onu otomatik alır.
 * Yoksa alan boş kalır ve buradan doldurulur — ders içeriğinin ilk paragrafı
 * asla otomatik kopyalanmaz.
 *
 * `teaserSuggestion` alanı, Notion'dan çıkarılan öneriyi tutar ve admin
 * panelinde "şunu kullan" düğmesiyle sunulur. Onaylanana kadar kilitli
 * ekrana çıkmaz.
 * ---------------------------------------------------------------------------
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireAdmin} from "@/lib/auth/guards";
import {campCacheTag, weekCacheTag} from "@/lib/notion/sync";
import {fail, handle, ok, readJson} from "@/lib/api";
import {revalidateTag} from "next/cache";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  campSlug: z.string().min(1),
  /** Hafta ayarı yapılacaksa */
  weekNumber: z.number().int().min(1).optional(),
  teaser: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  /** Kamp seviyesi: hangi hafta herkese açık. `null` → hiçbiri */
  publicWeekNumber: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const parsed = patchSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("Ayar bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const {campSlug, weekNumber, teaser, status, publicWeekNumber} = parsed.data;

    const camp = await db.camp.findUnique({
      where: {slug: campSlug},
      select: {id: true, slug: true, weekCount: true},
    });
    if (!camp) return fail("Kamp bulunamadı.", 404, "CAMP_NOT_FOUND");

    /* ---- Kamp seviyesi: herkese açık hafta ---- */
    if (publicWeekNumber !== undefined) {
      if (publicWeekNumber !== null) {
        if (publicWeekNumber > camp.weekCount) {
          return fail(
            `Bu kamp ${camp.weekCount} haftalık. ${publicWeekNumber}. hafta seçilemez.`,
            400,
            "WEEK_OUT_OF_RANGE",
          );
        }

        const target = await db.week.findUnique({
          where: {campId_weekNumber: {campId: camp.id, weekNumber: publicWeekNumber}},
          select: {status: true, teaser: true},
        });

        if (!target) {
          return fail(
            `${publicWeekNumber}. hafta henüz senkronlanmamış.`,
            400,
            "WEEK_NOT_SYNCED",
          );
        }
        if (target.status !== "PUBLISHED") {
          return fail(
            `${publicWeekNumber}. hafta taslak durumda. ` +
              `Herkese açık yapmadan önce yayına almalısın.`,
            400,
            "WEEK_IS_DRAFT",
          );
        }
      }

      await db.camp.update({
        where: {id: camp.id},
        data: {publicWeekNumber},
      });

      safeRevalidate(campCacheTag(camp.slug));

      return ok({
        campSlug: camp.slug,
        publicWeekNumber,
        message:
          publicWeekNumber === null
            ? "Herkese açık örnek hafta kaldırıldı."
            : `${publicWeekNumber}. hafta artık herkese açık ve arama motorlarına indekslenebilir.`,
      });
    }

    /* ---- Hafta seviyesi ---- */
    if (weekNumber === undefined) {
      return fail(
        "Hafta numarası veya publicWeekNumber belirtilmeli.",
        400,
        "NOTHING_TO_UPDATE",
      );
    }

    const existing = await db.week.findUnique({
      where: {campId_weekNumber: {campId: camp.id, weekNumber}},
      select: {id: true},
    });
    if (!existing) return fail("Hafta bulunamadı.", 404, "WEEK_NOT_FOUND");

    const week = await db.week.update({
      where: {campId_weekNumber: {campId: camp.id, weekNumber}},
      data: {
        ...(teaser !== undefined ? {teaser} : {}),
        ...(status !== undefined ? {status} : {}),
      },
      select: {
        weekNumber: true,
        title: true,
        teaser: true,
        status: true,
        teaserSuggestion: true,
        teaserSource: true,
      },
    });

    safeRevalidate(weekCacheTag(camp.slug, weekNumber));
    safeRevalidate(campCacheTag(camp.slug));

    return ok({week});
  });
}

function safeRevalidate(tag: string): void {
  try {
    revalidateTag(tag, "max");
  } catch {
    /* istek bağlamı dışında çağrıldıysa sorun değil */
  }
}
