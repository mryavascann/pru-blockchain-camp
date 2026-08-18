/**
 * ============================================================================
 * Nick kuralları — kontrattaki doğrulamanın TypeScript aynası
 *
 * Kaynak: contracts/src/NicknameRegistry.sol → _normalizeAndValidate()
 *
 * ⚠️ BU DOSYA GÜVENLİK KATMANI DEĞİL, KULLANICI DENEYİMİ KATMANIDIR.
 *
 * Gerçek doğrulama zincirde yapılır ve atlatılamaz. Buradaki kopya, kullanıcı
 * yazarken anında geri bildirim vermek için var: geçersiz bir nick yüzünden
 * cüzdan açıp gas ödeyip revert almak kötü bir deneyim.
 *
 * İki uygulama ayrışırsa sonuç: kullanıcı "müsait" görür ama işlem reverte
 * düşer. Bu yüzden kurallar birebir aynı tutulmalı ve değişiklik ikisinde
 * birden yapılmalı.
 * ============================================================================
 */

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;

export type NicknameCheck = {valid: true} | {valid: false; reason: string};

/**
 * Nicki kontrattaki kurallara göre doğrular.
 *
 * Kurallar (Solidity ile birebir):
 *   • 3-20 KARAKTER — ama uzunluk BAYT cinsinden ölçülür
 *   • İzinli küme: a-z, A-Z, 0-9, _
 *   • İlk karakter harf olmalı
 *   • Son karakter alt çizgi olamaz
 *   • Art arda iki alt çizgi olamaz
 */
export function checkNickname(raw: string): NicknameCheck {
  const value = raw.trim();

  /*
   * Uzunluğu BAYT olarak ölçüyoruz — kontrat da öyle yapıyor.
   * "buğra" 5 karakter ama 6 bayttır (ğ iki bayt). Karakter sayarsak
   * arayüz "5 karakter, uygun" der, kontrat "6 bayt" görür. Zaten Türkçe
   * karakterler ayrıca reddediliyor ama ölçüm birimi de aynı olmalı.
   */
  const byteLength = new TextEncoder().encode(value).length;

  if (byteLength === 0) {
    return {valid: false, reason: "Nick boş olamaz."};
  }
  if (byteLength < NICKNAME_MIN_LENGTH) {
    return {valid: false, reason: `Nick en az ${NICKNAME_MIN_LENGTH} karakter olmalı.`};
  }
  if (byteLength > NICKNAME_MAX_LENGTH) {
    return {valid: false, reason: `Nick en fazla ${NICKNAME_MAX_LENGTH} karakter olabilir.`};
  }

  /* Türkçe karakterler için AYRI ve açıklayıcı mesaj.
     Genel "geçersiz karakter" uyarısı, kullanıcının neyi yanlış yaptığını
     anlamasını zorlaştırırdı — en sık yapılacak hata bu. */
  if (/[çğıöşüÇĞİÖŞÜ]/.test(value)) {
    return {
      valid: false,
      reason:
        "Türkçe karakter kullanılamaz (ç, ğ, ı, ö, ş, ü). " +
        "Sebep: büyük/küçük harf dönüşümü zincirde belirsiz olduğu için " +
        "taklit riski doğuruyor.",
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return {
      valid: false,
      reason: "Sadece a-z, A-Z, 0-9 ve alt çizgi (_) kullanılabilir.",
    };
  }
  if (!/^[a-zA-Z]/.test(value)) {
    return {valid: false, reason: "Nick bir harfle başlamalı."};
  }
  if (value.endsWith("_")) {
    return {valid: false, reason: "Nick alt çizgi ile bitemez."};
  }
  if (value.includes("__")) {
    return {valid: false, reason: "Art arda iki alt çizgi olamaz."};
  }

  return {valid: true};
}

/** Benzersizlik anahtarı — kontrattaki keccak256(lowercase) ile aynı mantık */
export function normalizeNickname(value: string): string {
  return value.trim().toLowerCase();
}
