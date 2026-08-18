/**
 * GET /api/nickname/check?value=bugra
 *
 * Bir nickin zincirde alınmış olup olmadığını sorar. HERKESE AÇIK.
 *
 * NEDEN SUNUCU ÜZERİNDEN, TARAYICIDAN DOĞRUDAN DEĞİL:
 * Tarayıcı da zinciri okuyabilirdi, ama o zaman her tuş vuruşunda kullanıcının
 * RPC kotasını harcardık ve public RPC'lerde hız limitine takılırdık. Sunucu
 * tarafında yapmak hem tek bir RPC anahtarı üzerinden gitmeyi hem de
 * yanıtı önbelleğe almayı mümkün kılıyor.
 *
 * ⚠️ Bu uç nokta bir GÜVENLİK katmanı değil, KULLANICI DENEYİMİ katmanıdır.
 * Gerçek benzersizlik kontrolü kontratta yapılır ve atlatılamaz.
 */
import {readNicknameOwner} from "@/lib/chain/client";
import {checkNickname} from "@/lib/nickname";
import {fail, handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

const ZERO = "0x0000000000000000000000000000000000000000";

export async function GET(request: Request) {
  return handle(async () => {
    const value = new URL(request.url).searchParams.get("value") ?? "";

    /* Önce biçim — geçersiz nick için zinciri boşuna yormayalım */
    const format = checkNickname(value);
    if (!format.valid) {
      return ok({available: false, reason: format.reason, formatValid: false});
    }

    try {
      const owner = await readNicknameOwner(value.trim());
      return ok({
        available: owner.toLowerCase() === ZERO,
        formatValid: true,
      });
    } catch {
      /*
       * RPC'ye ulaşılamadı. "Alınmış" demek yanlış olur (kullanıcıyı
       * gereksiz yere engeller), "müsait" demek de yanlış olur (sonra
       * işlem reverte düşer). Bilinmiyor diyoruz; arayüz butonu
       * engellemez, kullanıcı deneyebilir.
       */
      return fail(
        "Zincire ulaşılamadı, nick müsaitliği kontrol edilemedi.",
        503,
        "CHAIN_UNAVAILABLE",
      );
    }
  });
}
