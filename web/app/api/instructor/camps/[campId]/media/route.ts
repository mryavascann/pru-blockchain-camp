import {fail, handle, ok} from "@/lib/api";
import {
  MAX_CAMP_MEDIA_BYTES,
  MAX_MEDIA_BYTES,
  inspectRasterImage,
} from "@/lib/camps/media";
import {requireCampAccess} from "@/lib/camps/permissions";
import {db} from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = {params: Promise<{campId: string}>};
const MAX_UPLOAD_BODY_BYTES = MAX_MEDIA_BYTES + 1024 * 1024;

async function readUploadBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > MAX_UPLOAD_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: Request, {params}: Context) {
  return handle(async () => {
    const campId = Number((await params).campId);
    if (!Number.isInteger(campId) || campId < 1) {
      return fail("Geçersiz kamp kimliği.", 400, "INVALID_CAMP_ID");
    }

    const access = await requireCampAccess(campId, "content");
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BODY_BYTES) {
      return fail("Görsel en çok 5 MB olabilir.", 413, "FILE_TOO_LARGE");
    }

    const uploadBody = await readUploadBody(request);
    if (!uploadBody) {
      return fail("Görsel en çok 5 MB olabilir.", 413, "FILE_TOO_LARGE");
    }

    let form: FormData;
    try {
      form = await new Request(request.url, {
        method: request.method,
        headers: request.headers,
        // readUploadBody her zaman yeni, tam uzunlukta bir ArrayBuffer üretir.
        body: uploadBody.buffer as ArrayBuffer,
      }).formData();
    } catch {
      return fail("Yükleme formu okunamadı.", 400, "INVALID_FORM_DATA");
    }
    const file = form.get("file");
    const kind = form.get("kind");
    const weekNumber = Number(form.get("weekNumber"));

    if (!(file instanceof File) || (kind !== "CAMP_COVER" && kind !== "WEEK_ART")) {
      return fail("Görsel ve kullanım alanı belirtilmeli.", 400, "VALIDATION_ERROR");
    }
    if (file.size < 1 || file.size > MAX_MEDIA_BYTES) {
      return fail("Görsel en çok 5 MB olabilir.", 413, "FILE_TOO_LARGE");
    }

    if (kind === "WEEK_ART" && (!Number.isInteger(weekNumber) || weekNumber < 1)) {
      return fail("NFT görseli için hafta numarası gerekli.", 400, "INVALID_WEEK");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const inspected = await inspectRasterImage(bytes);
    if (!inspected) {
      return fail(
        "Yalnızca gerçek PNG, JPEG, WebP veya GIF dosyaları kabul edilir.",
        415,
        "UNSUPPORTED_MEDIA",
      );
    }

    const targetWeek =
      kind === "WEEK_ART"
        ? await db.week.findUnique({
            where: {campId_weekNumber: {campId, weekNumber}},
            select: {id: true, imageAssetId: true},
          })
        : null;
    if (kind === "WEEK_ART" && !targetWeek) {
      return fail("Hafta bulunamadı.", 404, "WEEK_NOT_FOUND");
    }

    const currentCover =
      kind === "CAMP_COVER"
        ? await db.camp.findUnique({where: {id: campId}, select: {coverAssetId: true}})
        : null;

    const previousId =
      kind === "CAMP_COVER" ? currentCover?.coverAssetId : targetWeek?.imageAssetId;
    const [usage, previous] = await Promise.all([
      db.mediaAsset.aggregate({where: {campId}, _sum: {byteSize: true}}),
      previousId
        ? db.mediaAsset.findUnique({where: {id: previousId}, select: {byteSize: true}})
        : null,
    ]);
    const projectedBytes =
      (usage._sum.byteSize ?? 0) - (previous?.byteSize ?? 0) + bytes.byteLength;
    if (projectedBytes > MAX_CAMP_MEDIA_BYTES) {
      return fail(
        "Bu kampın toplam görsel kotası doldu. Eski görselleri daha küçük dosyalarla değiştir.",
        413,
        "CAMP_MEDIA_QUOTA",
      );
    }

    const asset = await db.$transaction(async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          campId,
          ownerAddress: access.viewer.address,
          kind,
          fileName: file.name.slice(0, 180) || "artwork",
          mimeType: inspected.mimeType,
          byteSize: bytes.byteLength,
          sha256: inspected.sha256,
          data: bytes,
        },
        select: {id: true, mimeType: true, byteSize: true, sha256: true},
      });

      if (kind === "CAMP_COVER") {
        await tx.camp.update({where: {id: campId}, data: {coverAssetId: created.id}});
      } else {
        await tx.week.update({
          where: {id: targetWeek!.id},
          data: {imageAssetId: created.id},
        });
      }

      if (previousId && previousId !== created.id) {
        await tx.mediaAsset.delete({where: {id: previousId}});
      }

      return created;
    });

    return ok({asset, url: `/api/media/${asset.id}`}, {status: 201});
  });
}
