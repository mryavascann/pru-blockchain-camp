/**
 * /api/admin/merkle — Merkle ağacı üretimi
 *
 *   GET  → Kampın haftalarındaki ağaç/kök durumu
 *   POST → Bir veya birden fazla hafta için ağaç üret
 *
 * ---------------------------------------------------------------------------
 * BU UÇ NOKTA ZİNCİRE YAZMAZ.
 *
 * Ağacı üretir, veritabanına kaydeder ve kökü döner. Kökü zincire yazma
 * işini admin kendi cüzdanıyla yapar:
 *
 *     cast send $PROXY "setMerkleRoot(uint256,uint256,bytes32)" \
 *       <kamp> <hafta> <kok> --rpc-url base_sepolia --account pru-testnet
 *
 * ya da (Faz 3) admin panelindeki "Zincire Yaz" butonuyla — o da tarayıcıdaki
 * cüzdanı kullanır, sunucuyu değil.
 *
 * NEDEN: Sunucuda private key tutmak, sunucu ele geçirildiğinde saldırganın
 * kendine sınırsız rozet yazdırabilmesi demek. İmza yetkisini insanda tutmak
 * bu riski tamamen ortadan kaldırıyor.
 * ---------------------------------------------------------------------------
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireAdmin} from "@/lib/auth/guards";
import {generateTree} from "@/lib/merkle/service";
import {readMerkleRoot} from "@/lib/chain/client";
import {contractAddress} from "@/lib/chain/config";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  DURUM                                     */
/* -------------------------------------------------------------------------- */

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const slug = new URL(request.url).searchParams.get("camp");
    if (!slug) {
      return fail("Kamp belirtilmedi (?camp=developers).", 400, "MISSING_CAMP");
    }

    const camp = await db.camp.findUnique({
      where: {slug},
      select: {id: true, name: true, slug: true, weekCount: true},
    });
    if (!camp) return fail("Kamp bulunamadı.", 404, "CAMP_NOT_FOUND");

    /* Hak eden sayıları */
    const completions = await db.weeklyCompletion.groupBy({
      by: ["weekNumber"],
      where: {campId: camp.id},
      _count: true,
    });
    const eligibleByWeek = new Map(
      completions.map((c) => [c.weekNumber, c._count]),
    );

    /* Üretilmiş en son ağaçlar */
    const trees = await db.merkleTree.findMany({
      where: {campId: camp.id},
      orderBy: [{weekNumber: "asc"}, {createdAt: "desc"}],
      select: {weekNumber: true, root: true, entryCount: true, createdAt: true},
    });
    const latestTree = new Map<number, (typeof trees)[number]>();
    for (const tree of trees) {
      if (!latestTree.has(tree.weekNumber)) latestTree.set(tree.weekNumber, tree);
    }

    /* Zincirdeki kökler */
    const weeks = await Promise.all(
      Array.from({length: camp.weekCount}, async (_, i) => {
        const weekNumber = i + 1;
        const tree = latestTree.get(weekNumber);
        const onChainRoot = await readMerkleRoot(camp.id, weekNumber).catch(
          () => null,
        );

        const published =
          Boolean(tree) &&
          onChainRoot?.toLowerCase() === tree!.root.toLowerCase();

        return {
          weekNumber,
          eligibleCount: eligibleByWeek.get(weekNumber) ?? 0,
          treeRoot: tree?.root ?? null,
          treeEntryCount: tree?.entryCount ?? 0,
          treeCreatedAt: tree?.createdAt ?? null,
          onChainRoot,
          /** Ağaç üretildi ve kökü zincirde mi? */
          published,
          /** Ağaç var ama zincirde farklı/eksik kök → yazılması gerekiyor */
          needsPublishing: Boolean(tree) && !published,
        };
      }),
    );

    return ok({camp, contractAddress, weeks});
  });
}

/* -------------------------------------------------------------------------- */
/*                                 ÜRETİM                                     */
/* -------------------------------------------------------------------------- */

const generateSchema = z.object({
  campSlug: z.string().min(1),
  /** Belirli haftalar; verilmezse hak eden kaydı olan TÜM haftalar */
  weeks: z.array(z.number().int().min(1)).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const admin = await requireAdmin();

    const parsed = generateSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("İstek bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const camp = await db.camp.findUnique({
      where: {slug: parsed.data.campSlug},
      select: {id: true, name: true, weekCount: true},
    });
    if (!camp) return fail("Kamp bulunamadı.", 404, "CAMP_NOT_FOUND");

    /* Hangi haftalar için üreteceğiz */
    let targetWeeks = parsed.data.weeks;
    if (!targetWeeks || targetWeeks.length === 0) {
      const grouped = await db.weeklyCompletion.groupBy({
        by: ["weekNumber"],
        where: {campId: camp.id},
      });
      targetWeeks = grouped.map((g) => g.weekNumber).sort((a, b) => a - b);
    }

    if (targetWeeks.length === 0) {
      return fail(
        `"${camp.name}" için hiç hak ediş kaydı yok. ` +
          `Önce başvuruları onayla.`,
        400,
        "NO_COMPLETIONS",
      );
    }

    const results = [];
    for (const week of targetWeeks) {
      if (week < 1 || week > camp.weekCount) continue;
      const tree = await generateTree(camp.id, week, admin.address!);
      if (tree) results.push(tree);
    }

    /* Zincire yazılması gereken kökler için hazır komutlar */
    const commands = results
      .filter((r) => !r.alreadyOnChain)
      .map(
        (r) =>
          `cast send ${contractAddress} ` +
          `"setMerkleRoot(uint256,uint256,bytes32)" ` +
          `${r.campId} ${r.weekNumber} ${r.root} ` +
          `--rpc-url https://sepolia.base.org --account pru-testnet`,
      );

    return ok({
      camp: {id: camp.id, name: camp.name},
      trees: results,
      /** Zincire yazılması gereken hafta sayısı */
      needsPublishing: results.filter((r) => !r.alreadyOnChain).length,
      /** Kopyala-yapıştır hazır komutlar */
      publishCommands: commands,
    });
  });
}
