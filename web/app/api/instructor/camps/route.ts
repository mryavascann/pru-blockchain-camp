import {z} from "zod";

import {fail, handle, ok, readJson} from "@/lib/api";
import {requireViewer} from "@/lib/auth/guards";
import {normalizeCampSlug} from "@/lib/camps/content";
import {managedCampWhere} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z.string().trim().min(3).max(60).optional(),
  description: z.string().trim().min(20).max(1200),
  instructorName: z.string().trim().min(2).max(80),
  weekCount: z.number().int().min(1).max(52),
  firstWeekRequiresApproval: z.boolean().optional(),
  startDate: z.string().date().nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    const viewer = await requireViewer();
    const camps = await db.camp.findMany({
      where: managedCampWhere(viewer),
      orderBy: [{updatedAt: "desc"}],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        instructorName: true,
        weekCount: true,
        firstWeekRequiresApproval: true,
        lifecycle: true,
        chainCampId: true,
        coverAssetId: true,
        updatedAt: true,
        _count: {select: {applications: true}},
      },
    });

    return ok({camps});
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer();
    const parsed = createSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail(
        "Kamp bilgileri eksik veya hatalı. Açıklama en az 20 karakter olmalı.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const data = parsed.data;
    const slug = normalizeCampSlug(data.slug || data.name);
    if (slug.length < 3) {
      return fail("Kamp için en az 3 karakterli bir kısa adres yaz.", 400, "INVALID_SLUG");
    }

    const reserved = new Set(["yeni", "admin", "api", "profil", "egitmen"]);
    if (reserved.has(slug)) {
      return fail("Bu kısa adres sistem tarafından ayrılmış.", 409, "SLUG_RESERVED");
    }

    const exists = await db.camp.findUnique({where: {slug}, select: {id: true}});
    if (exists) {
      return fail("Bu kamp kısa adresi zaten kullanılıyor.", 409, "SLUG_TAKEN");
    }

    if (!viewer.isAdmin) {
      const ownedCount = await db.camp.count({where: {ownerAddress: viewer.address!}});
      if (ownedCount >= 5) {
        return fail(
          "Bir cüzdan en fazla 5 kamp taslağı açabilir. Yeni kamp için mevcut taslaklarından birini tamamla.",
          429,
          "CAMP_LIMIT",
        );
      }
    }

    const lastOrder = await db.camp.aggregate({_max: {displayOrder: true}});
    const camp = await db.camp.create({
      data: {
        slug,
        name: data.name,
        description: data.description,
        instructorName: data.instructorName,
        weekCount: data.weekCount,
        firstWeekRequiresApproval: data.firstWeekRequiresApproval ?? false,
        startDate: data.startDate ? new Date(`${data.startDate}T00:00:00.000Z`) : null,
        active: false,
        lifecycle: "DRAFT",
        ownerAddress: viewer.address!,
        displayOrder: (lastOrder._max.displayOrder ?? 0) + 10,
        members: {
          create: {
            address: viewer.address!,
            role: "OWNER",
            addedBy: viewer.address!,
          },
        },
        weeks: {
          create: Array.from({length: data.weekCount}, (_, index) => ({
            weekNumber: index + 1,
            title: `${index + 1}. Hafta`,
            teaser: "",
            editorBody: "",
            contentHtml: null,
            contentSource: "EDITOR" as const,
            status: "DRAFT" as const,
          })),
        },
      },
      select: {id: true, slug: true, lifecycle: true},
    });

    return ok({camp}, {status: 201});
  });
}
