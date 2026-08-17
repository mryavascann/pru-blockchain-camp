/**
 * GET /api/camps/[slug]
 *
 * Bir kampın MÜFREDAT ÖZETİ. HERKESE AÇIK — cüzdan gerekmez.
 *
 * Dönen veri: hafta numaraları, başlıklar, özetler, aşama grupları.
 * Gerçek ders içeriği YOK — `lib/content/access.ts` bunu sorgu seviyesinde
 * garanti eder.
 *
 * Bu uç nokta yeni üye çekmenin vitrinidir; arama motorlarına da açıktır.
 */
import {getCampBySlug, getCurriculum} from "@/lib/content/access";
import {fail, handle, ok} from "@/lib/api";

export async function GET(
  _request: Request,
  {params}: {params: Promise<{slug: string}>},
) {
  return handle(async () => {
    const {slug} = await params;

    const camp = await getCampBySlug(slug);
    if (!camp) {
      return fail("Böyle bir kamp bulunamadı.", 404, "CAMP_NOT_FOUND");
    }

    const weeks = await getCurriculum(camp.id);

    return ok({
      camp,
      weeks,
      /**
       * Hangi haftanın herkese açık olduğu. Arayüz bu haftayı "🌐 Herkese
       * Açık" rozetiyle gösterir ve kilit ikonu koymaz.
       */
      publicWeekNumber: camp.publicWeekNumber,
    });
  });
}
