/**
 * POST /api/webhooks/notion — Notion içerik değişikliği bildirimi
 *
 * Üç katmanlı senkron planının BİRİNCİL katmanı. Notion'da bir şey
 * değiştiğinde saniyeler içinde tetiklenir.
 *
 * ---------------------------------------------------------------------------
 * KURULUM İKİ ADIMLI
 *
 * 1. Notion'da webhook aboneliği oluşturulurken Notion bu adrese bir
 *    doğrulama isteği gönderir. Gövdesinde `verification_token` bulunur.
 *    O token sunucu günlüğüne yazılır; sen kopyalayıp Notion'a girersin
 *    ve `.env.local` içindeki NOTION_WEBHOOK_SECRET'a kaydedersin.
 *
 * 2. Bundan sonra gelen her istek `X-Notion-Signature` başlığıyla imzalanır.
 *    İmzayı doğrulamadan HİÇBİR isteği işlemiyoruz.
 *
 * İMZA DOĞRULAMASI NEDEN ZORUNLU:
 * Bu adres internete açık. İmza kontrolü olmasaydı herkes sahte istek
 * göndererek senkronu sürekli tetikleyebilir, Notion hız limitini
 * doldurabilir ve içeriğin güncellenmesini engelleyebilirdi.
 * ---------------------------------------------------------------------------
 *
 * https://developers.notion.com/reference/webhooks
 */
import {createHmac, timingSafeEqual} from "node:crypto";

import {db} from "@/lib/db";
import {getServerEnv} from "@/lib/env";
import {syncAll} from "@/lib/notion/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * İmzayı sabit zamanda karşılaştırır.
 *
 * Normal `===` karşılaştırması, ilk farklı bayta ulaşınca durur. Saldırgan
 * yanıt süresini ölçerek imzayı bayt bayt tahmin edebilir (timing attack).
 * `timingSafeEqual` her zaman aynı sürede çalışır.
 */
function signatureMatches(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Gövdeyi HAM olarak okumak zorundayız — imza ham baytlar üzerinden
  // hesaplanıyor. `request.json()` çağırıp sonra tekrar dizeye çevirmek
  // boşlukları değiştirebilir ve imzayı bozar.
  const rawBody = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ok: false, error: "Geçersiz JSON"}, {status: 400});
  }

  /* ---- ADIM 1: İlk kurulum doğrulaması ---- */
  if (typeof payload.verification_token === "string") {
    console.log("");
    console.log("═".repeat(70));
    console.log("  NOTION WEBHOOK DOĞRULAMA TOKEN'I");
    console.log("═".repeat(70));
    console.log(`  ${payload.verification_token}`);
    console.log("");
    console.log("  1. Bu değeri Notion'daki webhook kurulum ekranına yapıştır");
    console.log("  2. web/.env.local → NOTION_WEBHOOK_SECRET satırına da yaz");
    console.log("  3. Sunucuyu yeniden başlat");
    console.log("═".repeat(70));
    console.log("");

    return Response.json({ok: true, verified: true});
  }

  /* ---- ADIM 2: İmza doğrulaması ---- */
  const {NOTION_WEBHOOK_SECRET} = getServerEnv();

  if (!NOTION_WEBHOOK_SECRET) {
    // Sır tanımlı değilse uç nokta KAPALIDIR. İmzasız istek kabul etmiyoruz.
    console.warn("[notion-webhook] NOTION_WEBHOOK_SECRET tanımlı değil — istek reddedildi");
    return Response.json(
      {ok: false, error: "Webhook yapılandırılmamış."},
      {status: 503},
    );
  }

  const received = request.headers.get("x-notion-signature") ?? "";
  const expected =
    "sha256=" +
    createHmac("sha256", NOTION_WEBHOOK_SECRET).update(rawBody).digest("hex");

  if (!signatureMatches(expected, received)) {
    console.warn("[notion-webhook] imza eşleşmedi — istek reddedildi");
    return Response.json({ok: false, error: "İmza geçersiz."}, {status: 401});
  }

  /* ---- ADIM 3: Hangi kampı senkronlayacağız? ---- */
  //
  // Notion olay gövdesinde değişen sayfanın/bloğun kimliği gelir. Bu kimlik
  // bizim bildiğimiz bir hafta bloğuna ya da kamp sayfasına aitse, YALNIZCA
  // o kampı senkronluyoruz — 27 haftanın tamamını taramak gereksiz.
  const entityId = extractEntityId(payload);
  let campId: number | undefined;

  if (entityId) {
    const week = await db.week
      .findFirst({
        where: {notionBlockId: entityId},
        select: {campId: true},
      })
      .catch(() => null);

    if (week) {
      campId = week.campId;
    } else {
      const camp = await db.camp
        .findFirst({
          where: {notionSourceId: entityId},
          select: {id: true},
        })
        .catch(() => null);
      campId = camp?.id;
    }
  }

  const result = await syncAll("webhook", campId);

  return Response.json({
    ok: result.success,
    scope: campId ? `camp:${campId}` : "all",
    updated: result.camps.reduce((n, c) => n + c.updated + c.created, 0),
  });
}

/** Notion olay gövdesinden değişen varlığın kimliğini çıkarır */
function extractEntityId(payload: Record<string, unknown>): string | null {
  const entity = payload.entity as {id?: string} | undefined;
  if (entity?.id) return entity.id;

  const data = payload.data as {parent?: {id?: string}} | undefined;
  if (data?.parent?.id) return data.parent.id;

  return null;
}
