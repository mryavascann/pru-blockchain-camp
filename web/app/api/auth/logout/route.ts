/**
 * POST /api/auth/logout
 *
 * Oturumu kapatır (çerezi yok eder).
 *
 * NEDEN POST, GET DEĞİL:
 * GET ile çıkış yapılabilseydi, kötü niyetli bir sitedeki
 * `<img src="https://sitemiz/api/auth/logout">` etiketi kullanıcıyı
 * habersizce çıkış yaptırabilirdi. Durum değiştiren işlemler GET olmaz.
 */
import {getSession} from "@/lib/auth/session";
import {handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  return handle(async () => {
    const session = await getSession();
    session.destroy();
    return ok({loggedOut: true});
  });
}
