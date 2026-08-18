import {notFound} from "next/navigation";

import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";
import {CampStudio} from "./CampStudio";

export const dynamic = "force-dynamic";

type Props = {params: Promise<{campId: string}>};

export default async function CampStudioPage({params}: Props) {
  const campId = Number((await params).campId);
  if (!Number.isInteger(campId) || campId < 1) notFound();

  try {
    await requireCampAccess(campId, "view");
  } catch {
    notFound();
  }

  const camp = await db.camp.findUnique({
    where: {id: campId},
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      instructorName: true,
      weekCount: true,
      publicWeekNumber: true,
      lifecycle: true,
      chainCampId: true,
      startDate: true,
      coverAssetId: true,
      reviewNote: true,
      weeks: {
        orderBy: {weekNumber: "asc"},
        select: {
          weekNumber: true,
          title: true,
          stage: true,
          teaser: true,
          editorBody: true,
          resources: true,
          status: true,
          publishDate: true,
          imageAssetId: true,
        },
      },
      _count: {select: {applications: true}},
    },
  });
  if (!camp) notFound();

  return (
    <CampStudio
      camp={{
        ...camp,
        startDate: camp.startDate?.toISOString().slice(0, 10) ?? null,
        weeks: camp.weeks.map((week) => ({
          ...week,
          publishDate: week.publishDate?.toISOString().slice(0, 10) ?? null,
          resources: parseResources(week.resources),
        })),
      }}
    />
  );
}

function parseResources(value: unknown): {title: string; url: string}[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is {title: string; url: string} =>
      typeof item === "object" &&
      item !== null &&
      "title" in item &&
      typeof item.title === "string" &&
      "url" in item &&
      typeof item.url === "string",
  );
}
