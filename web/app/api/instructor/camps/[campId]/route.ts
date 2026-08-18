import {z} from "zod";

import {fail, handle, ok, readJson} from "@/lib/api";
import {normalizeCampSlug} from "@/lib/camps/content";
import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = {params: Promise<{campId: string}>};

const patchSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  slug: z.string().trim().min(3).max(60).optional(),
  description: z.string().trim().min(20).max(1200).optional(),
  instructorName: z.string().trim().min(2).max(80).optional(),
  startDate: z.string().date().nullable().optional(),
  weekCount: z.number().int().min(1).max(52).optional(),
  publicWeekNumber: z.number().int().min(1).nullable().optional(),
  action: z.enum(["submit-review", "reopen-draft"]).optional(),
});

export async function PATCH(request: Request, {params}: Context) {
  return handle(async () => {
    const campId = Number((await params).campId);
    if (!Number.isInteger(campId) || campId < 1) {
      return fail("Geçersiz kamp kimliği.", 400, "INVALID_CAMP_ID");
    }

    const access = await requireCampAccess(campId, "content");
    const parsed = patchSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("Kamp ayarları hatalı.", 400, "VALIDATION_ERROR");
    }

    const current = await db.camp.findUnique({
      where: {id: campId},
      select: {
        lifecycle: true,
        weekCount: true,
        slug: true,
        weeks: {
          orderBy: {weekNumber: "asc"},
          select: {
            weekNumber: true,
            title: true,
            teaser: true,
            editorBody: true,
            status: true,
            imageAssetId: true,
          },
        },
      },
    });
    if (!current) return fail("Kamp bulunamadı.", 404, "CAMP_NOT_FOUND");

    const data = parsed.data;

    if (data.action === "submit-review") {
      if (current.lifecycle !== "DRAFT") {
        return fail("Yalnızca taslak kamp incelemeye gönderilebilir.", 409, "INVALID_STATE");
      }

      const incomplete = current.weeks.filter(
        (week) =>
          week.status !== "PUBLISHED" ||
          week.title.trim().length < 3 ||
          !week.editorBody?.trim() ||
          !week.teaser.trim(),
      );
      if (incomplete.length > 0) {
        return fail(
          `Önce bütün haftaları içerik ve özetle yayına hazırla. Eksik: ${incomplete
            .map((week) => week.weekNumber)
            .join(", ")}. hafta.`,
          409,
          "INCOMPLETE_WEEKS",
        );
      }

      const missingArt = current.weeks
        .filter((week) => !week.imageAssetId)
        .map((week) => week.weekNumber);

      const camp = await db.camp.update({
        where: {id: campId},
        data: {lifecycle: "REVIEW"},
        select: {id: true, lifecycle: true},
      });
      return ok({camp, missingArt});
    }

    if (data.action === "reopen-draft") {
      if (current.lifecycle !== "REVIEW" || access.role !== "OWNER") {
        return fail("Bu kamp taslağa geri alınamaz.", 403, "FORBIDDEN");
      }
      const camp = await db.camp.update({
        where: {id: campId},
        data: {lifecycle: "DRAFT"},
        select: {id: true, lifecycle: true},
      });
      return ok({camp});
    }

    if (current.lifecycle === "REVIEW" && !access.isPlatformAdmin) {
      return fail(
        "Kamp incelemede. Düzenlemek için önce taslağa geri al.",
        409,
        "CAMP_IN_REVIEW",
      );
    }

    const identityChanged =
      data.name !== undefined || data.slug !== undefined || data.weekCount !== undefined;
    if (current.lifecycle === "PUBLISHED" && identityChanged && !access.isPlatformAdmin) {
      return fail(
        "Yayındaki kampın adı, adresi ve hafta sayısı zincirle eşleşmelidir. Bu alanları platform yöneticisi değiştirir.",
        409,
        "CHAIN_FIELDS_LOCKED",
      );
    }

    if (data.weekCount !== undefined && data.weekCount < current.weekCount) {
      return fail("Hafta sayısı azaltılamaz; rozet geçmişi korunmalı.", 409, "WEEK_COUNT_DECREASE");
    }

    const effectiveWeekCount = data.weekCount ?? current.weekCount;
    if (
      data.publicWeekNumber !== undefined &&
      data.publicWeekNumber !== null &&
      data.publicWeekNumber > effectiveWeekCount
    ) {
      return fail("Herkese açık hafta kamp aralığının dışında.", 400, "WEEK_OUT_OF_RANGE");
    }
    if (data.publicWeekNumber !== undefined && data.publicWeekNumber !== null) {
      const publicWeek = await db.week.findUnique({
        where: {campId_weekNumber: {campId, weekNumber: data.publicWeekNumber}},
        select: {status: true},
      });
      if (!publicWeek || publicWeek.status !== "PUBLISHED") {
        return fail("Örnek hafta önce yayına hazır olmalı.", 409, "PUBLIC_WEEK_NOT_READY");
      }
    }

    const slug = data.slug === undefined ? undefined : normalizeCampSlug(data.slug);
    if (slug !== undefined && slug.length < 3) {
      return fail("Kısa adres en az 3 karakter olmalı.", 400, "INVALID_SLUG");
    }

    try {
      const updated = await db.$transaction(async (tx) => {
        if (data.weekCount && data.weekCount > current.weekCount) {
          await tx.week.createMany({
            data: Array.from(
              {length: data.weekCount - current.weekCount},
              (_, index) => {
                const weekNumber = current.weekCount + index + 1;
                return {
                  campId,
                  weekNumber,
                  title: `${weekNumber}. Hafta`,
                  teaser: "",
                  editorBody: "",
                  contentSource: "EDITOR" as const,
                  status: "DRAFT" as const,
                };
              },
            ),
          });
        }

        return tx.camp.update({
          where: {id: campId},
          data: {
            ...(data.name !== undefined ? {name: data.name} : {}),
            ...(slug !== undefined ? {slug} : {}),
            ...(data.description !== undefined ? {description: data.description} : {}),
            ...(data.instructorName !== undefined ? {instructorName: data.instructorName} : {}),
            ...(data.weekCount !== undefined ? {weekCount: data.weekCount} : {}),
            ...(data.publicWeekNumber !== undefined
              ? {publicWeekNumber: data.publicWeekNumber}
              : {}),
            ...(data.startDate !== undefined
              ? {startDate: data.startDate ? new Date(`${data.startDate}T00:00:00.000Z`) : null}
              : {}),
          },
          select: {id: true, slug: true, lifecycle: true, weekCount: true},
        });
      });

      return ok({camp: updated});
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        return fail("Bu kısa kamp adresi zaten kullanılıyor.", 409, "SLUG_TAKEN");
      }
      throw error;
    }
  });
}
