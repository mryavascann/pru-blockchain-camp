/**
 * /admin/ilerleme — Haftalık ilerleme
 *
 * "Bu hafta bitti, şunlar tamamladı" dediğin yer. Kampın haftadan haftaya
 * ilerlemesi buradan yürür.
 *
 * NEDEN AYRI BİR SEKME: Başvuru onayı bir kereliktir (kişi kampa girerken);
 * bu ekran her hafta kullanılır. İkisini aynı sayfada toplamak, haftalık
 * rutini tek seferlik bir işin içine gömerdi.
 */
import {Card} from "@/components/ui/Card";
import {db} from "@/lib/db";
import {isAdminViewer} from "@/lib/auth/adminPage";
import {WeekProgress} from "./WeekProgress";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{kamp?: string; hafta?: string}>;
};

export default async function ProgressPage({searchParams}: Props) {
  /* ⚠️ VERİ ÇEKMEDEN ÖNCE — bkz. lib/auth/adminPage.ts */
  if (!(await isAdminViewer())) return null;

  const {kamp, hafta} = await searchParams;

  const camps = await db.camp.findMany({orderBy: {displayOrder: "asc"}});
  if (camps.length === 0) {
    return (
      <Card>
        <p className="text-sm text-fg-secondary">
          Henüz kamp yok. <code>npm run db:seed</code> çalıştır.
        </p>
      </Card>
    );
  }

  const camp =
    camps.find((c) => c.slug === kamp || String(c.id) === kamp) ?? camps[0];

  /* Varsayılan hafta: kampın şu an ulaştığı en yüksek hafta + 1 */
  const maxCompleted = await db.weeklyCompletion.aggregate({
    where: {campId: camp.id},
    _max: {weekNumber: true},
  });
  const suggestedWeek = Math.min(
    (maxCompleted._max.weekNumber ?? 0) + 1,
    camp.weekCount,
  );

  const parsedWeek = hafta ? Number(hafta) : NaN;
  const weekNumber =
    Number.isInteger(parsedWeek) && parsedWeek >= 1 && parsedWeek <= camp.weekCount
      ? parsedWeek
      : Math.max(suggestedWeek, 1);

  /*
   * Bu kampın katılımcıları = onaylı başvurusu olanlar.
   * Onaysız başvurular listede yok; onlar "Başvurular" sekmesinin işi.
   */
  const applications = await db.application.findMany({
    where: {campId: camp.id, status: "APPROVED"},
    orderBy: {createdAt: "asc"},
    select: {address: true, nickname: true, declaredWeek: true},
  });

  const addresses = applications.map((a) => a.address);

  const [thisWeek, notes, allCompletions] = await Promise.all([
    db.weeklyCompletion.findMany({
      where: {campId: camp.id, weekNumber, address: {in: addresses}},
      select: {address: true, source: true},
    }),
    db.weekNote.findMany({
      where: {campId: camp.id, address: {in: addresses}},
      select: {address: true, weekNumber: true},
      distinct: ["address", "weekNumber"],
    }),
    db.weeklyCompletion.groupBy({
      by: ["address"],
      where: {campId: camp.id, address: {in: addresses}},
      _max: {weekNumber: true},
    }),
  ]);

  const doneSet = new Set(thisWeek.map((c) => c.address));
  const entitledByAddress = new Map(
    allCompletions.map((c) => [c.address, c._max.weekNumber ?? 0]),
  );

  /** address -> not yazdığı haftalar */
  const notesByAddress = new Map<string, Set<number>>();
  for (const note of notes) {
    const set = notesByAddress.get(note.address) ?? new Set<number>();
    set.add(note.weekNumber);
    notesByAddress.set(note.address, set);
  }

  const participants = applications.map((application) => {
    const entitled = entitledByAddress.get(application.address) ?? 0;
    const noted = notesByAddress.get(application.address) ?? new Set<number>();

    /* Not borcu: giriş haftasından hak edilene kadar, notu olmayanlar */
    const owed: number[] = [];
    for (let week = application.declaredWeek; week <= entitled; week++) {
      if (!noted.has(week)) owed.push(week);
    }

    return {
      address: application.address,
      nickname: application.nickname,
      declaredWeek: application.declaredWeek,
      entitledWeek: entitled,
      markedThisWeek: doneSet.has(application.address),
      hasNoteThisWeek: noted.has(weekNumber),
      owedWeeks: owed,
    };
  });

  return (
    <WeekProgress
      camps={camps.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        weekCount: c.weekCount,
      }))}
      camp={{
        id: camp.id,
        slug: camp.slug,
        name: camp.name,
        weekCount: camp.weekCount,
      }}
      weekNumber={weekNumber}
      participants={participants}
    />
  );
}
