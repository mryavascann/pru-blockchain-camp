/**
 * /api/admin/sync — Notion senkronu (manuel)
 *
 *   GET  → Son senkronların durumu + hafta bazında sağlık raporu
 *   POST → "Şimdi Senkronize Et"
 *
 * Bu, üç katmanlı senkron planının üçüncü katmanı:
 *   1. Webhook  → saniyeler içinde (birincil)
 *   2. Cron     → 6 saatte bir (emniyet ağı)
 *   3. Manuel   → burası (senin kontrolün)
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireAdmin} from "@/lib/auth/guards";
import {syncAll} from "@/lib/notion/sync";
import {isNotionConfigured} from "@/lib/env";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

/** Senkron uzun sürebilir (27 hafta ≈ 75 sn). Vercel'de üst sınırı yükselt. */
export const maxDuration = 300;

/* -------------------------------------------------------------------------- */
/*                                  DURUM                                     */
/* -------------------------------------------------------------------------- */

export async function GET() {
  return handle(async () => {
    await requireAdmin();

    const runs = await db.syncRun.findMany({
      orderBy: {startedAt: "desc"},
      take: 10,
    });

    /*
     * Hafta bazında sağlık raporu.
     *
     * Bu tablo Faz 0'daki sözün karşılığı: "Notion çökerse veya API hata
     * verirse site son başarılı içeriği göstermeye devam eder, ama SEN
     * bunu bilirsin."
     */
    const problems = await db.week.findMany({
      where: {OR: [{syncStatus: "FAILED"}, {syncStatus: "PENDING"}]},
      select: {
        weekNumber: true,
        title: true,
        syncStatus: true,
        lastError: true,
        lastAttemptAt: true,
        syncedAt: true,
        camp: {select: {slug: true, name: true}},
      },
      orderBy: [{campId: "asc"}, {weekNumber: "asc"}],
    });

    /** Özeti olmayan haftalar — kilitli ekranda gösterilecek metin yok */
    const missingTeasers = await db.week.findMany({
      where: {teaser: "", status: "PUBLISHED"},
      select: {
        weekNumber: true,
        title: true,
        teaserSuggestion: true,
        teaserSource: true,
        camp: {select: {slug: true, name: true}},
      },
      orderBy: [{campId: "asc"}, {weekNumber: "asc"}],
    });

    const totals = await db.week.groupBy({by: ["syncStatus"], _count: true});

    return ok({
      notionConfigured: isNotionConfigured(),
      runs,
      problems,
      missingTeasers,
      totals: Object.fromEntries(totals.map((t) => [t.syncStatus, t._count])),
    });
  });
}

/* -------------------------------------------------------------------------- */
/*                                 TETİKLEME                                  */
/* -------------------------------------------------------------------------- */

const syncSchema = z.object({
  /** Yalnızca bu kampı senkronla; verilmezse hepsi */
  campId: z.number().int().min(1).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();

    if (!isNotionConfigured()) {
      return fail(
        "NOTION_TOKEN tanımlı değil. Senkron yapılamaz — site son " +
          "başarılı içerikle çalışmaya devam ediyor.",
        400,
        "NOTION_NOT_CONFIGURED",
      );
    }

    const parsed = syncSchema.safeParse((await readJson<unknown>(request)) ?? {});
    const campId = parsed.success ? parsed.data.campId : undefined;

    const result = await syncAll("manual", campId);

    return ok(result, {status: result.success ? 200 : 207});
    // 207 Multi-Status: bazı kamplar başarılı, bazıları değil
  });
}
