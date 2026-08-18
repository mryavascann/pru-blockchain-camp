/**
 * GET /api/leaderboard — HERKESE AÇIK, cüzdan gerekmez.
 *
 * Hesaplama `lib/leaderboard.ts` içinde; aynı mantığı `/siralama` sayfası da
 * doğrudan kullanıyor. Tek kaynak, iki tüketici.
 */
import {computeLeaderboard} from "@/lib/leaderboard";
import {handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const data = await computeLeaderboard();

    return ok(data, {
      headers: {
        // 60 saniye önbellek: yeni bir rozet alındığında en geç 1 dakikada
        // yansır. Zincir okuması pahalı olduğu için her istekte yapılmaz.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  });
}
