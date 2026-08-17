/**
 * ============================================================================
 * Notion senkronu — komut satırından
 *
 * Üretimde senkron üç yoldan tetiklenir (webhook, cron, admin paneli).
 * Bu script dördüncü yolu sağlar: geliştirirken elle çalıştırma.
 *
 * Kullanım:
 *     npm run notion:sync            → tüm kamplar
 *     npm run notion:sync -- 1       → yalnızca kamp 1
 * ============================================================================
 */
import {db} from "../lib/db";
import {syncAll} from "../lib/notion/sync";

async function main(): Promise<void> {
  const arg = process.argv[2];
  const onlyCampId = arg ? Number(arg) : undefined;

  if (arg && !Number.isInteger(onlyCampId)) {
    console.error(`✖ Geçersiz kamp kimliği: ${arg}`);
    process.exit(1);
  }

  console.log("");
  console.log("═".repeat(70));
  console.log(
    `  Notion senkronu${onlyCampId ? ` — yalnızca kamp ${onlyCampId}` : " — tüm kamplar"}`,
  );
  console.log("═".repeat(70));
  console.log("");
  console.log("  Notion'un hız limiti nedeniyle istekler saniyede ~3'e");
  console.log("  sınırlanıyor. 27 hafta için ~1 dakika sürebilir.");
  console.log("");

  const result = await syncAll("manual", onlyCampId);

  for (const camp of result.camps) {
    console.log("─".repeat(70));
    console.log(`  ${camp.campSlug.toUpperCase()}  (kamp ${camp.campId})`);
    console.log("─".repeat(70));

    if (camp.error) {
      console.log(`  ✖ HATA: ${camp.error}`);
    } else {
      console.log(`  yeni      : ${camp.created}`);
      console.log(`  güncellendi: ${camp.updated}`);
      console.log(`  değişmedi : ${camp.unchanged}`);
    }

    if (camp.warnings.length > 0) {
      console.log("");
      console.log("  UYARILAR:");
      for (const warning of camp.warnings) {
        console.log(`    ⚠ ${warning}`);
      }
    }
    console.log("");
  }

  console.log("═".repeat(70));
  if (result.success) {
    console.log(`  ✅ SENKRON BAŞARILI  (${(result.durationMs / 1000).toFixed(1)} sn)`);
  } else {
    console.log(`  ❌ SENKRON BAŞARISIZ`);
    if (result.error) console.log(`     ${result.error}`);
    console.log("");
    console.log("  Not: Başarısız senkron MEVCUT İÇERİĞİ SİLMEZ.");
    console.log("  Site son başarılı hâliyle çalışmaya devam eder.");
  }
  console.log("═".repeat(70));
  console.log("");

  process.exit(result.success ? 0 : 1);
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error("\n✖ Senkron çalıştırılamadı:\n", error);
    await db.$disconnect();
    process.exit(1);
  });
