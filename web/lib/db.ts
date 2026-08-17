/**
 * ============================================================================
 * Prisma istemcisi — tekil örnek (singleton)
 *
 * NEDEN GLOBAL DEĞİŞKENDE SAKLIYORUZ:
 * Next.js geliştirme modunda dosya değiştikçe modülleri yeniden yükler.
 * Her yüklemede `new PrismaClient()` çağrılsaydı, birkaç dakika içinde
 * onlarca veritabanı bağlantısı açılır ve Neon'un ücretsiz katmanındaki
 * bağlantı limiti dolardı ("too many connections" hatası).
 *
 * `globalThis` üzerinde saklamak, hot-reload'ın temizlemediği tek yer olduğu
 * için aynı istemcinin yeniden kullanılmasını sağlar. Üretimde modüller bir
 * kez yüklendiği için bu koruma gereksizdir ama zararsızdır.
 * ============================================================================
 */
import {PrismaClient} from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Geliştirmede sorguları görmek hata ayıklamayı kolaylaştırır;
    // üretimde gürültü yapmasın diye yalnızca hatalar loglanır.
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
