/**
 * PATCH /api/notes/[id] — Kendi notunu düzenle
 *
 * Sahiplik kontrolü veritabanı sorgusunun `where` koşulunda yapılır
 * (bkz. lib/notes/service.ts → updateOwnNote). Önce "oku, adresi karşılaştır,
 * yaz" yapsaydık iki adım arasında bir yarış penceresi kalırdı.
 *
 * NEDEN SİLME YOK: Not, bir haftanın rozetini ve sonraki haftayı açıyor.
 * Silinebilseydi kişi notunu yazıp rozetini alır, sonra notu silip
 * defteri boşaltırdı — zorunluluk anlamsızlaşırdı. Düzeltmek serbest,
 * geri almak değil.
 */
import {requireViewer} from "@/lib/auth/guards";
import {updateOwnNote} from "@/lib/notes/service";
import {validateNote} from "@/lib/notes/rules";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

type PatchBody = {
  kind?: string;
  title?: string;
  body?: string;
  sourceUrl?: string | null;
  aiAssisted?: boolean;
};

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>},
) {
  return handle(async () => {
    const viewer = await requireViewer();
    const {id} = await params;

    const payload = (await readJson<PatchBody>(request)) ?? {};

    const validation = validateNote({
      kind: payload.kind ?? "",
      title: payload.title ?? "",
      body: payload.body ?? "",
      sourceUrl: payload.sourceUrl,
      aiAssisted: payload.aiAssisted,
    });

    if (!validation.ok) {
      return fail(validation.error, 400, "VALIDATION_ERROR");
    }

    const updated = await updateOwnNote(id, viewer.address!, {
      ...validation.value,
      /* Nick değişmiş olabilir — düzenlemede tazeleniyor */
      authorNickname: viewer.nickname,
    });

    if (!updated) {
      /*
       * Not yok, başkasına ait, ya da yönetim tarafından gizlenmiş.
       * Üçünü ayırt etmiyoruz: "bu id başkasına ait" demek, saldırgana
       * hangi id'lerin var olduğunu doğrulatır.
       */
      return fail("Bu not düzenlenemedi.", 404, "NOT_FOUND");
    }

    return ok({note: updated});
  });
}
