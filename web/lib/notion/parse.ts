/**
 * ============================================================================
 * Notion sayfa ayrıştırıcısı
 *
 * Bir kamp sayfasını gezip haftaları çıkarır.
 *
 * GERÇEK NOTION YAPISI (keşfedildi, varsayılmadı):
 *
 *   PRU Blockchain Developers               ← kamp sayfası
 *   ├── quote          "💡 Vizyon: ..."
 *   ├── toggle         "🔵 1. AŞAMA: Temeller ve Güçlü JavaScript (7 Hafta)"
 *   │   ├── toggle     "📅 Hafta 1: Blockchain Nedir? ..."     ← HAFTA
 *   │   │   ├── callout        "Bu hafta ..."                  ← özet adayı
 *   │   │   ├── bulleted_list  "..."
 *   │   │   └── to_do          "📺 [Video]: ..."
 *   │   └── toggle     "📅 Hafta 2: ..."                       ← HAFTA
 *   └── toggle         "🟡 2. AŞAMA: ..."
 *
 * Haftalar ayrı sayfa veya database satırı DEĞİL — aşama toggle'ları içine
 * yuvalanmış toggle blokları. Bu yüzden ayrıştırma, blok ağacında "Hafta N"
 * kalıbını arayarak yapılır.
 *
 * TASARIM İLKESİ: SESSİZ BAŞARISIZLIK YOK.
 * Tanınamayan bir blok, eksik hafta veya tekrar eden hafta numarası sessizce
 * atlanmaz — `warnings` dizisine yazılır ve admin panelinde gösterilir.
 * İçeriğin yarısının sessizce kaybolması, hiç senkron olmamasından kötüdür.
 * ============================================================================
 */
import {
  listAllChildren,
  blockPlainText,
  type NotionBlock,
} from "./client";

/** Çocukları da yüklenmiş blok */
export type BlockWithChildren = NotionBlock & {
  children?: BlockWithChildren[];
};

export type ParsedWeek = {
  /** Notion'daki blok kimliği (değişiklik takibi için) */
  blockId: string;
  /** 1'den başlayan hafta numarası */
  weekNumber: number;
  /** "Hafta N:" kısmı temizlenmiş başlık */
  title: string;
  /** Bulunduğu aşama/ay başlığı (varsa) */
  stage: string | null;
  /** Haftanın tüm içerik blokları (çocuklarıyla birlikte) */
  blocks: BlockWithChildren[];
  /** Özet adayı — aşağıdaki `teaserSource` ile birlikte değerlendirilir */
  suggestedTeaser: string;

  /**
   * Özetin nereden geldiği. GÜVENLİK AÇISINDAN KRİTİK AYRIM:
   *
   *   "callout" | "quote"  → Notion'da BİLEREK yazılmış özet blokları.
   *                          Otomatik olarak kilitli ekranda kullanılabilir.
   *
   *   "paragraph"          → Haftanın ilk paragrafı. Bu GERÇEK DERS İÇERİĞİDİR,
   *                          özet değil. Otomatik kullanılmaz; admin panelinde
   *                          yalnızca ÖNERİ olarak gösterilir ve adminin
   *                          onayı beklenir.
   *
   * Fark önemli: "içeriğin ilk paragrafını kes ve göster" yaklaşımı, kilitli
   * içeriğin bir parçasını sızdırmak demektir. Bilerek yazılmış bir özet
   * bloğunu göstermek ise sızıntı değil, yazarın niyetidir.
   */
  teaserSource: "callout" | "quote" | "paragraph" | null;
};

export type ParseResult = {
  weeks: ParsedWeek[];
  warnings: string[];
};

/** "Hafta 12", "Hafta12", "Hafta  3" — hepsini yakalar */
const WEEK_PATTERN = /hafta\s*(\d{1,3})\b/i;

/** "1. AŞAMA: ...", "2. AY: ..." */
const STAGE_PATTERN = /\d+\.\s*(aşama|ay)\b/i;

/** Bir hafta bloğunun içinde ne kadar derine inileceği */
const MAX_CONTENT_DEPTH = 3;

/** Kamp sayfasında hafta ararken ne kadar derine inileceği */
const MAX_SEARCH_DEPTH = 3;

