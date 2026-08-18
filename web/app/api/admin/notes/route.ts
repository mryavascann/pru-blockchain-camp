/**
 * /api/admin/notes — Not denetimi
 *
 *   GET   → tüm notlar (gizlenmişler dahil)
 *   PATCH → bir notu gizle / geri aç
 *
 * Not defteri, sitedeki TEK kullanıcı üretimi içerik alanı. Yanlış bilgi ya
 * da spam gelme ihtimali gerçek; yönetimin müdahale edebilmesi gerekiyor.
 *
 * Silme değil GİZLEME: kayıt durur, geri alınabilir, "benim notum nerede"
 * sorusuna cevap verilebilir.
 */
import {requireAdmin} from "@/lib/auth/guards";
import {listAllNotesForAdmin, setNoteStatus} from "@/lib/notes/service";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const params = new URL(request.url).searchParams;
    const campId = params.get("camp") ? Number(params.get("camp")) : undefined;
    const statusParam = params.get("status");
    const status =
      statusParam === "VISIBLE" || statusParam === "HIDDEN"
        ? statusParam
        : undefined;

    const notes = await listAllNotesForAdmin({
      campId: Number.isInteger(campId) ? campId : undefined,
      status,
    });

    return ok({notes});
  });
}

type PatchBody = {noteId?: string; status?: string};

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const payload = (await readJson<PatchBody>(request)) ?? {};

    if (!payload.noteId) {
      return fail("Not belirtilmedi.", 400, "MISSING_NOTE");
    }
    if (payload.status !== "VISIBLE" && payload.status !== "HIDDEN") {
      return fail("Durum geçersiz.", 400, "BAD_STATUS");
    }

    const updated = await setNoteStatus(payload.noteId, payload.status);

    return ok({
      note: updated,
      /*
       * Yönetimin bilmesi gereken yan etki: gizlemek, yazarın o hafta için
       * not borcunu KAPATMAYA devam eder. Yani gizlenen notun sahibinin
       * açılmış haftası geri kapanmaz. Sebebi lib/notes/service.ts'te.
       */
      notice:
        payload.status === "HIDDEN"
          ? "Not gizlendi. Yazarın açılmış haftaları geri kapanmaz — gerekirse kişiyle konuş."
          : "Not tekrar görünür.",
    });
  });
}
