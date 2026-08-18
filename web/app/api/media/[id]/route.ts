import {getViewer} from "@/lib/auth/guards";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = {params: Promise<{id: string}>};

export async function GET(_request: Request, {params}: Context) {
  const {id} = await params;
  const metadata = await db.mediaAsset.findUnique({
    where: {id},
    select: {
      campId: true,
      mimeType: true,
      fileName: true,
      sha256: true,
      camp: {
        select: {
          lifecycle: true,
          ownerAddress: true,
          members: {select: {address: true}},
        },
      },
    },
  });
  if (!metadata) return new Response("Görsel bulunamadı.", {status: 404});

  const isPublic = metadata.camp.lifecycle === "PUBLISHED";
  if (!isPublic) {
    const viewer = await getViewer();
    const allowed =
      viewer.isAdmin ||
      (viewer.address !== null &&
        (metadata.camp.ownerAddress === viewer.address ||
          metadata.camp.members.some((member) => member.address === viewer.address)));
    if (!allowed) return new Response("Bu görsele erişim yetkin yok.", {status: 403});
  }

  const asset = await db.mediaAsset.findUnique({
    where: {id},
    select: {data: true},
  });
  if (!asset) return new Response("Görsel bulunamadı.", {status: 404});

  return new Response(asset.data, {
    headers: {
      "Content-Type": metadata.mimeType,
      "Content-Disposition": `inline; filename="${metadata.fileName.replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": isPublic
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
      ETag: `"${metadata.sha256}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