/**
 * Başlık metninden hafta numarasını ve temiz başlığı çıkarır.
 *
 * "📅 Hafta 1: Blockchain Nedir? (Teori)"  →  {1, "Blockchain Nedir? (Teori)"}
 * "📅Hafta 6: Sınıflar, Ağlar"              →  {6, "Sınıflar, Ağlar"}
 * "📅  Hafta 12: Yeni Kontrat Mimarileri"   →  {12, "Yeni Kontrat Mimarileri"}
 *
 * @returns null — metin bir hafta başlığı değilse
 */
export function parseWeekHeading(
  text: string,
): {weekNumber: number; title: string} | null {
  const match = WEEK_PATTERN.exec(text);
  if (!match) return null;

  const weekNumber = Number(match[1]);
  if (!Number.isInteger(weekNumber) || weekNumber < 1) return null;

  // "Hafta N" ifadesinden SONRAKİ kısmı başlık olarak al
  const afterMatch = text.slice(match.index + match[0].length);

  const title = afterMatch
    .replace(/^[\s:：\-–—.]+/, "") // baştaki iki nokta / tire / boşluk
    .trim();

  return {
    weekNumber,
    // Başlık boşsa metnin tamamını kullan (en azından bir şey göster)
    title: title.length > 0 ? title : text.trim(),
  };
}

/** Bir metin aşama/ay başlığı mı? */
function isStageHeading(text: string): boolean {
  return STAGE_PATTERN.test(text);
}

/**
 * Bir bloğun tüm alt ağacını (çocuklarıyla birlikte) çeker.
 *
 * Not: Notion'da her seviyenin çocukları AYRI bir API çağrısı gerektirir.
 * Derinlik sınırı, kötü yapılandırılmış bir sayfanın yüzlerce gereksiz
 * isteğe yol açmasını engeller.
 */
async function fetchSubtree(
  blockId: string,
  depth = 0,
): Promise<BlockWithChildren[]> {
  const blocks = (await listAllChildren(blockId)) as BlockWithChildren[];

  if (depth >= MAX_CONTENT_DEPTH) return blocks;

  for (const block of blocks) {
    // `child_page` içine inmiyoruz — o ayrı bir sayfa, bu haftanın içeriği değil
    if (block.has_children && block.type !== "child_page") {
      block.children = await fetchSubtree(block.id, depth + 1);
    }
  }

  return blocks;
}

/** Kilitli ekranda 2-3 satır yeterli */
const TEASER_MAX_LENGTH = 280;

/** Bir özet adayının anlamlı sayılması için gereken en az karakter */
const TEASER_MIN_LENGTH = 20;

/**
 * Bir bloğun ve TÜM ALT BLOKLARININ metnini toplar.
 *
 * NEDEN ÇOCUKLARA DA BAKIYORUZ:
 * Notion'da callout'un metni iki farklı yerde olabiliyor ve bu tamamen
 * yazarın nasıl yapıştırdığına bağlı:
 *
 *   Directors:  [callout] "Kripto paraların sadece transfer edilmediği…"
 *                         ↑ metin bloğun kendisinde
 *
 *   Developers: [callout] ""                    ← kendi metni BOŞ
 *                 └─ [quote] "Bu hafta kaputun altında…"
 *                            ↑ metin bir alt blokta
 *
 * Yalnızca bloğun kendi metnine bakmak, ikinci biçimdeki tüm özetleri
 * görmezden gelmek demekti — Developers kampının 14 haftası bu yüzden
 * özetsiz kalmıştı.
 */
