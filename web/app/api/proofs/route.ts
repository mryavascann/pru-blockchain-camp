/**
 * GET /api/proofs?camp=developers
 *
 * Oturum sahibinin bu kamptaki merkle proof'larını döner.
 * Arayüz bunu alıp "Rozeti Al" butonlarını oluşturur.
 *
 * ---------------------------------------------------------------------------
 * HER HAFTA DÖRT DURUMDAN BİRİNDE OLUR:
 *
 *   claimable          → proof hazır, kök zincirde, rozet henüz alınmamış
 *                        → "Rozeti Al" butonu aktif
 *
 *   needsNote          → her şey hazır AMA bu hafta için not yazılmamış
 *                        → "Önce notunu bırak" — proof GÖNDERİLMEZ
 *
 *   alreadyClaimed     → rozet zaten cüzdanda
 *                        → yeşil onay işareti, buton yok
 *
 *   pendingPublication → hak edildi ama kök henüz zincire yazılmadı
 *                        → "Liste yayınlanmayı bekliyor" bilgisi
 *
 * DÖRDÜNCÜ DURUM NEDEN ÖNEMLİ: Kök yazılmadan kullanıcıya "Rozeti Al" butonu
 * gösterseydik, kullanıcı butona basar, cüzdanını onaylar, GAS ÖDER ve işlem
 * `InvalidMerkleProof` ile geri dönerdi. Başarısız bir işlem için para
 * harcatmak kabul edilemez — bu yüzden zincirdeki kökü ÖNCEDEN kontrol
 * ediyoruz.
 *
 * ---------------------------------------------------------------------------
 * NOT ZORUNLULUĞU NEDEN TAM BURADA UYGULANIYOR
 *
 * Not şartı arayüzde bir `disabled` özniteliği olarak durursa gerçek değildir:
 * tarayıcı konsolundan `claimBatch` çağıran biri onu atlar.
 *
 * Asıl kapı PROOF'un kendisidir. Proof olmadan işlem oluşturulamaz, çünkü
 * kontrat `verify(proof, root, leaf)` çalıştırır ve geçersiz proof'u
 * `InvalidMerkleProof` ile geri çevirir. Bu uç nokta not borcu olan haftanın
 * proof'unu yanıta HİÇ KOYMAZ.
 *
 * ⚠️ DÜRÜST SINIR: Bu kriptografik bir kilit DEĞİL, katılım kuralıdır.
 * Merkle ağacı, o haftanın hak eden TÜM adreslerini bilen biri tarafından
 * yeniden kurulabilir ve proof kendi başına üretilebilir. O liste
 * yayınlanmıyor (ağaç yalnızca veritabanında duruyor), ama teorik olarak
 * mümkün. Kontrat "not yazıldı mı" diye soramaz — notlar zincir dışıdır.
 * Yani bu kural, kuralı çiğnemek için uğraşmayı göze alan birini durdurmaz;
 * kampı normal takip eden herkes için gerçektir.
 * ---------------------------------------------------------------------------
 */
import {requireViewer} from "@/lib/auth/guards";
import {getCampBySlug} from "@/lib/content/access";
import {getProofsForAddress} from "@/lib/merkle/service";
import {getCampProgress, splitByNoteDebt} from "@/lib/notes/progress";
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
    if (!camp.chainCampId) {
      return fail(
        "Bu kampın NFT altyapısı henüz zincirde etkinleştirilmedi.",
        409,
        "CHAIN_ACTIVATION_PENDING",
      );
    }

    const [bundle, progress] = await Promise.all([
      getProofsForAddress(viewer.address!, camp.id),
      getCampProgress(viewer.address, camp.id, camp.weekCount, false),
    ]);

    /* ---- Hangileri zaten alınmış? Tek RPC çağrısında öğreniyoruz ---- */
    const claimableWeeks = bundle.claimable.map((c) => c.weekNumber);

    const owned =
      claimableWeeks.length > 0
        ? await readBalancesForPairs(
            claimableWeeks.map((week) => ({
              address: viewer.address as `0x${string}`,
              tokenId: encodeTokenId(camp.chainCampId!, week),
            })),
          )
        : [];

    /*
     * Not borçlu haftaların proof'u burada SAKLANIYOR.
     * Kural saf bir fonksiyonda duruyor ki doğrudan test edilebilsin —
     * bkz. lib/notes/progress.ts → splitByNoteDebt.
     */
    const split = splitByNoteDebt(
      bundle.claimable.map((entry, index) => ({
        weekNumber: entry.weekNumber,
        proof: entry.proof,
        alreadyClaimed: owned[index] ?? false,
      })),
      progress.owedWeeks,
    );

    return ok({
      camp: {id: camp.chainCampId, slug: camp.slug, name: camp.name},
      /** Nick yoksa mint zincirde reddedilir — arayüz önce nick istemeli */
      requiresNickname: !viewer.hasNickname,
      /** Nick durumu okunamadıysa "nick al" demek yanlış olur — bkz. guards.ts */
      nicknameUnknown: viewer.nicknameUnknown,
      weeks: split.weeks,
      /** Tek işlemde alınabilecek haftalar (claimBatch için) */
      claimableWeekNumbers: split.readyWeekNumbers,
      claimableProofs: split.readyProofs,
      /** Hak edildi ama kökü henüz yayınlanmadı */
      pendingPublication: bundle.pendingPublication,
      /** Rozeti almak için önce not yazılması gereken haftalar */
      needsNote: split.needsNote,
      /** İlerleme durumu — arayüz "sıradaki hafta ne zaman açılır"ı gösterir */
      progress: {
        entitledWeek: progress.entitledWeek,
        entryWeek: progress.entryWeek,
        visibleWeek: progress.visibleWeek,
        owedWeeks: progress.owedWeeks,
        /* Rozet ekranındaki not formu "bu kişinin ilk notu mu?" diye
           soruyor — tek seferlik yazma rehberi buna bakıyor. */
        notedWeeks: progress.notedWeeks,
        blockingWeek: progress.blockingWeek,
      },
    });
  });
}
