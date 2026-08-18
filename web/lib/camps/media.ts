import {createHash} from "node:crypto";

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

const MIME_BY_MAGIC = [
  {
    mime: "image/png",
    matches: (b: Uint8Array) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/jpeg",
    matches: (b: Uint8Array) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/gif",
    matches: (b: Uint8Array) => {
      const head = String.fromCharCode(...b.slice(0, 6));
      return head === "GIF87a" || head === "GIF89a";
    },
  },
  {
    mime: "image/webp",
    matches: (b: Uint8Array) =>
      b.length >= 12 &&
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
] as const;

export function inspectRasterImage(bytes: Uint8Array): {
  mimeType: string;
  sha256: string;
} | null {
  const match = MIME_BY_MAGIC.find((entry) => entry.matches(bytes));
  if (!match) return null;

  return {
    mimeType: match.mime,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

