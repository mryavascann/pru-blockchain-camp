import {InstructorDashboard} from "./InstructorDashboard";

import {getViewer} from "@/lib/auth/guards";
import {managedCampWhere} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function InstructorPage() {
  const viewer = await getViewer();
  if (!viewer.address) return null;

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
      lifecycle: true,
      chainCampId: true,
      coverAssetId: true,
      reviewNote: true,
      updatedAt: true,
      _count: {select: {applications: true}},
    },
  });

  return (
    <InstructorDashboard
      camps={camps.map((camp) => ({...camp, updatedAt: camp.updatedAt.toISOString()}))}
    />
  );
}

