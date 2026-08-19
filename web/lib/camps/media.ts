import {createHash} from "node:crypto";

import sharp from "sharp";

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_CAMP_MEDIA_BYTES = 150 * 1024 * 1024;
export const MAX_MEDIA_PIXELS = 16_777_216;

const MIME_BY_FORMAT: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Dosyayı yalnızca sihirli baytlarla değil, gerçek bir görsel decoder'ıyla
 * açar. Böylece PNG başlığı eklenmiş bozuk veya yarım dosyalar depoya
 * giremez. Piksel sınırı da sıkıştırma bombalarını engeller.
 */
export async function inspectRasterImage(bytes: Uint8Array): Promise<{
  mimeType: string;
  sha256: string;
  width: number;
  height: number;
} | null> {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_MEDIA_BYTES) return null;

  try {
    const input = Buffer.from(bytes);
    const image = sharp(input, {
      animated: false,
      failOn: "warning",
      limitInputPixels: MAX_MEDIA_PIXELS,
    });
    const metadata = await image.metadata();
    const mimeType = metadata.format ? MIME_BY_FORMAT[metadata.format] : undefined;
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (
      !mimeType ||
      width < 1 ||
      height < 1 ||
      width * height > MAX_MEDIA_PIXELS
    ) {
      return null;
    }

    // Metadata okumak tek başına kesik dosyayı her formatta yakalamaz.
    // Bir kareyi tamamen decode ederek dosyanın gerçekten açılabildiğini kanıtla.
    await image.toBuffer();

    return {
      mimeType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width,
      height,
    };
  } catch {
    return null;
  }
}
