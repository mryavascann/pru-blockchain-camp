/**
 * /admin/basvurular — Başvuru onay kuyruğu
 *
 * Veri sunucuda okunur, karar verme istemci bileşeninde.
 */
import {db} from "@/lib/db";
import {isAdminViewer} from "@/lib/auth/adminPage";
import {ApplicationQueue} from "./ApplicationQueue";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  /* ⚠️ VERİ ÇEKMEDEN ÖNCE — bkz. lib/auth/adminPage.ts */
  if (!(await isAdminViewer())) return null;

  const applications = await db.application.findMany({
    orderBy: [{status: "asc"}, {createdAt: "asc"}],
    include: {
      camp: {select: {id: true, slug: true, name: true, weekCount: true}},
    },
  });

  const grouped = await db.application.groupBy({by: ["status"], _count: true});
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));

  return (
    <ApplicationQueue
      counts={counts}
      applications={applications.map((application) => ({
        id: application.id,
        address: application.address,
        declaredWeek: application.declaredWeek,
        nickname: application.nickname,
        note: application.note,
        status: application.status,
        reviewNote: application.reviewNote,
        // Date nesnesi istemci bileşenine serileştirilerek geçer
        createdAt: application.createdAt.toISOString(),
        camp: application.camp,
      }))}
    />
  );
}
