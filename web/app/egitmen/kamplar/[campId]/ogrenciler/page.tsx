import {notFound} from "next/navigation";

import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";
import {StudentPortal} from "./StudentPortal";

export const dynamic = "force-dynamic";

type Props = {params: Promise<{campId: string}>};

export default async function StudentsPage({params}: Props) {
  const campId = Number((await params).campId);
  if (!Number.isInteger(campId) || campId < 1) notFound();

  try {
    await requireCampAccess(campId, "students");
  } catch {
    notFound();
  }

  const camp = await db.camp.findUnique({
    where: {id: campId},
    select: {
      id: true,
      name: true,
      slug: true,
      weekCount: true,
      lifecycle: true,
      chainCampId: true,
      applications: {
        orderBy: [{status: "asc"}, {createdAt: "asc"}],
        select: {
          id: true,
          address: true,
          nickname: true,
          declaredWeek: true,
          note: true,
          status: true,
          reviewNote: true,
          createdAt: true,
        },
      },
    },
  });
  if (!camp) notFound();

  const addresses = camp.applications.map((application) => application.address);
  const [participants, completions, noteCounts] = await Promise.all([
    db.participant.findMany({
      where: {address: {in: addresses}},
      select: {address: true, university: true, referralSource: true},
    }),
    db.weeklyCompletion.findMany({
      where: {campId, address: {in: addresses}},
      select: {address: true, weekNumber: true},
      orderBy: {weekNumber: "asc"},
    }),
    db.weekNote.groupBy({
      by: ["address"],
      where: {campId, address: {in: addresses}, status: "VISIBLE"},
      _count: true,
    }),
  ]);

  const participantByAddress = new Map(participants.map((entry) => [entry.address, entry]));
  const weeksByAddress = new Map<string, number[]>();
  for (const completion of completions) {
    const weeks = weeksByAddress.get(completion.address) ?? [];
    weeks.push(completion.weekNumber);
    weeksByAddress.set(completion.address, weeks);
  }
  const notesByAddress = new Map(noteCounts.map((entry) => [entry.address, entry._count]));

  return (
    <StudentPortal
      camp={{
        id: camp.id,
        name: camp.name,
        slug: camp.slug,
        weekCount: camp.weekCount,
        lifecycle: camp.lifecycle,
        chainCampId: camp.chainCampId,
      }}
      students={camp.applications.map((application) => ({
        ...application,
        createdAt: application.createdAt.toISOString(),
        university: participantByAddress.get(application.address)?.university ?? null,
        referralSource: participantByAddress.get(application.address)?.referralSource ?? null,
        completedWeeks: weeksByAddress.get(application.address) ?? [],
        noteCount: notesByAddress.get(application.address) ?? 0,
      }))}
    />
  );
}

