import {z} from "zod";

import {fail, handle, ok, readJson} from "@/lib/api";
import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = {params: Promise<{campId: string}>};

const reviewSchema = z.object({
  applicationId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  approvedWeek: z.number().int().min(1).optional(),
  reviewNote: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request, {params}: Context) {
  return handle(async () => {
    const campId = Number((await params).campId);
    if (!Number.isInteger(campId) || campId < 1) {
      return fail("Geçersiz kamp kimliği.", 400, "INVALID_CAMP_ID");
    }

    const access = await requireCampAccess(campId, "students");
    const parsed = reviewSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("İnceleme bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const application = await db.application.findFirst({
      where: {id: parsed.data.applicationId, campId},
      include: {camp: {select: {name: true, weekCount: true}}},
    });
    if (!application) return fail("Başvuru bulunamadı.", 404, "NOT_FOUND");
    if (application.status !== "PENDING") {
      return fail("Bu başvuru daha önce incelenmiş.", 409, "ALREADY_REVIEWED");
    }

    if (parsed.data.action === "reject") {
      const updated = await db.$transaction(async (tx) => {
        const claimed = await tx.application.updateMany({
          where: {id: application.id, campId, status: "PENDING"},
          data: {
            status: "REJECTED",
            reviewedBy: access.viewer.address,
            reviewedAt: new Date(),
            reviewNote: parsed.data.reviewNote || null,
          },
        });

        if (claimed.count !== 1) return null;
        return tx.application.findUnique({where: {id: application.id}});
      });

      if (!updated) {
        return fail("Bu başvuru daha önce incelenmiş.", 409, "ALREADY_REVIEWED");
      }
      return ok({application: updated, completionsCreated: 0});
    }

    const week = parsed.data.approvedWeek ?? application.declaredWeek;
    if (week > application.camp.weekCount) {
      return fail(
        `Bu kamp ${application.camp.weekCount} haftalık; ${week}. hafta onaylanamaz.`,
        400,
        "WEEK_OUT_OF_RANGE",
      );
    }

    const rows = Array.from({length: week}, (_, index) => ({
      address: application.address.toLowerCase(),
      campId,
      weekNumber: index + 1,
      source: "backfill",
      createdBy: access.viewer.address,
    }));

    const result = await db.$transaction(async (tx) => {
      const claimed = await tx.application.updateMany({
        where: {id: application.id, campId, status: "PENDING"},
        data: {
          status: "APPROVED",
          declaredWeek: week,
          reviewedBy: access.viewer.address,
          reviewedAt: new Date(),
          reviewNote: parsed.data.reviewNote || null,
        },
      });

      if (claimed.count !== 1) return null;

      const completions = await tx.weeklyCompletion.createMany({
        data: rows,
        skipDuplicates: true,
      });
      const updated = await tx.application.findUnique({
        where: {id: application.id},
      });

      return {updated, completionsCreated: completions.count};
    });

    if (!result?.updated) {
      return fail("Bu başvuru daha önce incelenmiş.", 409, "ALREADY_REVIEWED");
    }

    return ok({
      application: result.updated,
      completionsCreated: result.completionsCreated,
    });
  });
}
