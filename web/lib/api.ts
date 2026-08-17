/**
 * ============================================================================
 * API yanıt yardımcıları
 *
 * Tüm uç noktalar aynı biçimde cevap verir. Frontend'in her uç nokta için
 * ayrı hata ayrıştırma mantığı yazmasına gerek kalmaz.
 *
 * Başarı :  { ok: true,  data: ... }
 * Hata   :  { ok: false, error: "Türkçe, insan dilinde mesaj", code?: "..." }
 *
 * HATA MESAJLARI NEDEN TÜRKÇE VE İNSAN DİLİNDE:
 * Bu mesajlar doğrudan kullanıcıya gösterilecek. "ECONNREFUSED" veya
 * "P2002 unique constraint failed" gibi metinler kullanıcıya hiçbir şey
 * anlatmaz. Teknik detay sunucu günlüğüne yazılır, kullanıcıya ne yapması
 * gerektiği söylenir.
 * ============================================================================
 */
import {NextResponse} from "next/server";

import {ForbiddenError, UnauthorizedError} from "@/lib/auth/guards";

export type ApiSuccess<T> = {ok: true; data: T};
export type ApiFailure = {ok: false; error: string; code?: string};

/** Başarılı yanıt */
export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ok: true, data} as const, init);
}

/** Hata yanıtı */
export function fail(
  error: string,
  status = 400,
  code?: string,
): NextResponse<ApiFailure> {
  return NextResponse.json({ok: false, error, code} as const, {status});
}

/**
 * Uç nokta gövdesini sarmalar ve beklenmeyen hataları yakalar.
 *
 * NEDEN: İşlenmeyen bir hata Next.js'te 500 döner ve gövdesinde yığın izi
 * (stack trace) olabilir — sunucu dosya yollarını ve iç yapıyı sızdırır.
 * Burada hata günlüğe yazılır, kullanıcıya nötr bir mesaj döner.
 */
// Not: Dönüş tipi bilinçli olarak geniş (`NextResponse`). Gövde şeklini
// zaten `ok()` ve `fail()` garanti ediyor; burada dar bir genel tip
// kullanmak, birden fazla başarı şekli dönen uç noktalarda (örneğin
// "kilitli" ve "tam erişim" yanıtları) gereksiz tip hatalarına yol açıyor.
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(error.message, 401, "UNAUTHORIZED");
    }
    if (error instanceof ForbiddenError) {
      return fail(error.message, 403, "FORBIDDEN");
    }

    // Teknik detay yalnızca sunucu günlüğünde kalır
    console.error("[api] beklenmeyen hata:", error);

    return fail(
      "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.",
      500,
      "INTERNAL",
    );
  }
}

/** Gövdeyi JSON olarak okur; bozuksa null döner */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Bir cüzdan adresini normalize eder (küçük harf).
 *
 * Tüm veritabanı kayıtları küçük harf tutulur. Postgres'te dize
 * karşılaştırması büyük/küçük harfe duyarlıdır; normalize edilmezse aynı
 * cüzdan iki ayrı kayıt oluşturur ve "zaten başvurdun" kontrolü çalışmaz.
 */
export function normalizeAddress(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null;
}
