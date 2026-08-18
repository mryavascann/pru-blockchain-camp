/**
 * GET /api/auth/session
 *
 * Mevcut oturumu döner. Arayüz açılışta bunu çağırıp "cüzdan bağlı mı,
 * nick var mı, admin mi" sorularını tek istekte cevaplar.
 *
 * Oturum yoksa hata DEĞİL, `address: null` döner — "giriş yapılmamış"
 * normal bir durumdur, hata değil.
 */
import {getViewer} from "@/lib/auth/guards";
import {handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const viewer = await getViewer();

    return ok({
      address: viewer.address,
      nickname: viewer.nickname,
      hasNickname: viewer.hasNickname,
      /* Zincire ulaşılamadıysa "nick yok" değil, "bilinmiyor" — bkz. guards.ts */
      nicknameUnknown: viewer.nicknameUnknown,
      isAdmin: viewer.isAdmin,
    });
  });
}