function collectText(block: BlockWithChildren): string {
  const parts: string[] = [];

  const own = blockPlainText(block).trim();
  if (own) parts.push(own);

  for (const child of block.children ?? []) {
    const childText = collectText(child);
    if (childText) parts.push(childText);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Hafta içeriğinden özet adayı ve KAYNAĞINI çıkarır */
function extractSuggestedTeaser(blocks: BlockWithChildren[]): {
  text: string;
  source: ParsedWeek["teaserSource"];
} {
  // Öncelik sırası: bilerek yazılmış özet blokları önce, ders içeriği en son
  const priority: ParsedWeek["teaserSource"][] = ["callout", "quote", "paragraph"];

  for (const type of priority) {
    for (const block of blocks) {
      if (block.type !== type) continue;

      /*
       * `callout` ve `quote` bilerek yazılmış özet kaplarıdır; içlerindeki
       * metni de topluyoruz. `paragraph` ise gerçek ders içeriğidir —
       * yalnızca kendi metnine bakıyoruz ki alt bloklardaki ders anlatımı
       * özet sanılıp toplanmasın.
       */
      const raw =
        type === "paragraph" ? blockPlainText(block).trim() : collectText(block);

      if (raw.length < TEASER_MIN_LENGTH) continue;

      const text =
        raw.length > TEASER_MAX_LENGTH
          ? `${raw.slice(0, TEASER_MAX_LENGTH - 1).trimEnd()}…`
          : raw;

      return {text, source: type};
    }
  }

  return {text: "", source: null};
}

/**
 * Bir kamp sayfasını ayrıştırır ve haftaları çıkarır.
 *
 * @param pageId Notion kamp sayfasının kimliği
 */
export async function parseCampPage(pageId: string): Promise<ParseResult> {
  const warnings: string[] = [];
  const weeks: ParsedWeek[] = [];

  /** Blok ağacında haftaları arar */
  async function search(
    blockId: string,
    currentStage: string | null,
    depth: number,
  ): Promise<void> {
    if (depth > MAX_SEARCH_DEPTH) return;

    const blocks = await listAllChildren(blockId);

    for (const block of blocks) {
      const text = blockPlainText(block).trim();
      if (text.length === 0 && !block.has_children) continue;

      const weekInfo = parseWeekHeading(text);

      if (weekInfo) {
        /* ---- Bu bir HAFTA ---- */
        if (!block.has_children) {
          warnings.push(
            `Hafta ${weekInfo.weekNumber} ("${weekInfo.title}") bulundu ama ` +
              `içeriği boş — Notion'da bu toggle'ın içine bir şey yazılmamış.`,
          );
        }

        const contentBlocks = block.has_children
          ? await fetchSubtree(block.id)
          : [];

        const teaser = extractSuggestedTeaser(contentBlocks);

        weeks.push({
          blockId: block.id,
          weekNumber: weekInfo.weekNumber,
          title: weekInfo.title,
          stage: currentStage,
          blocks: contentBlocks,
          suggestedTeaser: teaser.text,
          teaserSource: teaser.source,
        });

        // Haftanın içine hafta aramıyoruz
        continue;
      }

      /* ---- Hafta değil: aşama olabilir, içine bakalım ---- */
      if (block.has_children && block.type !== "child_page") {
        const nextStage = isStageHeading(text) ? text : currentStage;
        await search(block.id, nextStage, depth + 1);
      }
    }
  }

  await search(pageId, null, 0);

  /* ---- Tutarlılık kontrolleri ---- */

  weeks.sort((a, b) => a.weekNumber - b.weekNumber);

  // Tekrar eden hafta numarası
  const seen = new Map<number, string>();
  for (const week of weeks) {
    const existing = seen.get(week.weekNumber);
    if (existing) {
      warnings.push(
        `Hafta ${week.weekNumber} İKİ KEZ tanımlanmış: ` +
          `"${existing}" ve "${week.title}". Sonuncusu kullanılacak.`,
      );
    }
    seen.set(week.weekNumber, week.title);
  }

  // Atlanan hafta numarası (1..max arasında eksik olan)
  if (weeks.length > 0) {
    const max = Math.max(...weeks.map((w) => w.weekNumber));
    const present = new Set(weeks.map((w) => w.weekNumber));
    const missing: number[] = [];
    for (let i = 1; i <= max; i++) {
      if (!present.has(i)) missing.push(i);
    }
    if (missing.length > 0) {
      warnings.push(
        `Eksik hafta numaraları: ${missing.join(", ")} ` +
          `(1..${max} arası bekleniyordu). Notion'da bu haftaların başlıkları ` +
          `"Hafta N" kalıbına uymuyor olabilir.`,
      );
    }
  } else {
    warnings.push(
      "Bu sayfada hiç hafta bulunamadı. Başlıkların 'Hafta 1: ...' " +
        "biçiminde olduğundan emin ol.",
    );
  }

  return {weeks, warnings};
}
