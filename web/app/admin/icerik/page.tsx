/**
 * /admin/icerik — Hafta içerikleri, özetler, senkron
 */
import {db} from "@/lib/db";
import {isAdminViewer} from "@/lib/auth/adminPage";
import {ContentManager} from "./ContentManager";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  /* ⚠️ VERİ ÇEKMEDEN ÖNCE — bkz. lib/auth/adminPage.ts */
  if (!(await isAdminViewer())) return null;

  const camps = await db.camp.findMany({
    orderBy: {displayOrder: "asc"},
    include: {
      weeks: {
        orderBy: {weekNumber: "asc"},
        select: {
          weekNumber: true,
          title: true,
          teaser: true,
          teaserSuggestion: true,
          teaserSource: true,
          status: true,
          syncStatus: true,
          lastError: true,
          syncedAt: true,
          stage: true,
          notionBlockId: true,
          contentHtml: true,
          // `contentHtml` admin panelinde SALT OKUNUR önizleme olarak
          // gösteriliyor — düzenleme Notion'da yapılıyor. Yönetici zaten
          // içeriği görme yetkisine sahip, sızıntı söz konusu değil.
        },
      },
    },
  });

  return (
    <ContentManager
      camps={camps.map((camp) => ({
        id: camp.id,
        slug: camp.slug,
        name: camp.name,
        weekCount: camp.weekCount,
        publicWeekNumber: camp.publicWeekNumber,
        notionSourceId: camp.notionSourceId,
        weeks: camp.weeks.map((week) => ({
          ...week,
          syncedAt: week.syncedAt?.toISOString() ?? null,
        })),
      }))}
    />
  );
}
