/**
 * ============================================================================
 * Prisma istemcisi — tekil örnek (singleton)
 *
 * PRISMA 7 NOTU — DRIVER ADAPTER ZORUNLU:
 * Prisma 7'de kendi Rust sorgu motoru kaldırıldı. Veritabanı bağlantısı artık
 * doğrudan bir Node.js sürücüsü üzerinden kuruluyor (bizde `pg`). Bunun iki
 * pratik sonucu var:
 *   • Dağıtım paketi çok daha küçük (Vercel'de soğuk başlatma hızlanır)
 *   • Bağlantı havuzunu biz yönetiriz — aşağıdaki `max` ayarı bu yüzden var
 *
 * NEDEN GLOBAL DEĞİŞKENDE SAKLIYORUZ:
 * Next.js geliştirme modunda dosya değiştikçe modülleri yeniden yükler.
 * Her yüklemede yeni bir istemci oluşsaydı, birkaç dakika içinde onlarca
 * bağlantı açılır ve Neon'un limiti dolardı ("too many connections").
 * `globalThis`, hot-reload'ın temizlemediği tek yer olduğu için aynı
 * istemcinin yeniden kullanılmasını sağlar.
 * ============================================================================
 */
import {PrismaPg} from "@prisma/adapter-pg";

import {getDatabaseUrl} from "./env";
import {PrismaClient} from "./generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: getDatabaseUrl(),
    // Sunucusuz (serverless) ortamda her istek ayrı bir örnek başlatabilir.
    // Havuzu küçük tutmak, Neon'un bağlantı limitine çarpmayı engeller.
    max: 5,
    // Geliştirmede bağlantıyı biraz daha uzun tut: her sayfa incelemesinde
    // yeniden TLS/Neon bağlantısı kurmak yerelde 1-2 saniye ekliyordu.
    // Sunucusuz production örneklerinde bağlantı limitini korumak için kısa.
    idleTimeoutMillis: process.env.NODE_ENV === "development" ? 60_000 : 10_000,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
