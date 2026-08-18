/**
 * ============================================================================
 * /api/admin/completions — Haftalık ilerleme işaretleme
 *
 *   POST   → seçilen kişiler için "bu haftayı tamamladı" kaydı açar
 *   DELETE → yanlış işaretlemeyi geri alır
 *
 * ---------------------------------------------------------------------------
 * BU UÇ NOKTA NEDEN GEREKLİ
 *
 * Başvuru onayı 1..N haftalarını GERİ DOLDURUR ve orada durur. Kamp
 * ilerledikçe yeni haftaların açılması için birinin "bu hafta bitti, şunlar
 * tamamladı" demesi lazım. O kişi sensin; bu uç nokta o işi yapar.
 *
 * Zinciri şöyle tamamlıyor:
 *
 *   1. Başvuru onayı        → 1..N geri doldurma
 *   2. HAFTALIK İŞARETLEME  → N+1, N+2 … (burası)
 *   3. Merkle ağacı üretimi → /api/admin/merkle
 *   4. Kökü zincire yazma   → senin cüzdanınla
 *
 * ---------------------------------------------------------------------------
 * OTOMASYON YOK — Faz 0 şartı
 *
 * Kimin haftayı tamamladığına dair otomatik doğrulama, katılım takibi ya da
 * skorlama YOK. Ekran sana basit bir liste verir, sen işaretlersin.
 * Buradaki tek "kolaylık" toplu işaretleme; kararı yine sen veriyorsun.
 * ---------------------------------------------------------------------------
 */
import {z} from "zod";

import {db} from "@/lib/db";
import {requireAdmin} from "@/lib/auth/guards";
import {fail, handle, ok, readJson} from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  campId: z.number().int().positive(),
  weekNumber: z.number().int().min(1),
  /** Küçük harf cüzdan adresleri */
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).min(1).max(500),
});

export async function POST(request: Request) {
  return handle(async () => {
    const admin = await requireAdmin();

    const parsed = schema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("İşaretleme bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const {campId, weekNumber, addresses} = parsed.data;

    const camp = await db.camp.findUnique({
      where: {id: campId},
      select: {name: true, weekCount: true},
    });
    if (!camp) return fail("Kamp bulunamadı.", 404, "NOT_FOUND");

    if (weekNumber > camp.weekCount) {
      return fail(
        `"${camp.name}" ${camp.weekCount} haftalık. ${weekNumber}. hafta işaretlenemez.`,
        400,
        "WEEK_OUT_OF_RANGE",
      );
    }

    /*
     * `source: "weekly"` — bu kaydın geri doldurmadan değil, kampın
     * canlı akışından geldiğini söyler. Denetim için: bir rozetin nereden
     * geldiği her zaman izlenebilir olmalı.
     */
    const result = await db.weeklyCompletion.createMany({
      data: addresses.map((address) => ({
        address: address.toLowerCase(),
        campId,
        weekNumber,
        source: "weekly",
        createdBy: admin.address!,
      })),
      skipDuplicates: true,
    });

    return ok({
      created: result.count,
      skipped: addresses.length - result.count,
      nextStep:
        `${weekNumber}. hafta için merkle ağacını üret (Merkle sekmesi), ` +
        "sonra kökü zincire yaz. Katılımcılar rozeti alırken bu hafta için " +
        "not bırakmak zorunda kalacak.",
    });
  });
}

/**
 * Yanlış işaretlemeyi geri alır.
 *
 * ⚠️ Rozeti ZATEN ALINMIŞ bir haftayı geri almak zincirdeki rozeti silmez —
 * zincir geri alınamaz. Bu yalnızca veritabanındaki hak ediş kaydını siler
 * ve bir sonraki merkle ağacından kişiyi çıkarır. Zincirdeki rozeti kaldırmak
 * için `burn` gerekir (yalnızca ilk 7 gün içinde).
 */
export async function DELETE(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const parsed = schema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) {
      return fail("İşaretleme bilgileri hatalı.", 400, "VALIDATION_ERROR");
    }

    const {campId, weekNumber, addresses} = parsed.data;

    const result = await db.weeklyCompletion.deleteMany({
      where: {
        campId,
        weekNumber,
        address: {in: addresses.map((a) => a.toLowerCase())},
      },
    });

    return ok({
      deleted: result.count,
      warning:
        "Zincirde alınmış bir rozet bu işlemle silinmez. Kayıt yalnızca " +
        "veritabanından ve sonraki merkle ağacından çıkar.",
    });
  });
}
