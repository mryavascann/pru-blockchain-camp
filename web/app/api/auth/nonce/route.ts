/**
 * GET /api/auth/nonce
 *
 * SIWE girişinin ilk adımı. Tek kullanımlık rastgele bir değer (nonce) üretir,
 * oturuma yazar ve istemciye döner.
 *
 * NONCE NEDEN ŞART:
 * Nonce olmasaydı, kullanıcının bir kez ürettiği imza sonsuza dek geçerli
 * olurdu. Bu imzayı ele geçiren biri (örneğin bir günlük dosyasından veya
 * ağ trafiğinden) istediği zaman o kullanıcı olarak giriş yapabilirdi
 * — buna "replay attack" denir.
 *
 * Nonce her girişte yenilenir ve doğrulamadan SONRA SİLİNİR. Aynı imza
 * ikinci kez sunulduğunda beklenen nonce artık farklı olduğu için reddedilir.
 */
import {getSession} from "@/lib/auth/session";
import {generateNonce} from "@/lib/auth/siwe";
import {handle, ok} from "@/lib/api";

// Bu uç nokta her çağrıda YENİ değer üretmeli — asla önbelleğe alınmamalı.
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await getSession();

    session.nonce = generateNonce();
    await session.save();

    return ok({nonce: session.nonce});
  });
}
