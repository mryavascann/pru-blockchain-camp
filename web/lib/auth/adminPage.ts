import {getViewer} from "./guards";

/**
 * ============================================================================
 * Admin sayfası koruması
 *
 * ⚠️ HER ADMIN SAYFASI BUNU KENDİ İÇİNDE ÇAĞIRMAK ZORUNDA.
 *    Layout'taki kontrol YETMEZ.
 *
 * NEDEN — gerçek bir sızıntıyla öğrenildi:
 *
 * Next.js App Router'da layout ve page PARALEL render edilir. Layout erken
 * dönüp `{children}`'ı hiç yerleştirmese bile, page bileşeni ÇALIŞIR;
 * verisini çeker, JSX üretir ve bu çıktı RSC yüküne serileşerek tarayıcıya
 * gider. Ekranda görünmez ama sayfa kaynağında okunabilir.
 *
 * Bekleyen başvuru sayısı, senkron hataları ve kontrat durumu bu yolla
 * yetkisiz ziyaretçiye sızıyordu.
 *
 * KURAL: Yetki kontrolü, VERİ ÇEKMEDEN ÖNCE ve SAYFANIN KENDİ İÇİNDE.
 *
 * Kullanım:
 *
 *     export default async function AdminSomethingPage() {
 *       if (!(await isAdminViewer())) return null;   // ← ilk satır
 *       const data = await db.…                      // ← sonra veri
 *     }
 *
 * `null` dönmek doğru davranış: kullanıcıya gösterilecek mesajı layout
 * zaten üretiyor (bağlan / yetkin yok). Burada ikinci bir mesaj göstermek
 * tekrar olurdu.
 * ============================================================================
 */
export async function isAdminViewer(): Promise<boolean> {
  const viewer = await getViewer();
  return viewer.isAdmin;
}
