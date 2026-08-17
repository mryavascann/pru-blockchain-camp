/**
 * ============================================================================
 * Veritabanı tohumlama (seed)
 *
 * Kampları ZİNCİRDEN okuyup veritabanına yazar.
 *
 * NEDEN ZİNCİR KAYNAK ALINIYOR:
 * `campId` ve `weekCount` zincirde tanımlı. Veritabanına elle yazsaydık iki
 * taraf zamanla ayrışırdı — ve ayrışma sessiz olurdu: site 15 hafta gösterir,
 * kontrat 18 hafta bilir, kullanıcı 16. haftanın rozetini alamaz ve sebebini
 * kimse anlamaz.
 *
 * Zincirden okumak bu sınıf hatayı baştan imkânsız kılar.
 *
 * Yalnızca zincirde OLMAYAN alanlar burada tanımlanır:
 *   • slug            → URL'de kullanılan kısa ad
 *   • notionSourceId  → içeriğin çekileceği Notion sayfası
 *   • description     → landing sayfasındaki tanıtım
 *   • displayOrder    → listeleme sırası
 *
 * Bu script TEKRAR ÇALIŞTIRILABİLİR (idempotent): mevcut kayıtları günceller,
 * admin panelinden yapılmış ayarları (publicWeekNumber vb.) EZMEZ.
 *
 * Kullanım:  npm run db:seed
 * ============================================================================
 */
import {db} from "../lib/db";
import {readAllCamps} from "../lib/chain/client";

/**
 * Zincirde olmayan, elle tanımlanan kamp bilgileri.
 * Yeni bir kamp zincire eklendiğinde buraya bir satır eklenir.
 */
const CAMP_METADATA: Record<
  number,
  {slug: string; notionSourceId: string; description: string; order: number}
> = {
  1: {
    slug: "developers",
    notionSourceId: "3633a35a-9006-80fe-8e1d-da161c19c24c",
    description:
      "Blockchain temellerinden başlayıp güçlü JavaScript, akıllı kontrat " +
      "geliştirme ve hackathon hazırlığına uzanan 15 haftalık teknik program.",
    order: 1,
  },
  2: {
    slug: "directors",
    notionSourceId: "3633a35a-9006-80c4-9ff2-e7739b1452f9",
    description:
      "Yönetim kurulu üyeleri için tasarlanmış 12 haftalık program: " +
      "blokzincir altyapısı, tokenomics, DeFi ve ekosistem stratejisi.",
    order: 2,
  },
};

async function main(): Promise<void> {
  console.log("");
  console.log("═".repeat(70));
  console.log("  Veritabanı tohumlama");
  console.log("═".repeat(70));

  /* ---- 1. Zincirden oku ---- */
  console.log("");
  console.log("① Zincirden kamplar okunuyor…");

  const onChainCamps = await readAllCamps();

  if (onChainCamps.length === 0) {
    console.error(
      "\n✖ Zincirde hiç kamp yok.\n" +
        "  Önce kampları oluştur (docs/deploy.md, Adım 7).\n",
    );
    process.exit(1);
  }

  for (const camp of onChainCamps) {
    console.log(
      `  • [${camp.campId}] ${camp.name} — ${camp.weekCount} hafta ` +
        `(${camp.active ? "aktif" : "pasif"})`,
    );
  }

  /* ---- 2. Veritabanına yaz ---- */
  console.log("");
  console.log("② Veritabanına yazılıyor…");

  let missingMetadata = 0;

  for (const camp of onChainCamps) {
    const meta = CAMP_METADATA[camp.campId];

    if (!meta) {
      console.log(
        `  ⚠ [${camp.campId}] ${camp.name} — scripts/seed.ts içinde tanımlı değil, atlandı.`,
      );
      console.log(
        `      Eklemek için CAMP_METADATA'ya slug ve notionSourceId yaz.`,
      );
      missingMetadata += 1;
      continue;
    }

    await db.camp.upsert({
      where: {id: camp.campId},
      create: {
        id: camp.campId,
        slug: meta.slug,
        name: camp.name,
        description: meta.description,
        weekCount: camp.weekCount,
        active: camp.active,
        notionSourceId: meta.notionSourceId,
        displayOrder: meta.order,
      },
      update: {
        // Zincirden gelenler her zaman güncellenir
        name: camp.name,
        weekCount: camp.weekCount,
        active: camp.active,
        // Elle tanımlananlar da güncellenir (kod değişirse yansısın)
        slug: meta.slug,
        description: meta.description,
        notionSourceId: meta.notionSourceId,
        displayOrder: meta.order,
        // `publicWeekNumber` KASITLI OLARAK YOK —
        // admin panelinden yapılan ayar ezilmemeli.
      },
    });

    console.log(`  ✔ [${camp.campId}] ${camp.name} → /${meta.slug}`);
  }

  /* ---- 3. Özet ---- */
  const total = await db.camp.count();
  const weeks = await db.week.count();

  console.log("");
  console.log("═".repeat(70));
  console.log(`  Veritabanında ${total} kamp, ${weeks} hafta kaydı var.`);
  if (missingMetadata > 0) {
    console.log(`  ⚠ ${missingMetadata} kamp meta bilgisi eksik olduğu için atlandı.`);
  }
  console.log("");
  console.log("  SONRAKİ ADIM: içerikleri Notion'dan çek");
  console.log("    npm run notion:sync");
  console.log("═".repeat(70));
  console.log("");
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error("\n✖ Tohumlama başarısız:\n", error);
    await db.$disconnect();
    process.exit(1);
  });
