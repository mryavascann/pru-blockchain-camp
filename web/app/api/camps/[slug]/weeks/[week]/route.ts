/**
 * GET /api/camps/[slug]/weeks/[week]
 *
 * Bir haftanın içeriği — ERİŞİM KONTROLÜNE TABİ.
 *
 * Üç olası yanıt:
 *
 *   level: "public-sample"  → herkese açık örnek hafta, tam içerik
 *   level: "full"           → oturum + nick doğrulandı, tam içerik
 *   level: "locked"         → yalnızca başlık ve özet; `contentHtml` YOK
 *
 * ⚠️ Kilitli yanıtta gerçek içerik veritabanından HİÇ OKUNMAZ.
 *    Bu, `lib/content/access.ts` içindeki `select` ayrımıyla sağlanır —
 *    bir unutkanlığa bağlı değil, sorgunun kendisinde gömülü.
 */
import {getWeekForViewer} from "@/lib/content/access";
import {fail, handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {params}: {params: Promise<{slug: string; week: string}>},
) {
  return handle(async () => {
    const {slug, week: weekParam} = await params;

    const weekNumber = Number(weekParam);
    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      return fail("Geçersiz hafta numarası.", 400, "BAD_WEEK");
    }

    const access = await getWeekForViewer(slug, weekNumber);

    if (!access) {
      return fail(
        "Bu hafta bulunamadı veya henüz yayınlanmadı.",
        404,
        "WEEK_NOT_FOUND",
      );
    }

    if (access.level === "locked") {
      return ok({
        level: access.level,
        reason: access.reason,
        week: access.week,
      });
    }

    return ok({
      level: access.level,
      week: access.week,
    });
  });
}
