/**
 * ============================================================================
 * Notion senkron motoru
 *
 * AKIŞ:
 *
 *   Notion ──(webhook | cron | manuel)──► Sync ──► Postgres ──► Site
 *
 * Site HİÇBİR ZAMAN Notion'a doğrudan gitmez. Her zaman Postgres'ten okur.
 * Bunun sonucu: Notion çökerse, yavaşlarsa veya token süresi dolarsa
 * ZİYARETÇİ HİÇBİR ŞEY FARK ETMEZ — son başarılı içerik yerinde durur.
 *
 * ---------------------------------------------------------------------------
 * DÖRT GÜVENLİK KURALI
 *
 *   1. BAŞARISIZLIK İÇERİĞİ SİLMEZ.
 *      Senkron patlarsa mevcut satırlar OLDUĞU GİBİ KALIR. Yalnızca
 *      `syncStatus`, `lastError` ve `lastAttemptAt` güncellenir.
 *
 *   2. NOTION'DAN KAYBOLAN HAFTA SİLİNMEZ.
 *      Bir hafta Notion'da yanlışlıkla silinirse veya başlığı bozulursa,
 *      veritabanındaki kayıt durur ve admin uyarılır. Otomatik silme,
 *      tek bir yazım hatasının haftalarca emeği yok etmesi demek olurdu.
 *
 *   3. ADMİNİN YAZDIĞI ÜZERİNE YAZILMAZ.
 *      `teaser` ve `status` alanları admin panelinden yönetilir. Senkron
 *      bunları yalnızca BOŞSA doldurur, doluysa dokunmaz.
 *
 *   4. DEĞİŞMEYEN HAFTA YENİDEN YAZILMAZ.
 *      `contentHash` aynıysa veritabanına yazma ve önbellek geçersizleştirme
 *      yapılmaz — gereksiz iş yok.
 * ============================================================================
 */
import {revalidateTag} from "next/cache";

import {db} from "@/lib/db";
import {isNotionConfigured} from "@/lib/env";
import {parseCampPage, type ParsedWeek} from "./parse";
import {renderWeekContent} from "./render";

export type SyncTrigger = "webhook" | "cron" | "manual";

export type CampSyncResult = {
  campId: number;
  campSlug: string;
  updated: number;
  unchanged: number;
  created: number;
  missingInNotion: number[];
  warnings: string[];
  error: string | null;
};

export type SyncResult = {
  success: boolean;
  camps: CampSyncResult[];
  durationMs: number;
  error: string | null;
};

/** Bir haftanın önbellek etiketi — sayfa yeniden üretimi bununla tetiklenir */
export function weekCacheTag(campSlug: string, weekNumber: number): string {
  return `week:${campSlug}:${weekNumber}`;
}

/** Bir kampın önbellek etiketi */
export function campCacheTag(campSlug: string): string {
  return `camp:${campSlug}`;
}

/* -------------------------------------------------------------------------- */
/*                              TEK KAMP SENKRONU                             */
/* -------------------------------------------------------------------------- */

/**
 * Tek bir kampın içeriğini Notion'dan çeker ve veritabanına yazar.
 *
 * Hata fırlatmaz — hatayı sonuç nesnesinde döner. Böylece bir kampın
 * başarısızlığı diğerlerinin senkronunu durdurmaz.
 */
