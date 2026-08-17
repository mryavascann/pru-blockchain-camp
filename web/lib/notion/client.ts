/**
 * ============================================================================
 * Notion istemcisi — hız sınırlı (rate limited)
 *
 * NOTION'UN LİMİTİ: entegrasyon başına ORTALAMA saniyede 3 istek.
 * Aşıldığında 429 `rate_limited` döner.
 *
 * Neden bu bir sorun: bir kampın içeriğini çekmek tek istek değildir.
 * Her toggle bloğunun çocuklarını ayrı bir `blocks.children.list` çağrısıyla
 * almak gerekir ve bunlar sayfalanır. 27 hafta × iç içe bloklar = yüzlerce
 * istek. Kontrolsüz gönderilirse ilk saniyede limite takılır.
 *
 * Çözüm: tüm istekler bu dosyadaki `throttled()` fonksiyonundan geçer ve
 * ardışık istekler arasında en az `MIN_INTERVAL_MS` beklenir. Bu, senkronu
 * biraz yavaşlatır (27 hafta ≈ 1 dakika) ama arka planda çalıştığı için
 * kullanıcı bunu hiç hissetmez.
 *
 * https://developers.notion.com/reference/request-limits
 * ============================================================================
 */
import {Client, APIResponseError} from "@notionhq/client";

import {getServerEnv} from "@/lib/env";

/** İstekler arası minimum bekleme. 3 istek/sn limiti için güvenli pay. */
const MIN_INTERVAL_MS = 350;

/** 429 alındığında kaç kez yeniden denenecek */
const MAX_RETRIES = 4;

let client: Client | null = null;
let lastRequestAt = 0;

/** Notion istemcisi (tekil örnek) */
export function getNotionClient(): Client {
  if (client) return client;

  const {NOTION_TOKEN} = getServerEnv();
  if (!NOTION_TOKEN) {
    throw new Error(
      "NOTION_TOKEN tanımlı değil — Notion senkronu yapılandırılmamış.\n" +
        "Site son başarılı içerik cache'i ile çalışmaya devam eder.",
    );
  }

  client = new Client({auth: NOTION_TOKEN});
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bir Notion çağrısını hız sınırlayarak ve 429 durumunda yeniden deneyerek
 * çalıştırır.
 *
 * Yeniden deneme üstel geri çekilme (exponential backoff) ile yapılır:
 * 1sn, 2sn, 4sn, 8sn. Notion `Retry-After` başlığı gönderirse ona uyulur.
 */
export async function throttled<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Bir önceki istekten bu yana yeterli süre geçmediyse bekle
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    lastRequestAt = Date.now();

    try {
      return await operation();
    } catch (error) {
      const isRateLimit =
        error instanceof APIResponseError && error.status === 429;

      if (!isRateLimit || attempt === MAX_RETRIES) {
        throw error;
      }

      // Notion `Retry-After` başlığı gönderirse ona uyulur; yoksa üstel
      // geri çekilme (1sn, 2sn, 4sn, 8sn) uygulanır.
      //
      // SDK'nın `headers` tipi sürümler arasında değiştiği için savunmacı
      // okuyoruz — başlık okunamazsa geri çekilmeye düşmek zararsız.
      const headers = error.headers as unknown;
      const retryAfterRaw =
        headers instanceof Headers ? headers.get("retry-after") : null;

      const parsedRetry = retryAfterRaw ? Number(retryAfterRaw) : Number.NaN;
      const retryAfterMs = Number.isFinite(parsedRetry)
        ? parsedRetry * 1000
        : 1000 * 2 ** attempt;

      console.warn(
        `[notion] 429 rate_limited — ${retryAfterMs}ms sonra tekrar denenecek ` +
          `(deneme ${attempt + 1}/${MAX_RETRIES})`,
      );
      await sleep(retryAfterMs);
    }
  }

  // Buraya ulaşılmaz; TypeScript'i memnun etmek için.
  throw new Error("throttled: beklenmeyen durum");
}

/**
 * Bir bloğun TÜM çocuklarını çeker (sayfalamayı otomatik takip eder).
 *
 * Notion sayfa başına en fazla 100 blok döner. Uzun hafta içeriklerinde bu
 * sınır aşılır; `has_more` / `next_cursor` takip edilmezse içeriğin sonu
 * sessizce kaybolur — en sinsi hata türlerinden biri.
 */
export async function listAllChildren(blockId: string): Promise<NotionBlock[]> {
  const notion = getNotionClient();
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await throttled(() =>
      notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        start_cursor: cursor,
      }),
    );

    blocks.push(...(response.results as NotionBlock[]));
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}

/* -------------------------------------------------------------------------- */
/*                                  TİPLER                                    */
/* -------------------------------------------------------------------------- */

/**
 * Notion blok tipi.
 *
 * Resmî SDK'nın tipleri 30'dan fazla blok tipini kapsayan çok geniş bir
 * birleşim (union). Her tipi tek tek daraltmak, desteklemediğimiz bloklar
 * için bile kod yazmayı zorunlu kılardı. Bunun yerine gevşek ama AÇIK bir
 * tip kullanıyoruz ve `render.ts` içinde bilinmeyen blokları güvenle atlıyoruz.
 */
export type NotionRichText = {
  plain_text: string;
  href: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
};

export type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
};

/** Bir bloğun tipine karşılık gelen veri gövdesini döner */
export function blockData(block: NotionBlock): Record<string, unknown> {
  return (block[block.type] as Record<string, unknown>) ?? {};
}

/** Bir bloğun rich_text dizisini döner (yoksa boş dizi) */
export function blockRichText(block: NotionBlock): NotionRichText[] {
  const data = blockData(block);
  const rich = data.rich_text;
  return Array.isArray(rich) ? (rich as NotionRichText[]) : [];
}

/** Bir bloğun düz metin içeriğini döner */
export function blockPlainText(block: NotionBlock): string {
  return blockRichText(block)
    .map((t) => t.plain_text ?? "")
    .join("");
}
