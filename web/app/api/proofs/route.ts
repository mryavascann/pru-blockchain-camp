/**
 * GET /api/proofs?camp=developers
 *
 * Oturum sahibinin bu kamptaki merkle proof'larını döner.
 * Arayüz bunu alıp "Rozeti Al" butonlarını oluşturur.
 *
 * ---------------------------------------------------------------------------
 * HER HAFTA ÜÇ DURUMDAN BİRİNDE OLUR:
 *
 *   claimable          → proof hazır, kök zincirde, rozet henüz alınmamış
 *                        → "Rozeti Al" butonu aktif
 *
 *   alreadyClaimed     → rozet zaten cüzdanda
 *                        → yeşil onay işareti, buton yok
 *
 *   pendingPublication → hak edildi ama kök henüz zincire yazılmadı
 *                        → "Liste yayınlanmayı bekliyor" bilgisi
 *
 * ÜÇÜNCÜ DURUM NEDEN ÖNEMLİ: Kök yazılmadan kullanıcıya "Rozeti Al" butonu
 * gösterseydik, kullanıcı butona basar, cüzdanını onaylar, GAS ÖDER ve işlem
 * `InvalidMerkleProof` ile geri dönerdi. Başarısız bir işlem için para
 * harcatmak kabul edilemez — bu yüzden zincirdeki kökü ÖNCEDEN kontrol
 * ediyoruz.
 * ---------------------------------------------------------------------------
 */
import {requireViewer} from "@/lib/auth/guards";
import {getCampBySlug} from "@/lib/content/access";
import {getProofsForAddress} from "@/lib/merkle/service";
import {readBalancesForPairs} from "@/lib/chain/client";
import {encodeTokenId} from "@/lib/chain/tokenId";
import {fail, handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer();

    const campSlug = new URL(request.url).searchParams.get("camp");
    if (!campSlug) {
      return fail("Kamp belirtilmedi (?camp=developers).", 400, "MISSING_CAMP");
    }

    const camp = await getCampBySlug(campSlug);
    if (!camp) {
      return fail("Böyle bir kamp bulunamadı.", 404, "CAMP_NOT_FOUND");
    }

    const bundle = await getProofsForAddress(viewer.address!, camp.id);

    /* ---- Hangileri zaten alınmış? Tek RPC çağrısında öğreniyoruz ---- */
    const claimableWeeks = bundle.claimable.map((c) => c.weekNumber);

    const owned =
      claimableWeeks.length > 0
        ? await readBalancesForPairs(
            claimableWeeks.map((week) => ({
              address: viewer.address as `0x${string}`,
              tokenId: encodeTokenId(camp.id, week),
            })),
          )
        : [];

    const weeks = bundle.claimable.map((entry, index) => ({
      weekNumber: entry.weekNumber,
      proof: entry.proof,
      alreadyClaimed: owned[index] ?? false,
    }));

    const readyToClaim = weeks.filter((w) => !w.alreadyClaimed);

    return ok({
      camp: {id: camp.id, slug: camp.slug, name: camp.name},
      /** Nick yoksa mint zincirde reddedilir — arayüz önce nick istemeli */
      requiresNickname: !viewer.hasNickname,
      weeks,
      /** Tek işlemde alınabilecek haftalar (claimBatch için) */
      claimableWeekNumbers: readyToClaim.map((w) => w.weekNumber),
      claimableProofs: readyToClaim.map((w) => w.proof),
      /** Hak edildi ama kökü henüz yayınlanmadı */
      pendingPublication: bundle.pendingPublication,
    });
  });
}
