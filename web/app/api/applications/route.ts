/**
 * /api/applications — Kampa katılım ve ileri hafta talepleri
 *
 *   POST  → 1. haftadan katılım veya N. haftadan başlama talebi
 *   GET   → Kendi katılım/talep durumlarım
 *
 * ---------------------------------------------------------------------------
 * ⚠️ İLERİ HAFTA GÜVEN SINIRI
 *
 * 1. hafta kamp ayarına göre doğrudan açılabilir. 2. hafta ve sonrasındaki
 * başlangıç talepleri otomatik doğrulanmaz; eğitmen veya platform yöneticisi
 * inceleyip onaylayana kadar içerik ve rozet hakkı oluşturulmaz.
 * ---------------------------------------------------------------------------
 */
import {z} from "zod";

import {decideApplication} from "@/lib/applications/policy";
import {fail, handle, ok, readJson} from "@/lib/api";
import {requireViewer} from "@/lib/auth/guards";
import {getCampBySlug} from "@/lib/content/access";
import {db} from "@/lib/db";

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
        `Bu kamp ${camp.weekCount} haftalık. ${declaredWeek}. hafta başlangıç olarak seçilemez.`,
        400,
        "WEEK_OUT_OF_RANGE",
      );
    }

    const decision = decideApplication(
      declaredWeek,
      camp.firstWeekRequiresApproval,
    );

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
    }

    const result = await db.$transaction(async (tx) => {
      const application = existing
        ? await tx.application.update({
            where: {id: existing.id},
            data: {
              declaredWeek,
              nickname: nickname ?? null,
              note: note ?? null,
              status: decision.status,
              reviewedBy: null,
              reviewedAt: null,
              reviewNote: null,
            },
          })
        : await tx.application.create({
            data: {
              address: viewer.address!,
              campId: camp.id,
              declaredWeek,
              nickname: nickname ?? null,
              note: note ?? null,
              status: decision.status,
            },
          });

      if (decision.completionWeeks.length > 0) {
        await tx.weeklyCompletion.createMany({
          data: decision.completionWeeks.map((weekNumber) => ({
            address: viewer.address!,
            campId: camp.id,
            weekNumber,
            source: "join",
            createdBy: null,
          })),
          skipDuplicates: true,
        });
      }

      return {
        application,
        autoApproved: !decision.requiresReview,
        resubmitted: Boolean(existing),
      };
    });

    return existing ? ok(result) : ok(result, {status: 201});
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
