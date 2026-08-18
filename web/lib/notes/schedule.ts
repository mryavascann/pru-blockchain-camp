/**
 * ============================================================================
 * HAFTA TAKVİMİ — "bu hafta ne zaman açılacak?"
 *
 * ---------------------------------------------------------------------------
 * ÖNEMLİ: TAKVİM BİR KİLİT DEĞİL, BİR BEKLENTİDİR
 *
 * Bir haftayı gerçekten açan tek şey, kulüp yöneticisinin o haftayı
 * `/admin/ilerleme` ekranından işaretlemesidir. Buradaki tarih yalnızca
 * "planlanan açılış" bilgisidir ve kullanıcıya bilgi vermek için var.
 *
 * Neden ikinci bir kilit yapmadık: tarih geldiğinde hafta kendiliğinden
 * açılsaydı, kimin o haftayı tamamladığı bilgisi olmadan rozet hak edişi
 * üretilemezdi. Hak ediş insan kararıdır (Faz 0 şartı); takvim ona
 * eşlik eden bir tahmin.
 *
 * Bu yüzden arayüzde tarih ASLA kesin bir vaat gibi yazılmaz:
 * "12 Eylül'de açılıyor" değil, "planlanan açılış: 12 Eylül".
 * ---------------------------------------------------------------------------
 *
 * TARİH NEREDEN GELİYOR (öncelik sırasıyla):
 *   1. `Week.publishDate`  → o haftaya özel tarih (Notion'dan ya da elle)
 *   2. `Camp.startDate`    → kamp başlangıcı + (hafta-1) × 7 gün
 *   3. Hiçbiri yoksa null  → arayüz tarih göstermez, sadece "yakında" der
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bir haftanın planlanan açılış tarihi.
 *
 * @param campStartDate    Kampın başlangıç tarihi (yoksa null)
 * @param weekPublishDate  Haftaya özel tarih (yoksa null) — varsa kazanır
 * @param weekNumber       1'den başlar
 */
export function plannedOpening(
  campStartDate: Date | string | null,
  weekPublishDate: Date | string | null,
  weekNumber: number,
): Date | null {
  if (weekPublishDate) return new Date(weekPublishDate);
  if (!campStartDate) return null;

  const start = new Date(campStartDate);
  if (Number.isNaN(start.getTime())) return null;

  return new Date(start.getTime() + (weekNumber - 1) * 7 * DAY_MS);
}

/**
 * Kalan süreyi Türkçe okunur biçimde döner: "6 gün 11 saat".
 *
 * Saniye göstermiyoruz: sunucuda üretilen bir metin saniye içerirse
 * kullanıcı sayfayı yenilemediği sürece yanlış kalır ve canlı sayaç
 * için gereksiz bir istemci zamanlayıcısı gerekirdi. Gün/saat çözünürlüğü
 * "ne zaman?" sorusuna yeterince cevap veriyor.
 *
 * @returns Kalan süre metni, ya da tarih geçmişse `null`
 */
export function formatRemaining(
  target: Date,
  now: Date = new Date(),
): string | null {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return null;

  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) {
    return hours > 0 ? `${days} gün ${hours} saat` : `${days} gün`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} saat ${minutes} dakika` : `${hours} saat`;
  }
  return `${Math.max(minutes, 1)} dakika`;
}

/** "12 Eylül Cumartesi" biçiminde tarih */
export function formatOpeningDate(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

export type OpeningInfo = {
  /** Planlanan açılış tarihi */
  date: Date;
  /** Kalan süre metni; tarih geçtiyse null */
  remaining: string | null;
  /** Tarih geçti mi? (geçtiyse hafta yöneticinin işaretlemesini bekliyor) */
  overdue: boolean;
};

/** Arayüzün ihtiyaç duyduğu üç bilgiyi tek seferde üretir */
export function openingInfo(
  campStartDate: Date | string | null,
  weekPublishDate: Date | string | null,
  weekNumber: number,
  now: Date = new Date(),
): OpeningInfo | null {
  const date = plannedOpening(campStartDate, weekPublishDate, weekNumber);
  if (!date) return null;

  const remaining = formatRemaining(date, now);
  return {date, remaining, overdue: remaining === null};
}
