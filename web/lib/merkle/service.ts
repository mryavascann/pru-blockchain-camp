/**
 * ============================================================================
 * Merkle servis katmanı — veritabanı ile ağaç arasındaki köprü
 *
 * İKİ İŞ YAPAR:
 *   1. Hak ediş listesinden ağaç üretip saklamak  (admin işlemi)
 *   2. Saklanmış ağaçtan kullanıcının proof'unu çıkarmak (kullanıcı isteği)
 *
 * ---------------------------------------------------------------------------
 * NEDEN AĞAÇ SAKLANIYOR, HER İSTEKTE YENİDEN KURULMUYOR
 *
 * Ağaç, üretildiği ANDAKİ listeye göre kurulur ve kökü zincire yazılır.
 * Sonradan listeye biri eklenirse FARKLI bir ağaç ve FARKLI bir kök oluşur.
 *
 * Eğer proof isteğinde ağacı o anki listeden yeniden kursaydık, zincirdeki
 * (eski) kökle uyuşmayan proof'lar üretirdik. Kullanıcı "Rozeti Al"a basar,
 * gas öder, işlem `InvalidMerkleProof` ile geri döner — ve kimse sebebini
 * anlamaz.
 *
 * Saklanan ağaç, zincire yazılmış kökün TAM KARŞILIĞIDIR.
 * ---------------------------------------------------------------------------
 */
import {db} from "@/lib/db";
import {readMerkleRoot} from "@/lib/chain/client";
import {buildMerkleTree, getProofFromDump} from "./tree";

export type GeneratedTree = {
  campId: number;
  weekNumber: number;
  root: `0x${string}`;
  entryCount: number;
  /** Bu kök zincirde zaten yazılı mı? */
  alreadyOnChain: boolean;
  /** Değişti mi — yoksa aynı listeden aynı ağaç mı çıktı? */
  changed: boolean;
};

/**
 * Bir (kamp, hafta) için hak ediş listesinden merkle ağacı üretir ve saklar.
 *
 * Liste kaynağı: `WeeklyCompletion` tablosu. Oraya kayıt yalnızca adminin
 * onayıyla girer (geri doldurma onayı veya haftalık işaretleme).
 *
 * @returns Üretilen ağacın özeti, ya da hak eden kimse yoksa `null`
 */
export async function generateTree(
  campId: number,
  weekNumber: number,
  createdBy: string,
): Promise<GeneratedTree | null> {
  const completions = await db.weeklyCompletion.findMany({
    where: {campId, weekNumber},
    select: {address: true},
    orderBy: {address: "asc"},
  });

  if (completions.length === 0) return null;

  const {root, dump, entryCount} = buildMerkleTree(
    campId,
    weekNumber,
    completions.map((c) => c.address),
  );

  // Aynı kök zaten üretilmişse yeni kayıt açmıyoruz — gereksiz geçmiş şişmesi
  const latest = await db.merkleTree.findFirst({
    where: {campId, weekNumber},
    orderBy: {createdAt: "desc"},
    select: {root: true},
  });

  const changed = latest?.root !== root;

  if (changed) {
    await db.merkleTree.create({
      data: {
        campId,
        weekNumber,
        root,
        treeJson: dump as object,
        entryCount,
        createdBy,
      },
    });
  }

  const onChainRoot = await readMerkleRoot(campId, weekNumber).catch(
    () => "0x0" as `0x${string}`,
  );

  return {
    campId,
    weekNumber,
    root,
    entryCount,
    alreadyOnChain: onChainRoot.toLowerCase() === root.toLowerCase(),
    changed,
  };
}

export type ClaimableWeek = {
  weekNumber: number;
  /** Zincire sunulacak proof */
  proof: `0x${string}`[];
  /** Ağacın kökü */
  root: string;
  /** Bu kök zincire yazılmış mı? Yazılmadıysa mint henüz mümkün değil. */
  rootPublished: boolean;
};

export type ProofBundle = {
  campId: number;
  /** Kullanıcının proof'u olan haftalar */
  claimable: ClaimableWeek[];
  /**
   * Hak edilen ama kökü henüz zincire yazılmamış haftalar.
   * Arayüzde "liste yayınlanmayı bekliyor" olarak gösterilir — kullanıcı
   * başarısız bir işleme gas ödemesin.
   */
  pendingPublication: number[];
};

/**
 * Bir adresin bir kamptaki tüm proof'larını çıkarır.
 *
 * Her hafta için EN SON üretilen ağaç kullanılır — zincire yazılan da odur.
 */
export async function getProofsForAddress(
  address: string,
  campId: number,
): Promise<ProofBundle> {
  const normalized = address.toLowerCase();

  /*
   * Her hafta için en son ağacı alıyoruz.
   *
   * Prisma'da "grup başına en son satır" doğrudan ifade edilemediği için
   * tüm ağaçları tarihe göre çekip ilk gördüğümüzü tutuyoruz. Kayıt sayısı
   * hafta sayısı × yeniden üretim sayısı kadar; yani onlarca, binlerce değil.
   */
  const trees = await db.merkleTree.findMany({
    where: {campId},
    orderBy: [{weekNumber: "asc"}, {createdAt: "desc"}],
    select: {weekNumber: true, root: true, treeJson: true},
  });

  const latestPerWeek = new Map<number, (typeof trees)[number]>();
  for (const tree of trees) {
    if (!latestPerWeek.has(tree.weekNumber)) {
      latestPerWeek.set(tree.weekNumber, tree);
    }
  }

  const claimable: ClaimableWeek[] = [];
  const pendingPublication: number[] = [];

  for (const [weekNumber, tree] of [...latestPerWeek].sort(
    (a, b) => a[0] - b[0],
  )) {
    const proof = getProofFromDump(tree.treeJson, normalized, campId, weekNumber);
    if (!proof) continue; // bu kişi bu haftanın listesinde değil

    // Zincirdeki kök bizim ağacımızla aynı mı?
    const onChainRoot = await readMerkleRoot(campId, weekNumber).catch(
      () => "0x0" as `0x${string}`,
    );
    const rootPublished = onChainRoot.toLowerCase() === tree.root.toLowerCase();

    if (rootPublished) {
      claimable.push({weekNumber, proof, root: tree.root, rootPublished});
    } else {
      pendingPublication.push(weekNumber);
    }
  }

  return {campId, claimable, pendingPublication};
}

/**
 * Geri doldurma onayı: beyan edilen hafta N ise 1..N için tamamlama kaydı açar.
 *
 * Bu, projenin "3. haftadan başlayan katılımcı 1. ve 2. hafta rozetlerini de
 * alır" şartının veritabanı karşılığıdır.
 *
 * `skipDuplicates` sayesinde kişi zaten bazı haftalara sahipse (örneğin
 * haftalık akıştan) o kayıtlar tekrar oluşturulmaz.
 */
export async function recordBackfillCompletions(
  address: string,
  campId: number,
  throughWeek: number,
  createdBy: string,
): Promise<number> {
  const rows = Array.from({length: throughWeek}, (_, i) => ({
    address: address.toLowerCase(),
    campId,
    weekNumber: i + 1,
    source: "backfill",
    createdBy,
  }));

  const result = await db.weeklyCompletion.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return result.count;
}
