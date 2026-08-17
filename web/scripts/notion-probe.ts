/**
 * ============================================================================
 * Notion keşif script'i
 *
 * Token'ın çalıştığını ve HANGİ içeriğe erişebildiğini gösterir.
 *
 * NEDEN GEREKLİ:
 * Notion'da bir integration token tek başına hiçbir şeye erişemez. Her sayfa
 * veya database'in o bağlantıya AÇIKÇA paylaşılması gerekir
 * (sayfa → ⋯ → Connections → Connect to). Bu adım atlandığında token geçerli
 * görünür ama arama sonuçları boş döner — hata mesajı olmadan.
 *
 * Bu script o durumu net gösterir ve senkron kodunu yazmadan önce Notion'un
 * gerçek yapısını (sayfa mı, database mi, hangi kolonlar) ortaya çıkarır.
 *
 * Kullanım:  npm run notion:probe
 * ============================================================================
 */
import {Client, isFullPage, isFullDatabase} from "@notionhq/client";

const token = process.env.NOTION_TOKEN;

if (!token) {
  console.error("✖ NOTION_TOKEN tanımlı değil (web/.env.local)");
  process.exit(1);
}

const notion = new Client({auth: token});

/** Notion başlık özelliğinden düz metin çıkarır */
function plainTitle(obj: unknown): string {
  const anyObj = obj as {
    title?: {plain_text?: string}[];
    properties?: Record<string, {type?: string; title?: {plain_text?: string}[]}>;
  };

  if (Array.isArray(anyObj.title)) {
    return anyObj.title.map((t) => t.plain_text ?? "").join("") || "(başlıksız)";
  }

  if (anyObj.properties) {
    for (const value of Object.values(anyObj.properties)) {
      if (value?.type === "title" && Array.isArray(value.title)) {
        return value.title.map((t) => t.plain_text ?? "").join("") || "(başlıksız)";
      }
    }
  }

  return "(başlıksız)";
}

async function main(): Promise<void> {
  console.log("");
  console.log("═".repeat(74));
  console.log("  Notion bağlantı keşfi");
  console.log("═".repeat(74));

  /* ---- 1. Token geçerli mi? ---- */
  try {
    const me = await notion.users.me({});
    console.log(`  ✔ Token geçerli`);
    console.log(`    Bot adı : ${me.name ?? "(isimsiz)"}`);
    console.log(`    Bot id  : ${me.id}`);
  } catch (error) {
    console.error(`  ✖ Token geçersiz veya yetkisiz:\n`, error);
    process.exit(1);
  }

  /* ---- 2. Erişilebilir içerik ---- */
  console.log("");
  console.log("─".repeat(74));
  console.log("  ERİŞİLEBİLİR İÇERİK");
  console.log("─".repeat(74));

  const results: {type: string; id: string; title: string; parent: string}[] = [];
  let cursor: string | undefined;

  do {
    const page = await notion.search({
      page_size: 100,
      start_cursor: cursor,
    });

    for (const item of page.results) {
      const parent = (item as {parent?: {type?: string}}).parent?.type ?? "?";
      results.push({
        type: item.object,
        id: item.id,
        title:
          isFullPage(item) || isFullDatabase(item)
            ? plainTitle(item)
            : plainTitle(item),
        parent,
      });
    }

    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);

  if (results.length === 0) {
    console.log("");
    console.log("  ⚠ HİÇBİR İÇERİĞE ERİŞİM YOK.");
    console.log("");
    console.log("  Token geçerli ama hiçbir sayfa bu bağlantıya paylaşılmamış.");
    console.log("  Notion'da yapman gereken:");
    console.log("");
    console.log("    1. 'PRU Blockchain Developers' sayfasını aç");
    console.log("    2. Sağ üstte ⋯ (üç nokta) → Connections");
    console.log("    3. 'Connect to' → 'PRU Camp Site' seç");
    console.log("    4. Aynısını 'PRU Blockchain Directors' için tekrarla");
    console.log("");
    console.log("  Alt sayfalar üst sayfadan erişimi miras alır — hafta");
    console.log("  sayfalarını tek tek bağlamana gerek yok.");
    console.log("");
    process.exit(1);
  }

  const databases = results.filter((r) => r.type === "database");
  const dataSources = results.filter((r) => r.type === "data_source");
  const pages = results.filter((r) => r.type === "page");

  console.log("");
  console.log(
    `  Toplam ${results.length} öğe: ` +
      `${pages.length} sayfa, ${databases.length} database, ${dataSources.length} data source`,
  );

  if (databases.length > 0 || dataSources.length > 0) {
    console.log("");
    console.log("  DATABASE / DATA SOURCE  (senkron için ideal yapı)");
    for (const d of [...databases, ...dataSources]) {
      console.log(`    • [${d.type}] ${d.title}`);
      console.log(`      id: ${d.id}`);
    }
  }

  if (pages.length > 0) {
    console.log("");
    console.log("  SAYFALAR");
    for (const p of pages.slice(0, 40)) {
      console.log(`    • ${p.title}`);
      console.log(`      id: ${p.id}   (üst: ${p.parent})`);
    }
    if (pages.length > 40) {
      console.log(`    … ve ${pages.length - 40} sayfa daha`);
    }
  }

  /* ---- 3. Database şemaları ---- */
  for (const d of [...databases, ...dataSources]) {
    console.log("");
    console.log("─".repeat(74));
    console.log(`  KOLONLAR — ${d.title}`);
    console.log("─".repeat(74));
    try {
      const meta =
        d.type === "data_source"
          ? await notion.dataSources.retrieve({data_source_id: d.id})
          : await notion.databases.retrieve({database_id: d.id});

      const props = (meta as {properties?: Record<string, {type: string}>})
        .properties;

      if (props) {
        for (const [name, value] of Object.entries(props)) {
          console.log(`    • ${name.padEnd(24)} ${value.type}`);
        }
      } else {
        console.log("    (kolon bilgisi alınamadı)");
      }
    } catch (error) {
      console.log(`    ✖ okunamadı: ${(error as Error).message}`);
    }
  }

  console.log("");
  console.log("═".repeat(74));
  console.log("");
}

main().catch((error) => {
  console.error("\n✖ Keşif başarısız:\n", error);
  process.exit(1);
});
