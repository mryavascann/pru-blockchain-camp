/**
 * /api/admin/applications — Başvuru inceleme kuyruğu
 *
 *   GET   → Bekleyen (veya filtrelenmiş) başvurular
 *   PATCH → Onayla / reddet
 *
 * ---------------------------------------------------------------------------
 * ONAYIN ZİNCİRE UZANAN ETKİSİ
 *
 * Bir başvuru onaylandığında ŞU AN zincirde hiçbir şey olmaz. Bunun yerine
 * veritabanında 1..N haftası için `WeeklyCompletion` kayıtları açılır.
 *
 * Zincire çıkış üç adımlıdır ve son adım İNSAN ELİYLE atılır:
 *
 *   1. Admin başvuruyu onaylar     → WeeklyCompletion kayıtları (burası)
 *   2. Admin merkle ağacı üretir   → /api/admin/merkle
 *   3. Admin kökü zincire yazar    → kendi cüzdanıyla, forge script veya
 *                                     admin panelindeki işlem butonuyla
 *
 * Backend'in private key'i olmadığı için 3. adımı otomatikleştirmiyoruz.
 * Sunucu ele geçirilse bile saldırgan kendine rozet yazdıramaz.
 * ---------------------------------------------------------------------------
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireAdmin} from "@/lib/auth/guards";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                                  LİSTE                                     */
/* -------------------------------------------------------------------------- */

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const status = new URL(request.url).searchParams.get("status");
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;

    const where =
      status && (validStatuses as readonly string[]).includes(status)
        ? {status: status as (typeof validStatuses)[number]}
        : {};

    const applications = await db.application.findMany({
      where,
      orderBy: [{status: "asc"}, {createdAt: "asc"}],
      include: {
        camp: {select: {id: true, slug: true, name: true, weekCount: true}},
      },
    });

    const counts = await db.application.groupBy({
      by: ["status"],
      _count: true,
    });

    return ok({
      applications,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    });
  });
}

/* -------------------------------------------------------------------------- */
/*                              ONAYLA / REDDET                               */
/* -------------------------------------------------------------------------- */

const reviewSchema = z.object({
  applicationId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  /**
   * Adminin düzelttiği hafta. Katılımcı "5. haftadayım" demiş ama admin
   * 3 olduğunu biliyorsa buradan düzeltir — beyan bağlayıcı değildir.
   */
  approvedWeek: z.number().int().min(1).optional(),
  reviewNote: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  return handle(async () => {
    const admin = await requireAdmin();

    const parsed = reviewSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("İnceleme bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const {applicationId, action, approvedWeek, reviewNote} = parsed.data;

    const application = await db.application.findUnique({
      where: {id: applicationId},
      include: {camp: {select: {id: true, name: true, weekCount: true}}},
    });

    if (!application) {
      return fail("Başvuru bulunamadı.", 404, "NOT_FOUND");
    }

    if (application.status !== "PENDING") {
      return fail(
        `Bu başvuru zaten ${
          application.status === "APPROVED" ? "onaylanmış" : "reddedilmiş"
        }.`,
        409,
        "ALREADY_REVIEWED",
      );
    }

    /* ---- REDDET ---- */
    if (action === "reject") {
      const updated = await db.$transaction(async (tx) => {
        const claimed = await tx.application.updateMany({
          where: {id: applicationId, status: "PENDING"},
          data: {
            status: "REJECTED",
            reviewedBy: admin.address!,
            reviewedAt: new Date(),
            reviewNote: reviewNote ?? null,
          },
        });

        if (claimed.count !== 1) return null;
        return tx.application.findUnique({where: {id: applicationId}});
      });

      if (!updated) {
        return fail("Bu başvuru daha önce incelenmiş.", 409, "ALREADY_REVIEWED");
      }
      return ok({application: updated, completionsCreated: 0});
    }

    /* ---- ONAYLA ---- */
    const week = approvedWeek ?? application.declaredWeek;

    if (week > application.camp.weekCount) {
      return fail(
        `"${application.camp.name}" ${application.camp.weekCount} haftalık. ` +
          `${week}. hafta onaylanamaz.`,
        400,
        "WEEK_OUT_OF_RANGE",
      );
    }

    /*
     * GERİ DOLDURMA: 1..week arası TÜM haftalar için tamamlama kaydı.
     * "3. haftadan başlayan katılımcı 1. ve 2. hafta rozetlerini de alır"
     * şartının uygulandığı yer.
     */
    const rows = Array.from({length: week}, (_, index) => ({
      address: application.address.toLowerCase(),
      campId: application.campId,
      weekNumber: index + 1,
      source: "backfill",
      createdBy: admin.address!,
    }));

    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.application.updateMany({
        where: {id: applicationId, status: "PENDING"},
        data: {
          status: "APPROVED",
          declaredWeek: week, // adminin düzelttiği değer kaydedilir
          reviewedBy: admin.address!,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
        },
      });

      if (claimed.count !== 1) return null;

      const completions = await tx.weeklyCompletion.createMany({
        data: rows,
        skipDuplicates: true,
      });
      const updated = await tx.application.findUnique({
        where: {id: applicationId},
      });

      return {updated, completionsCreated: completions.count};
    });

    if (!result?.updated) {
      return fail("Bu başvuru daha önce incelenmiş.", 409, "ALREADY_REVIEWED");
    }

    return ok({
      application: result.updated,
      completionsCreated: result.completionsCreated,
      /** Sonraki adımın hatırlatması — admin panelinde gösterilecek */
      nextStep:
        `1..${week}. haftalar için merkle ağaçlarını yeniden üret ` +
        `(/api/admin/merkle), sonra kökleri zincire yaz.`,
    });
  });
}
