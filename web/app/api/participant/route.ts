/**
 * /api/participant — Katılımcı profili (üniversite + siteyi nereden duydu)
 *
 *   GET → kendi profilim
 *   PUT → kaydet / güncelle
 *
 * Oturum gerektirir. Adres oturumdan gelir — istekle GÖNDERİLMEZ. Aksi hâlde
 * herhangi biri başkasının profilini yazabilirdi.
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireViewer} from "@/lib/auth/guards";
import {
  REFERRAL_VALUES,
  UNIVERSITY_MAX_LENGTH,
  REFERRAL_DETAIL_MAX_LENGTH,
} from "@/lib/participant";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const viewer = await requireViewer();

    const participant = await db.participant.findUnique({
      where: {address: viewer.address!},
      select: {university: true, referralSource: true, referralDetail: true},
    });

    return ok({
      profile: participant ?? {
        university: null,
        referralSource: null,
        referralDetail: null,
      },
    });
  });
}

const profileSchema = z.object({
  university: z.string().trim().min(1).max(UNIVERSITY_MAX_LENGTH),
  referralSource: z.enum(REFERRAL_VALUES as [string, ...string[]]),
  referralDetail: z.string().trim().max(REFERRAL_DETAIL_MAX_LENGTH).optional(),
});

export async function PUT(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer();

    const parsed = profileSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail(
        "Üniversite ve 'nereden duydun' bilgisi eksik veya hatalı.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const {university, referralSource, referralDetail} = parsed.data;

    /*
     * "Diğer" seçilmişse açıklama beklenir — aksi hâlde cevap yönetime
     * hiçbir şey anlatmaz. Diğer seçeneklerde açıklama saklanmaz ki
     * kullanıcı bir seçenekten diğerine geçtiğinde eski metin arkada kalmasın.
     */
    if (referralSource === "other" && !referralDetail) {
      return fail(
        "'Diğer' seçtiysen kısaca nereden duyduğunu yazar mısın?",
        400,
        "DETAIL_REQUIRED",
      );
    }

    const data = {
      university,
      referralSource,
      referralDetail: referralSource === "other" ? (referralDetail ?? null) : null,
    };

    const participant = await db.participant.upsert({
      where: {address: viewer.address!},
      create: {address: viewer.address!, ...data},
      update: data,
      select: {university: true, referralSource: true, referralDetail: true},
    });

    return ok({profile: participant});
  });
}
