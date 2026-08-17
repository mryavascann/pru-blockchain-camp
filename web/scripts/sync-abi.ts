/**
 * ============================================================================
 * ABI Senkronizasyonu
 *
 * Foundry'nin derleme çıktısından (`contracts/out/...`) kontrat ABI'sini alıp
 * `lib/chain/abi.ts` dosyasına yazar.
 *
 * NEDEN SCRIPT, NEDEN ELLE KOPYALAMA DEĞİL:
 * ABI'yi elle kopyalamak, kontrat değiştiğinde frontend'in sessizce eski
 * arayüzle konuşmaya devam etmesi demektir. Böyle bir uyumsuzluk derleme
 * hatası vermez — çalışma anında anlaşılmaz "execution reverted" hatalarına
 * dönüşür. Tek komutla üretilebilir olması bu riski ortadan kaldırır.
 *
 * Kullanım:
 *     npm run sync:abi
 *
 * `as const` ile yazılır — viem bu sayede fonksiyon adlarını, parametre ve
 * dönüş tiplerini TAM OLARAK çıkarır. Yani `readContract` çağrısında yanlış
 * fonksiyon adı yazarsan TypeScript hata verir.
 * ============================================================================
 */
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {dirname, join} from "node:path";

const ARTIFACT = join(
  process.cwd(),
  "..",
  "contracts",
  "out",
  "PruCampBadges.sol",
  "PruCampBadges.json",
);

const OUTPUT = join(process.cwd(), "lib", "chain", "abi.ts");

function main(): void {
  let raw: string;
  try {
    raw = readFileSync(ARTIFACT, "utf8");
  } catch {
    console.error(
      `\n✖ Derleme çıktısı bulunamadı:\n  ${ARTIFACT}\n\n` +
        `  Önce kontratları derle:\n    cd ../contracts && forge build\n`,
    );
    process.exit(1);
  }

  const artifact = JSON.parse(raw) as {abi: unknown[]};
  if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
    console.error("✖ Derleme çıktısında ABI yok veya boş.");
    process.exit(1);
  }

  const header = `// ============================================================================
// OTOMATİK ÜRETİLDİ — ELLE DÜZENLEME
//
// Kaynak : contracts/out/PruCampBadges.sol/PruCampBadges.json
// Üretim : npm run sync:abi
//
// Kontratta bir değişiklik yaptıysan önce \`forge build\`, sonra bu komutu
// çalıştır. Aksi hâlde frontend eski arayüzle konuşmaya devam eder.
// ============================================================================

export const pruCampBadgesAbi = `;

  const body = JSON.stringify(artifact.abi, null, 2);

  mkdirSync(dirname(OUTPUT), {recursive: true});
  writeFileSync(OUTPUT, `${header}${body} as const;\n`, "utf8");

  const fnCount = (artifact.abi as {type?: string}[]).filter(
    (x) => x.type === "function",
  ).length;
  const eventCount = (artifact.abi as {type?: string}[]).filter(
    (x) => x.type === "event",
  ).length;
  const errorCount = (artifact.abi as {type?: string}[]).filter(
    (x) => x.type === "error",
  ).length;

  console.log(`✔ ABI yazıldı → lib/chain/abi.ts`);
  console.log(`  ${fnCount} fonksiyon, ${eventCount} olay, ${errorCount} hata`);
}

main();
