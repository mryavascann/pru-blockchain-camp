/**
 * POST /api/auth/verify
 *
 * SIWE girişinin ikinci adımı. İmzayı doğrular ve oturumu açar.
 *
 * Gövde: { message: string, signature: "0x..." }
 *
 * DOĞRULANAN ÜÇ ŞEY:
 *   1. İmza gerçekten o adrese mi ait          → sahiplik kanıtı
 *   2. Mesajdaki nonce oturumdakiyle aynı mı   → replay koruması
 *   3. Mesajdaki domain bizim sitemiz mi       → phishing koruması
 *
 * Üçü de `lib/auth/siwe.ts` içinde tek bir çağrıda kontrol edilir.
 */
import {getSession} from "@/lib/auth/session";
import {verifySignIn} from "@/lib/auth/siwe";
import {readHasNickname, readNickname} from "@/lib/chain/client";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

type Body = {
  message?: string;
  signature?: string;
};

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson<Body>(request);

    if (!body?.message || !body?.signature) {
      return fail("İmza mesajı veya imza eksik.", 400, "BAD_REQUEST");
    }

    if (!/^0x[0-9a-fA-F]+$/.test(body.signature)) {
      return fail("İmza biçimi geçersiz.", 400, "BAD_SIGNATURE");
    }

    const session = await getSession();

    // Nonce oturumda yoksa: ya /api/auth/nonce çağrılmamış, ya çerez
    // engellenmiş, ya da oturum süresi dolmuş.
    if (!session.nonce) {
      return fail(
        "Giriş oturumu bulunamadı. Sayfayı yenileyip tekrar dene.",
        400,
        "NO_NONCE",
      );
    }

    const result = await verifySignIn(
      body.message,
      body.signature as `0x${string}`,
      session.nonce,
    );

    if (!result.ok) {
      // Başarısız denemede de nonce'u yakıyoruz. Aksi hâlde saldırgan aynı
      // nonce'a karşı sınırsız deneme yapabilirdi.
      session.nonce = undefined;
      await session.save();
      return fail(result.error, 401, "INVALID_SIGNATURE");
    }

    /* ---- Oturumu aç ---- */
    session.address = result.address;
    session.chainId = result.chainId;
    session.issuedAt = new Date().toISOString();
    // KULLANILDI → SİL. Aynı imza ikinci kez kabul edilmesin.
    session.nonce = undefined;

    /* ---- Nick durumunu zincirden oku (arayüzün ilk kararı için) ---- */
    let hasNickname = false;
    let nickname = "";

    try {
      hasNickname = await readHasNickname(result.address as `0x${string}`);
      if (hasNickname) {
        nickname = await readNickname(result.address as `0x${string}`);
        session.hasNickname = true;
        session.nickname = nickname;
      }
    } catch {
      // RPC düşmüşse giriş yine de başarılı sayılır; nick sonra okunur.
    }

    await session.save();

    return ok({
      address: result.address,
      chainId: result.chainId,
      hasNickname,
      nickname,
    });
  });
}
