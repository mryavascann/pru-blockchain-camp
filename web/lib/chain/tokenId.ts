/**
 * ============================================================================
 * tokenId kodlaması — kontrattaki formülün TypeScript karşılığı
 *
 *     tokenId = (campId << 16) | week
 *
 * Kontrat tarafı: contracts/src/CampRegistry.sol → encodeTokenId / decodeTokenId
 *
 * ⚠️ BU İKİ UYGULAMA BİRBİRİYLE AYNI KALMAK ZORUNDA.
 * Ayrılırlarsa frontend yanlış rozeti sorgular ve kullanıcı "rozetim yok"
 * hatası alır. `scripts/verify-merkle-format.ts` bu eşleşmeyi canlı kontrata
 * karşı doğrular.
 *
 * NEDEN JAVASCRIPT `number` DEĞİL `bigint`:
 * tokenId'ler `(campId << 16)` ile üretiliyor. campId büyüdükçe değer
 * JavaScript'in güvenli tamsayı sınırını (2^53) aşabilir. `number` kullanmak
 * sessiz yuvarlama hatalarına yol açar — `bigint` bunu imkânsız kılar.
 * ============================================================================
 */

/** Hafta numarasının sığdığı bit sayısı (kontratla aynı) */
const WEEK_BITS = 16n;

/** Hafta maskesi: alt 16 bit */
const WEEK_MASK = 0xffffn;

/** Hafta numarasının üst sınırı */
export const MAX_WEEK = 65535;

/**
 * (kamp, hafta) → tokenId
 *
 * @example encodeTokenId(1, 3)  // 65539n  (Kamp 1, Hafta 3)
 * @example encodeTokenId(2, 12) // 131084n (Kamp 2, Hafta 12)
 */
export function encodeTokenId(campId: number, week: number): bigint {
  if (!Number.isInteger(campId) || campId < 1) {
    throw new Error(`Geçersiz campId: ${campId} (1 veya daha büyük olmalı)`);
  }
  if (!Number.isInteger(week) || week < 1 || week > MAX_WEEK) {
    throw new Error(`Geçersiz hafta: ${week} (1..${MAX_WEEK} aralığında olmalı)`);
  }
  return (BigInt(campId) << WEEK_BITS) | BigInt(week);
}

/** tokenId → (kamp, hafta) */
export function decodeTokenId(tokenId: bigint): {campId: number; week: number} {
  return {
    campId: Number(tokenId >> WEEK_BITS),
    week: Number(tokenId & WEEK_MASK),
  };
}

/**
 * Bir kampın 1..weekCount haftalarının tüm tokenId'lerini üretir.
 * `balanceOfBatch` ile kullanıcının tüm ilerlemesini TEK RPC çağrısında
 * okumak için kullanılır.
 */
export function tokenIdsForCamp(campId: number, weekCount: number): bigint[] {
  return Array.from({length: weekCount}, (_, i) => encodeTokenId(campId, i + 1));
}

/**
 * ERC-1155 metadata URI'sindeki `{id}` yer tutucusunun çözümlenmesi.
 *
 * Standart, `{id}` yerine tokenId'nin ONALTILIK, 64 karaktere sıfırla
 * doldurulmuş, `0x` ÖNEKSİZ hâlinin konmasını söyler. OpenSea ve çoğu cüzdan
 * böyle yapar. Ancak bazı araçlar ondalık gönderir.
 *
 * Bu yüzden metadata uç noktamız İKİSİNİ DE kabul eder — bkz.
 * app/api/metadata/[id]/route.ts
 */
export function parseTokenIdParam(raw: string): bigint | null {
  const value = raw.trim().replace(/\.json$/i, "");
  if (value.length === 0) return null;

  try {
    // 64 karakterlik onaltılık (ERC-1155 standardı) veya 0x önekli
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(value)) {
      return BigInt(value.startsWith("0x") ? value : `0x${value}`);
    }
    // 0x önekli kısa onaltılık
    if (/^0x[0-9a-fA-F]+$/.test(value)) {
      return BigInt(value);
    }
    // Düz ondalık
    if (/^\d+$/.test(value)) {
      return BigInt(value);
    }
  } catch {
    return null;
  }

  return null;
}
