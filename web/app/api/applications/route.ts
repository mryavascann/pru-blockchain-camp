/**
 * /api/applications — Geri doldurma başvuruları (Faz A)
 *
 *   POST  → "Ben bu kampın N. haftasındayım" beyanı
 *   GET   → Kendi başvurularımın durumu
 *
 * ---------------------------------------------------------------------------
 * ⚠️ BU SİSTEMİN TEK GÜVEN NOKTASI
 *
 * Beyan edilen hafta HİÇBİR otomatik doğrulamadan geçmez. Kullanıcı "15.
 * haftadayım" diyebilir. Bunu doğrulayan tek şey, kulüp yöneticisinin admin
 * panelinde tek tek inceleyip onaylamasıdır.
 *
 * Bu bilinçli bir tasarım tercihi (proje şartlarında açıkça istendi):
 * otomasyon yok, otomatik doğrulama yok. Onay verilene kadar zincirde
 * hiçbir şey olmaz — beyan yalnızca bir kuyruk kaydıdır.
 * ---------------------------------------------------------------------------
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireViewer} from "@/lib/auth/guards";
import {getCampBySlug} from "@/lib/content/access";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

const applicationSchema = z.object({
  campSlug: z.string().min(1),
  declaredWeek: z.number().int().min(1),
  /** Kullanıcının düşündüğü nick — henüz zincirde değil, sadece beyan */
  nickname: z.string().max(20).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer();

    const body = await readJson<unknown>(request);
    const parsed = applicationSchema.safeParse(body);

    if (!parsed.success) {
      return fail(
        "Başvuru bilgileri eksik veya hatalı.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const {campSlug, declaredWeek, nickname, note} = parsed.data;

    const camp = await getCampBySlug(campSlug);
    if (!camp) {
      return fail("Böyle bir kamp bulunamadı.", 404, "CAMP_NOT_FOUND");
    }

    if (!camp.active) {
      return fail(
        `"${camp.name}" şu anda yeni başvuru kabul etmiyor.`,
        400,
        "CAMP_INACTIVE",
      );
    }

    if (declaredWeek > camp.weekCount) {
      return fail(
        `Bu kamp ${camp.weekCount} haftalık. ${declaredWeek}. hafta beyan edilemez.`,
        400,
        "WEEK_OUT_OF_RANGE",
      );
    }

    /* ---- Aynı kampa ikinci başvuru ---- */
    const existing = await db.application.findUnique({
      where: {address_campId: {address: viewer.address!, campId: camp.id}},
    });

    if (existing) {
      if (existing.status === "PENDING") {
        return fail(
          "Bu kamp için zaten bekleyen bir başvurun var. " +
            "Kulüp yöneticisi inceledikten sonra bilgilendirileceksin.",
          409,
          "ALREADY_PENDING",
        );
      }
      if (existing.status === "APPROVED") {
        return fail(
          "Bu kamp için başvurun zaten onaylanmış. " +
            "Profil sayfandan rozetlerini alabilirsin.",
          409,
          "ALREADY_APPROVED",
        );
      }
      // REDDEDİLMİŞ başvuru → tekrar denemeye izin veriyoruz.
      // Kişi eksik bilgi vermiş olabilir; kalıcı olarak engellemek doğru değil.
      const updated = await db.application.update({
        where: {id: existing.id},
        data: {
          declaredWeek,
          nickname: nickname ?? null,
          note: note ?? null,
          status: "PENDING",
          reviewedBy: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });

      return ok({application: updated, resubmitted: true});
    }

    const application = await db.application.create({
      data: {
        address: viewer.address!,
        campId: camp.id,
        declaredWeek,
        nickname: nickname ?? null,
        note: note ?? null,
        status: "PENDING",
      },
    });

    return ok({application, resubmitted: false}, {status: 201});
  });
}

export async function GET() {
  return handle(async () => {
    const viewer = await requireViewer();

    const applications = await db.application.findMany({
      where: {address: viewer.address!},
      orderBy: {createdAt: "desc"},
      include: {
        camp: {select: {slug: true, name: true, weekCount: true}},
      },
    });

    return ok({applications});
  });
}
