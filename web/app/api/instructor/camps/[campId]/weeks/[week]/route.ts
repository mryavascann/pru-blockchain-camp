import {z} from "zod";

import {fail, handle, ok, readJson} from "@/lib/api";
import {
  isSafeResourceUrl,
  renderInstructorContent,
} from "@/lib/camps/content";
import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = {params: Promise<{campId: string; week: string}>};

const resourceSchema = z.object({
  title: z.string().trim().min(2).max(120),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(isSafeResourceUrl, "Yalnızca http/https bağlantıları kabul edilir."),
});

const patchSchema = z.object({
  title: z.string().trim().min(3).max(120),
  stage: z.string().trim().max(100).nullable().optional(),
  teaser: z.string().trim().min(10).max(500),
  body: z.string().trim().min(20).max(30_000),
  resources: z.array(resourceSchema).max(20).default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  publishDate: z.string().date().nullable().optional(),
});

export async function PATCH(request: Request, {params}: Context) {
  return handle(async () => {
    const values = await params;
    const campId = Number(values.campId);
    const weekNumber = Number(values.week);
    if (
      !Number.isInteger(campId) ||
      campId < 1 ||
      !Number.isInteger(weekNumber) ||
      weekNumber < 1
    ) {
      return fail("Geçersiz kamp veya hafta kimliği.", 400, "INVALID_ID");
    }

    await requireCampAccess(campId, "content");
    const parsed = patchSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail(
        "Hafta bilgileri eksik. Açıklama en az 20, özet en az 10 karakter olmalı; kaynaklar http/https olmalı.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const camp = await db.camp.findUnique({
      where: {id: campId},
      select: {weekCount: true, lifecycle: true},
    });
    if (!camp) return fail("Kamp bulunamadı.", 404, "CAMP_NOT_FOUND");
    if (weekNumber > camp.weekCount) {
      return fail("Hafta kamp aralığının dışında.", 400, "WEEK_OUT_OF_RANGE");
    }
    if (camp.lifecycle === "REVIEW") {
      return fail("Kamp incelemedeyken içerik değiştirilemez.", 409, "CAMP_IN_REVIEW");
    }

    const data = parsed.data;
    const contentHtml = renderInstructorContent(data.body, data.resources);
    const week = await db.week.update({
      where: {campId_weekNumber: {campId, weekNumber}},
      data: {
        title: data.title,
        stage: data.stage || null,
        teaser: data.teaser,
        editorBody: data.body,
        resources: data.resources,
        contentHtml,
        contentSource: "EDITOR",
        status: data.status,
        publishDate:
          data.publishDate === undefined
            ? undefined
            : data.publishDate
              ? new Date(`${data.publishDate}T00:00:00.000Z`)
              : null,
        syncStatus: "OK",
        syncedAt: new Date(),
      },
      select: {
        weekNumber: true,
        title: true,
        teaser: true,
        editorBody: true,
        resources: true,
        status: true,
        stage: true,
        publishDate: true,
        imageAssetId: true,
      },
    });

    return ok({week});
  });
}

