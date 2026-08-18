/**
 * /admin/notlar — Not denetimi
 *
 * Not defteri, sitedeki TEK kullanıcı üretimi içerik alanı. Yanlış bilgi,
 * spam ya da "zorunlu diye doldurulmuş" boş notlar gelebilir; yönetimin
 * görebilmesi ve gerekirse gizleyebilmesi gerekiyor.
 *
 * Ayrıca burada bir SAĞLIK GÖSTERGESİ var: hangi haftalarda hiç not yok.
 * Notion'daki defterin boş kalması fark edilmemişti; burada fark edilir.
 */
import Link from "next/link";

import {Card} from "@/components/ui/Card";
import {db} from "@/lib/db";
import {isAdminViewer} from "@/lib/auth/adminPage";
import {listAllNotesForAdmin} from "@/lib/notes/service";
import {NoteModeration} from "./NoteModeration";

export const dynamic = "force-dynamic";

export default async function AdminNotesPage() {
  /* ⚠️ VERİ ÇEKMEDEN ÖNCE — bkz. lib/auth/adminPage.ts */
  if (!(await isAdminViewer())) return null;

  const [notes, camps, byWeek, authors] = await Promise.all([
    listAllNotesForAdmin(),
    db.camp.findMany({orderBy: {displayOrder: "asc"}}),
    db.weekNote.groupBy({
      by: ["campId", "weekNumber"],
      where: {status: "VISIBLE"},
      _count: true,
    }),
    db.weekNote.findMany({
      where: {status: "VISIBLE"},
      select: {address: true},
      distinct: ["address"],
    }),
  ]);

  const countKey = (campId: number, week: number) => `${campId}:${week}`;
  const counts = new Map(
    byWeek.map((row) => [countKey(row.campId, row.weekNumber), row._count]),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Sayaçlar ---------------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Toplam not" value={notes.length} />
        <Stat
          label="Not bırakan kişi"
          value={authors.length}
        />
        <Stat
          label="Gizlenmiş not"
          value={notes.filter((n) => n.status === "HIDDEN").length}
        />
      </div>

      {/* ---------------- Hafta doluluk haritası ---------------- */}
      <Card>
        <h2 className="text-lg font-bold tracking-tight">
          Hangi haftada kaç not var
        </h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Boş haftalar, defterin o noktada işlemediğini gösterir. Notion&apos;daki
          önceki defter tamamen boş kalmıştı ve bu kimsenin gözüne çarpmamıştı.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {camps.map((camp) => (
            <div key={camp.id}>
              <p className="mb-2 text-sm font-semibold">{camp.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({length: camp.weekCount}, (_, i) => i + 1).map(
                  (week) => {
                    const count = counts.get(countKey(camp.id, week)) ?? 0;
                    return (
                      <Link
                        key={week}
                        href={`/kamplar/${camp.slug}/notlar?hafta=${week}`}
                        title={`${week}. hafta — ${count} not`}
                        className={[
                          "grid h-9 w-9 place-items-center rounded-md border text-xs font-semibold tabular-nums transition-colors",
                          count === 0
                            ? "border-dashed border-line text-fg-muted"
                            : count < 3
                              ? "border-line-accent text-accent-text"
                              : "border-reward text-reward",
                        ].join(" ")}
                      >
                        {count === 0 ? week : count}
                      </Link>
                    );
                  },
                )}
              </div>
              <p className="mt-1.5 text-xs text-fg-muted">
                Kesikli çerçeve = hiç not yok (kutudaki sayı hafta numarası).
                Dolu çerçeve = o haftadaki not sayısı.
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------------- Notlar ---------------- */}
      <NoteModeration
        notes={notes.map((note) => ({
          id: note.id,
          campName: note.camp.name,
          campSlug: note.camp.slug,
          weekNumber: note.weekNumber,
          kind: note.kind,
          title: note.title,
          body: note.body,
          sourceUrl: note.sourceUrl,
          aiAssisted: note.aiAssisted,
          authorNickname: note.authorNickname,
          address: note.address,
          status: note.status,
          createdAt: note.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

function Stat({label, value}: {label: string; value: number}) {
  return (
    <Card className="!p-4">
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-fg-secondary">{label}</p>
    </Card>
  );
}
