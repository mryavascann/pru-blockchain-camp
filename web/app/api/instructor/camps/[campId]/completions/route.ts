import {z} from "zod";

import {fail, handle, ok, readJson} from "@/lib/api";
import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = {params: Promise<{campId: string}>};

const schema = z.object({
  weekNumber: z.number().int().min(1),
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).min(1).max(500),
});

async function context(request: Request, route: Context) {
  const campId = Number((await route.params).campId);
  if (!Number.isInteger(campId) || campId < 1) {
    return {ok: false, response: fail("Geçersiz kamp kimliği.", 400, "INVALID_CAMP_ID")} as const;
  }

  const access = await requireCampAccess(campId, "students");
  const parsed = schema.safeParse(await readJson<unknown>(request));
  if (!parsed.success) {
    return {ok: false, response: fail("İlerleme bilgileri hatalı.", 400, "VALIDATION_ERROR")} as const;
  }

  const camp = await db.camp.findUnique({
    where: {id: campId},
    select: {weekCount: true},
  });
  if (!camp) return {ok: false, response: fail("Kamp bulunamadı.", 404, "NOT_FOUND")} as const;
  if (parsed.data.weekNumber > camp.weekCount) {
    return {ok: false, response: fail("Hafta kamp aralığının dışında.", 400, "WEEK_OUT_OF_RANGE")} as const;
  }

  return {ok: true, campId, access, data: parsed.data} as const;
}

export async function POST(request: Request, route: Context) {
  return handle(async () => {
    const resolved = await context(request, route);
    if (!resolved.ok) return resolved.response;

    const addresses = resolved.data.addresses.map((address) => address.toLowerCase());
    const approved = await db.application.findMany({
      where: {campId: resolved.campId, status: "APPROVED", address: {in: addresses}},
      select: {address: true},
    });
    const approvedSet = new Set(approved.map((entry) => entry.address));
    const allowed = addresses.filter((address) => approvedSet.has(address));
    if (allowed.length === 0) {
      return fail("Seçilen öğrenciler arasında onaylı katılımcı yok.", 409, "NO_APPROVED_STUDENT");
    }

    const result = await db.weeklyCompletion.createMany({
      data: allowed.map((address) => ({
        address,
        campId: resolved.campId,
        weekNumber: resolved.data.weekNumber,
        source: "weekly",
        createdBy: resolved.access.viewer.address,
      })),
      skipDuplicates: true,
    });

    return ok({created: result.count, skipped: allowed.length - result.count});
  });
}

export async function DELETE(request: Request, route: Context) {
  return handle(async () => {
    const resolved = await context(request, route);
    if (!resolved.ok) return resolved.response;

    const result = await db.weeklyCompletion.deleteMany({
      where: {
        campId: resolved.campId,
        weekNumber: resolved.data.weekNumber,
        address: {in: resolved.data.addresses.map((address) => address.toLowerCase())},
      },
    });
    return ok({deleted: result.count});
  });
}