export async function syncCamp(campId: number): Promise<CampSyncResult> {
  const result: CampSyncResult = {
    campId,
    campSlug: String(campId),
    updated: 0,
    unchanged: 0,
    created: 0,
    missingInNotion: [],
    warnings: [],
    error: null,
  };

  const camp = await db.camp.findUnique({where: {id: campId}});

  if (!camp) {
    result.error = `Kamp ${campId} veritabanında yok.`;
    return result;
  }

  result.campSlug = camp.slug;

  if (!camp.notionSourceId) {
    result.error =
      `"${camp.name}" için Notion kaynağı tanımlı değil ` +
      `(Camp.notionSourceId boş). Admin panelinden ayarlanmalı.`;
    return result;
  }

  /* ---- Notion'dan çek ve ayrıştır ---- */
  let parsed: {weeks: ParsedWeek[]; warnings: string[]};

  try {
    parsed = await parseCampPage(camp.notionSourceId);
  } catch (error) {
    // KURAL 1: içeriğe DOKUNMUYORUZ. Sadece hata durumunu işaretliyoruz.
    const message = error instanceof Error ? error.message : String(error);
    result.error = `Notion'dan okunamadı: ${message}`;

    await db.week.updateMany({
      where: {campId},
      data: {
        syncStatus: "FAILED",
        lastError: message.slice(0, 500),
        lastAttemptAt: new Date(),
      },
    });

    return result;
  }

  result.warnings = parsed.warnings;

  /* ---- Her haftayı yaz ---- */
  const seenWeekNumbers = new Set<number>();

  for (const week of parsed.weeks) {
    seenWeekNumbers.add(week.weekNumber);

    try {
      const {html, hash} = renderWeekContent(week.blocks);

      const existing = await db.week.findUnique({
        where: {campId_weekNumber: {campId, weekNumber: week.weekNumber}},
      });

      /* -- KURAL 3: adminin yazdığı teaser'a dokunma -- */
      // Yalnızca `callout` / `quote` kaynaklı öneriler OTOMATİK uygulanır.
      // `paragraph` kaynaklı olanlar gerçek ders içeriğidir; admin onayı
      // olmadan kilitli ekrana çıkmaz.
      const canAutoFillTeaser =
        week.teaserSource === "callout" || week.teaserSource === "quote";

      /*
       * Ayrıştırıcı iyileştiği için, içeriği değişmemiş bir haftanın özeti
       * artık çıkarılabiliyor olabilir. Böyle bir durumda haftayı
       * "değişmedi" sayıp atlarsak özet sonsuza dek boş kalır.
       */
      const teaserNowAvailable =
        existing !== null &&
        existing.teaser.length === 0 &&
        canAutoFillTeaser &&
        week.suggestedTeaser.length > 0;

      /* -- KURAL 4: değişmediyse dokunma -- */
      if (
        existing &&
        existing.contentHash === hash &&
        existing.title === week.title &&
        existing.stage === week.stage &&
        existing.syncStatus === "OK" &&
        !teaserNowAvailable
      ) {
        result.unchanged += 1;
        continue;
      }

      const teaser =
        existing && existing.teaser.length > 0
          ? existing.teaser // admin yazmış → dokunma
          : canAutoFillTeaser
            ? week.suggestedTeaser
            : "";

      await db.week.upsert({
        where: {campId_weekNumber: {campId, weekNumber: week.weekNumber}},
        create: {
          campId,
          weekNumber: week.weekNumber,
          title: week.title,
          stage: week.stage,
          teaser,
          teaserSuggestion: week.suggestedTeaser || null,
          teaserSource: week.teaserSource,
          contentHtml: html,
          rawBlocks: week.blocks as unknown as object,
          notionBlockId: week.blockId,
          contentHash: hash,
          // Yeni haftalar doğrudan YAYINDA başlar — projenin amacı Notion'da
          // yazılanın siteye yansıması. Admin isterse taslağa çekebilir.
          status: "PUBLISHED",
          syncStatus: "OK",
          syncedAt: new Date(),
          lastAttemptAt: new Date(),
          lastError: null,
        },
        update: {
          title: week.title,
          stage: week.stage,
          teaser,
          teaserSuggestion: week.suggestedTeaser || null,
          teaserSource: week.teaserSource,
          contentHtml: html,
          rawBlocks: week.blocks as unknown as object,
          notionBlockId: week.blockId,
          contentHash: hash,
          // `status` KASITLI OLARAK YOK — admin taslağa çektiyse öyle kalsın
          syncStatus: "OK",
          syncedAt: new Date(),
          lastAttemptAt: new Date(),
          lastError: null,
        },
      });

      if (existing) {
        result.updated += 1;
      } else {
        result.created += 1;
      }

      // Bu haftanın sayfası yeniden üretilsin
      safeRevalidate(weekCacheTag(camp.slug, week.weekNumber));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.warnings.push(
        `Hafta ${week.weekNumber} yazılamadı: ${message}`,
      );

      await db.week
        .updateMany({
          where: {campId, weekNumber: week.weekNumber},
          data: {
            syncStatus: "FAILED",
            lastError: message.slice(0, 500),
            lastAttemptAt: new Date(),
          },
        })
        .catch(() => {
          /* veritabanı da erişilemiyorsa yapacak bir şey yok */
        });
    }
  }

  /* ---- KURAL 2: Notion'da olmayan haftaları SİLMİYORUZ ---- */
  const orphans = await db.week.findMany({
    where: {campId, weekNumber: {notIn: [...seenWeekNumbers]}},
    select: {weekNumber: true, title: true},
  });

  if (orphans.length > 0) {
    result.missingInNotion = orphans.map((o) => o.weekNumber);
    result.warnings.push(
      `Şu haftalar Notion'da BULUNAMADI ama veritabanında duruyor: ` +
        `${orphans.map((o) => `${o.weekNumber} ("${o.title}")`).join(", ")}. ` +
        `Silinmediler — Notion'da başlıkları bozulmuş olabilir. ` +
        `Gerçekten kaldırmak istiyorsan admin panelinden sil.`,
    );
  }

  if (result.created > 0 || result.updated > 0) {
    safeRevalidate(campCacheTag(camp.slug));
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*                              TÜM KAMPLAR                                   */
/* -------------------------------------------------------------------------- */

/**
 * Tüm aktif kampları senkronlar ve sonucu `SyncRun` tablosuna yazar.
 *
 * @param trigger Neyin tetiklediği — admin panelinde gösterilir
 * @param onlyCampId Yalnızca bu kampı senkronla (webhook için)
 */
export async function syncAll(
  trigger: SyncTrigger,
  onlyCampId?: number,
): Promise<SyncResult> {
  const startedAt = Date.now();

  const run = await db.syncRun.create({
    data: {
      trigger,
      scope: onlyCampId ? `camp:${onlyCampId}` : "all",
    },
  });

  const output: SyncResult = {
    success: false,
    camps: [],
    durationMs: 0,
    error: null,
  };

  if (!isNotionConfigured()) {
    output.error =
      "NOTION_TOKEN tanımlı değil — senkron atlandı. " +
      "Site son başarılı içerikle çalışmaya devam ediyor.";
    await finishRun(run.id, output, startedAt);
    return output;
  }

  try {
    const camps = await db.camp.findMany({
      where: onlyCampId ? {id: onlyCampId} : {},
      orderBy: {id: "asc"},
      select: {id: true},
    });

    if (camps.length === 0) {
      output.error = onlyCampId
        ? `Kamp ${onlyCampId} bulunamadı.`
        : "Veritabanında hiç kamp yok. Önce `npm run db:seed` çalıştır.";
      await finishRun(run.id, output, startedAt);
      return output;
    }

    for (const camp of camps) {
      output.camps.push(await syncCamp(camp.id));
    }

    // Hiçbir kamp hata vermediyse başarılı sayılır
    output.success = output.camps.every((c) => c.error === null);
  } catch (error) {
    output.error = error instanceof Error ? error.message : String(error);
  }

  await finishRun(run.id, output, startedAt);
  return output;
}

async function finishRun(
  runId: string,
  result: SyncResult,
  startedAt: number,
): Promise<void> {
  result.durationMs = Date.now() - startedAt;

  const updated = result.camps.reduce((sum, c) => sum + c.updated + c.created, 0);
  const unchanged = result.camps.reduce((sum, c) => sum + c.unchanged, 0);
  const failed = result.camps.filter((c) => c.error !== null).length;

  await db.syncRun
    .update({
      where: {id: runId},
      data: {
        updatedCount: updated,
        unchangedCount: unchanged,
        failedCount: failed,
        success: result.success,
        error: result.error?.slice(0, 500) ?? null,
        durationMs: result.durationMs,
        finishedAt: new Date(),
      },
    })
    .catch(() => {
      /* günlük yazılamadıysa senkronu başarısız saymıyoruz */
    });
}

/**
 * `revalidateTag` yalnızca Next.js istek bağlamında çalışır.
 * Script'ten (örn. `npm run notion:sync`) çağrıldığında hata fırlatır —
 * bu beklenen bir durum ve senkronu durdurmamalı.
 */
function safeRevalidate(tag: string): void {
  try {
    // Next.js 16'da ikinci argüman zorunlu hâle geldi. "max", etiketle
    // işaretlenmiş TÜM önbellek girdilerinin geçersiz sayılmasını söyler —
    // içerik değiştiğinde istediğimiz tam olarak bu.
    revalidateTag(tag, "max");
  } catch {
    /* istek bağlamı yok — script'ten çalıştırılıyor, sorun değil */
  }
}

/* -------------------------------------------------------------------------- */
/*                            TEK HAFTA SENKRONU                              */
/* -------------------------------------------------------------------------- */

/**
 * Yalnızca BİR haftanın içeriğini Notion'dan tazeler.
 *
 * NEDEN AYRI BİR YOL:
 * Tam senkron kampın tüm sayfasını gezer ve 27 hafta için ~100 saniye sürer.
 * Ama admin Notion'da tek bir haftayı düzenleyip sonucu hemen görmek istiyor.
 * Bu fonksiyon o haftanın blok kimliğini kullanıp doğrudan onun altına iner —
 * ~110 istek yerine 3-5 istek, birkaç saniye.
 *
 * Tam senkronun dört güvenlik kuralı burada da geçerli: başarısızlıkta içerik
 * silinmez, adminin yazdığı özet ezilmez.
 */
export async function syncWeek(
  campId: number,
  weekNumber: number,
): Promise<{ok: boolean; changed: boolean; error?: string}> {
  const week = await db.week.findUnique({
    where: {campId_weekNumber: {campId, weekNumber}},
    include: {camp: {select: {slug: true, notionSourceId: true}}},
  });

  if (!week) return {ok: false, changed: false, error: "Hafta bulunamadı."};
  if (!week.camp.notionSourceId) {
    return {ok: false, changed: false, error: "Kampın Notion kaynağı tanımlı değil."};
  }

  try {
    /*
     * Tüm kamp sayfası taranır ama YALNIZCA bu haftanın alt ağacı çekilir.
     * Tarama şart: bir haftanın içeriği kardeş bloklarda olabiliyor ve
     * kardeşleri görmek için üst listeye bakmak gerekiyor.
     */
    const parsed = await parseCampPage(week.camp.notionSourceId, {
      onlyWeek: weekNumber,
    });
    const target = parsed.weeks.find((w) => w.weekNumber === weekNumber);

    if (!target) {
      return {
        ok: false,
        changed: false,
        error: `Hafta ${weekNumber} Notion'da bulunamadı. Başlığı "Hafta ${weekNumber}" kalıbına uyuyor mu?`,
      };
    }

    const {html, hash} = renderWeekContent(target.blocks);

    if (hash === week.contentHash) {
      return {ok: true, changed: false};
    }

    await db.week.update({
      where: {campId_weekNumber: {campId, weekNumber}},
      data: {
        contentHtml: html,
        rawBlocks: target.blocks as unknown as object,
        contentHash: hash,
        title: target.title,
        stage: target.stage,
        teaserSuggestion: target.suggestedTeaser || null,
        teaserSource: target.teaserSource,
        syncStatus: "OK",
        syncedAt: new Date(),
        lastAttemptAt: new Date(),
        lastError: null,
        // `teaser`, `title` ve `status` KASITLI OLARAK YOK — bunlar admin
        // panelinden yönetiliyor ve tek hafta tazelemesi onları ezmemeli.
      },
    });

    safeRevalidate(weekCacheTag(week.camp.slug, weekNumber));
    safeRevalidate(campCacheTag(week.camp.slug));

    return {ok: true, changed: true};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db.week
      .update({
        where: {campId_weekNumber: {campId, weekNumber}},
        data: {
          syncStatus: "FAILED",
          lastError: message.slice(0, 500),
          lastAttemptAt: new Date(),
        },
      })
      .catch(() => {});

    return {ok: false, changed: false, error: message};
  }
}
