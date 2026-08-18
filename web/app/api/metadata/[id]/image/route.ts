/**
 * GET /api/metadata/[id]/image
 *
 * Rozet görseli üretilene kadar kullanılacak YER TUTUCU.
 *
 * NEDEN VAR:
 * Gerçek rozet görselleri (Faz 3'te üretilecek) henüz yok. Metadata'da
 * `image` alanını boş bırakmak ya da olmayan bir dosyaya işaret etmek,
 * cüzdanlarda ve OpenSea'de kırık görsel ikonu demek olurdu — rozet
 * "bozuk" görünür.
 *
 * Bunun yerine anlık bir SVG üretiyoruz: marka renkleri, kamp kısaltması ve
 * hafta numarası. Rozet ilk günden itibaren düzgün görünür; gerçek görsel
 * yüklendiğinde (`Week.imageCid` dolduğunda) metadata otomatik olarak ona
 * geçer ve bu uç nokta devreden çıkar.
 *
 * SVG seçilmesinin sebebi: her ölçekte net, dosya boyutu birkaç kilobayt,
 * üretmek için görsel kütüphanesi gerekmiyor.
 */
import {NextResponse} from "next/server";

import {db} from "@/lib/db";
import {decodeTokenId, parseTokenIdParam} from "@/lib/chain/tokenId";

/* brand.md renk paletinden — kulüp logosundan türetildi */
const VIOLET_950 = "#0E001F";
const VIOLET_800 = "#24004C";  // logonun tam zemin rengi
const NEON_500 = "#AC55DE";
const NEON_300 = "#DEADE7";    // logodan dogrudan orneklendi
const GRAY_50 = "#FAF8FC";
const GRAY_400 = "#A096AE";

/** XML özel karakterlerini kaçırır */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;

  const tokenId = parseTokenIdParam(id);
  if (tokenId === null) {
    return new NextResponse("Geçersiz tokenId", {status: 400});
  }

  const {campId, week} = decodeTokenId(tokenId);

  const camp = await db.camp.findUnique({
    where: {id: campId},
    select: {name: true, slug: true},
  });

  // "developers" → "DEV", "directors" → "DIR"
  const abbreviation = (camp?.slug ?? "PRU").slice(0, 3).toUpperCase();
  const campName = camp?.name ?? "PRU Blockchain";

  /*
   * 1600×1600 — görsel spesifikasyonunda (Faz 0) belirlenen ölçü.
   * Dış %8 (128px) güvenli alan olarak boş bırakıldı: bazı cüzdanlar
   * rozeti daire veya yuvarlatılmış kare olarak kırpar.
   */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600" role="img" aria-label="${esc(campName)} Hafta ${week}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${VIOLET_800}"/>
      <stop offset="100%" stop-color="${VIOLET_950}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${NEON_500}"/>
      <stop offset="100%" stop-color="${NEON_300}"/>
    </linearGradient>
  </defs>

  <rect width="1600" height="1600" fill="url(#bg)"/>

  <!-- Güvenli alan sınırını gösteren ince çerçeve (128px içeride) -->
  <rect x="128" y="128" width="1344" height="1344" rx="48"
        fill="none" stroke="${NEON_500}" stroke-opacity="0.25" stroke-width="3"/>

  <!-- Kamp kısaltması -->
  <text x="800" y="470" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif" font-size="130"
        font-weight="700" letter-spacing="28" fill="url(#accent)">${esc(abbreviation)}</text>

  <!-- Hafta etiketi -->
  <text x="800" y="640" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif" font-size="72"
        font-weight="600" letter-spacing="12" fill="${GRAY_400}">HAFTA</text>

  <!-- Hafta numarası: min 200px yükseklik (görsel spesifikasyonu şartı) -->
  <text x="800" y="1010" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif" font-size="380"
        font-weight="800" fill="${GRAY_50}">${week}</text>

  <line x1="560" y1="1130" x2="1040" y2="1130" stroke="url(#accent)" stroke-width="6"/>

  <text x="800" y="1250" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif" font-size="52"
        font-weight="600" fill="${GRAY_50}">PRU Blockchain Kulübü</text>

  <text x="800" y="1330" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif" font-size="38"
        fill="${GRAY_400}">Piri Reis Üniversitesi</text>

  <text x="800" y="1420" text-anchor="middle"
        font-family="'Segoe UI', system-ui, sans-serif" font-size="30"
        letter-spacing="6" fill="${NEON_500}" opacity="0.7">DEVREDİLEMEZ</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Yer tutucu görsel nadiren değişir; uzun önbellek uygun.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
