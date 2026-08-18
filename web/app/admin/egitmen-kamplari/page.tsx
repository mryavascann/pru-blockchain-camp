import {isAdminViewer} from "@/lib/auth/adminPage";
import {readOwner} from "@/lib/chain/client";
import {contractAddress} from "@/lib/chain/config";
import {db} from "@/lib/db";
import {InstructorCampReview} from "./InstructorCampReview";

export const dynamic = "force-dynamic";

export default async function InstructorCampsAdminPage() {
  if (!(await isAdminViewer())) return null;

  const [camps, contractOwner] = await Promise.all([
    db.camp.findMany({
      where: {ownerAddress: {not: null}},
      orderBy: [{lifecycle: "asc"}, {updatedAt: "desc"}],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        instructorName: true,
        ownerAddress: true,
        weekCount: true,
        lifecycle: true,
        chainCampId: true,
        coverAssetId: true,
        reviewNote: true,
        updatedAt: true,
        weeks: {
          orderBy: {weekNumber: "asc"},
          select: {
            weekNumber: true,
            title: true,
            status: true,
            imageAssetId: true,
            editorBody: true,
          },
        },
        _count: {select: {applications: true}},
      },
    }),
    readOwner().catch(() => null),
  ]);

  return (
    <InstructorCampReview
      camps={camps.map((camp) => ({...camp, updatedAt: camp.updatedAt.toISOString()}))}
      contractOwner={contractOwner?.toLowerCase() ?? null}
      contractAddress={contractAddress}
    />
  );
}

