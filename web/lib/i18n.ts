/**
 * ============================================================================
 * Metin sözlüğü
 *
 * Faz 0 şartı: "Site dili Türkçe. Sonradan İngilizce eklenebilsin diye
 * metinler koda gömülmeyecek, ayrı bir dosyada toplanacak."
 *
 * NEDEN next-intl VEYA BENZERİ BİR KÜTÜPHANE KULLANMIYORUZ:
 * Şu an tek dil var. Bir i18n kütüphanesi; sağlayıcı, middleware, yönlendirme
 * ve dil algılama katmanları getirir — hepsi tek dilde hiçbir işe yaramaz.
 *
 * Bu yaklaşım İngilizce eklendiğinde de yeterli: `en.json` oluşturulur,
 * `getDictionary(locale)` fonksiyonu yazılır ve çağrılar aynı kalır.
 * Tip güvenliği JSON'dan otomatik türetilir — olmayan bir anahtara
 * eriştiğinde TypeScript hata verir.
 * ============================================================================
 */
import tr from "@/locales/tr.json";

export const t = tr;

export type Dictionary = typeof tr;

/**
 * Metindeki `{isim}` yer tutucularını doldurur.
 *
 * @example fmt(t.camp.weekLabel, {n: 3})            → "Hafta 3"
 * @example fmt(t.camp.progressOf, {done: 3, total: 15}) → "3 / 15"
 */
export function fmt(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
