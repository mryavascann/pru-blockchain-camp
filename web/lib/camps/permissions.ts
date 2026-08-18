import "server-only";

import {db} from "@/lib/db";
import {
  ForbiddenError,
  requireViewer,
  type Viewer,
} from "@/lib/auth/guards";
import type {CampMemberRole} from "@/lib/generated/prisma/enums";

export type CampCapability = "view" | "content" | "students" | "owner";

export type CampAccess = {
  viewer: Viewer & {address: string};
  role: CampMemberRole | "PLATFORM_ADMIN";
  isPlatformAdmin: boolean;
};

const ALLOWED: Record<CampCapability, readonly CampMemberRole[]> = {
  view: ["OWNER", "EDITOR", "REVIEWER"],
  content: ["OWNER", "EDITOR"],
  students: ["OWNER", "EDITOR", "REVIEWER"],
  owner: ["OWNER"],
};

/**
 * Kamp verisine en yakın güvenli yetki kapısı. Sayfadaki görünürlük kontrolleri
 * bunun yerine geçmez; her route handler mutasyondan önce bu fonksiyonu çağırır.
 */
export async function requireCampAccess(
  campId: number,
  capability: CampCapability = "view",
): Promise<CampAccess> {
  const viewer = await requireViewer();
  const address = viewer.address!;

  if (viewer.isAdmin) {
    return {
      viewer: {...viewer, address},
      role: "PLATFORM_ADMIN",
      isPlatformAdmin: true,
    };
  }

  const camp = await db.camp.findUnique({
    where: {id: campId},
    select: {
      ownerAddress: true,
      members: {
        where: {address},
        take: 1,
        select: {role: true},
      },
    },
  });

  if (!camp) {
    throw new ForbiddenError("Bu kampı yönetme yetkin yok.");
  }

  const role: CampMemberRole | null =
    camp.ownerAddress === address ? "OWNER" : (camp.members[0]?.role ?? null);

  if (!role || !ALLOWED[capability].includes(role)) {
    throw new ForbiddenError("Bu kamp üzerinde bu işlem için yetkin yok.");
  }

  return {
    viewer: {...viewer, address},
    role,
    isPlatformAdmin: false,
  };
}

/** Eğitmen panelindeki kamp listesi için güvenli sorgu koşulu. */
export function managedCampWhere(viewer: Viewer) {
  if (viewer.isAdmin) return {};
  if (!viewer.address) return {id: -1};

  return {
    OR: [
      {ownerAddress: viewer.address},
      {members: {some: {address: viewer.address}}},
    ],
  };
}

