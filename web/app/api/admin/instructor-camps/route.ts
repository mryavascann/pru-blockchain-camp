import {z} from "zod";

import {fail, handle, ok, readJson} from "@/lib/api";
import {requireAdmin} from "@/lib/auth/guards";
import {readAllCamps} from "@/lib/chain/client";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  campId: z.number().int().positive(),
  action: z.enum(["publish", "request-revision", "archive"]),
  chainCampId: z.number().int().positive().optional(),
  reviewNote: z.string().trim().max(800).optional(),
});

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const parsed = schema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("İnceleme bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const input = parsed.data;
    const camp = await db.camp.findUnique({
      where: {id: input.campId},
      select: {
        id: true,
        name: true,
        weekCount: true,
        lifecycle: true,
        ownerAddress: true,
      },
    });
    if (!camp || !camp.ownerAddress) {
      return fail("Eğitmen kampı bulunamadı.", 404, "CAMP_NOT_FOUND");
    }

    if (input.action === "request-revision") {
      if (!input.reviewNote) {
        return fail("Revizyon için eğitmene kısa bir not bırak.", 400, "NOTE_REQUIRED");
      }
      const updated = await db.camp.update({
        where: {id: camp.id},
        data: {lifecycle: "DRAFT", active: false, reviewNote: input.reviewNote},
        select: {id: true, lifecycle: true, reviewNote: true},
      });
      return ok({camp: updated});
    }

    if (input.action === "archive") {
      const updated = await db.camp.update({
        where: {id: camp.id},
        data: {lifecycle: "ARCHIVED", active: false, reviewNote: input.reviewNote || null},
        select: {id: true, lifecycle: true},
      });
      return ok({camp: updated});
    }

    if (camp.lifecycle !== "REVIEW") {
      return fail("Yalnızca incelemedeki kamp yayınlanabilir.", 409, "INVALID_STATE");
    }
    const onChainCamps = await readAllCamps();
    const linked = await db.camp.findMany({
      where: {chainCampId: {not: null}},
      select: {chainCampId: true},
    });
    const linkedIds = new Set(linked.map((entry) => entry.chainCampId));
    const candidates = onChainCamps.filter(
      (entry) =>
        !linkedIds.has(entry.campId) &&
        entry.name.trim() === camp.name.trim() &&
        entry.weekCount === camp.weekCount,
    );
    const resolvedChainId = input.chainCampId ?? (candidates.length === 1 ? candidates[0].campId : null);
    if (!resolvedChainId) {
      return fail(
        "Zincirde bu ad ve hafta sayısıyla eşleşen tek bir boş kamp bulunamadı. Önce kampı kontratta oluştur veya zincir kimliğini gir.",
        409,
        "CHAIN_CAMP_AMBIGUOUS",
      );
    }

    const onChain = onChainCamps.find((entry) => entry.campId === resolvedChainId);
    if (!onChain) {
      return fail("Bu zincir kimliğinde kamp bulunamadı.", 404, "CHAIN_CAMP_NOT_FOUND");
    }
    if (onChain.weekCount !== camp.weekCount) {
      return fail(
        `Hafta sayısı eşleşmiyor: zincir ${onChain.weekCount}, panel ${camp.weekCount}.`,
        409,
        "WEEK_COUNT_MISMATCH",
      );
    }
    if (onChain.name.trim() !== camp.name.trim()) {
      return fail(
        `Kamp adı eşleşmiyor: zincirde “${onChain.name}”, panelde “${camp.name}”.`,
        409,
        "NAME_MISMATCH",
      );
    }

    try {
      const updated = await db.camp.update({
        where: {id: camp.id},
        data: {
          chainCampId: resolvedChainId,
          lifecycle: "PUBLISHED",
          active: onChain.active,
          reviewNote: null,
        },
        select: {id: true, slug: true, chainCampId: true, lifecycle: true},
      });
      return ok({camp: updated});
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        return fail("Bu zincir kamp kimliği başka bir kampta kullanılıyor.", 409, "CHAIN_ID_TAKEN");
      }
      throw error;
    }
  });
}
