/**
 * ============================================================================
 * Ortam değişkenleri — doğrulanmış erişim
 *
 * NEDEN BU DOSYA VAR:
 * `process.env.NOTION_TOKEN` yazmak her yerde `string | undefined` döner.
 * Eksik bir değişken, uygulama çalışırken beklenmedik bir yerde patlar —
 * genelde en kötü anda. Burada tüm değişkenler bir kez doğrulanır; eksikse
 * uygulama daha AÇILIRKEN net bir mesajla durur.
 *
 * ⚠️ SUNUCU / TARAYICI AYRIMI
 * `NEXT_PUBLIC_` öneki olan değişkenler derleme sırasında tarayıcı paketine
 * GÖMÜLÜR. Sır olan hiçbir şey o önekle tanımlanmaz.
 *
 * `serverEnv` yalnızca sunucu tarafında (route handler, server component)
 * kullanılabilir. Bir client component'ten çağrılırsa hata verir.
 * ============================================================================
 */
import {z} from "zod";

/* Tarayıcı değişkenleri küçük, bağımlılıksız modülden ortak API olarak sunulur. */
export {publicEnv} from "@/lib/env/public";

/* -------------------------------------------------------------------------- */
/*                            SUNUCU DEĞİŞKENLERİ                             */
/* -------------------------------------------------------------------------- */

/**
 * Not: `DATABASE_URL` bilinçli olarak BURADA DEĞİL, `getDatabaseUrl()` içinde
 * doğrulanıyor.
 *
 * Gerekçe: veritabanı yapılandırılmamışsa bile zincir okumaları, metadata
 * uç noktası ve doğrulama script'leri çalışabilmeli. Tek bir eksik değişkenin
 * ilgisiz tüm özellikleri düşürmesi, hata ayıklamayı gereksiz zorlaştırır.
 */
const serverSchema = z.object({
  /** iron-session çerezini şifreleyen anahtar */
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET en az 32 karakter olmalı (openssl rand -base64 32)"),

  /** Boşsa ağın public RPC'si kullanılır */
  RPC_URL: z.string().optional().default(""),

  /** Virgülle ayrılmış admin adresleri */
  ADMIN_ADDRESSES: z.string().optional().default(""),

  /** Notion entegrasyon token'ı. Boşsa senkron devre dışı kalır (site çalışır). */
  NOTION_TOKEN: z.string().optional().default(""),

  /** Notion webhook imza doğrulama sırrı. Boşsa webhook uç noktası kapalıdır. */
  NOTION_WEBHOOK_SECRET: z.string().optional().default(""),

  /** Zamanlanmış senkron uç noktasını koruyan sır */
  CRON_SECRET: z.string().optional().default(""),
});

type ServerEnv = z.infer<typeof serverSchema> & {
  /** Küçük harfe indirgenmiş, ayrıştırılmış admin adres listesi */
  adminAddresses: string[];
};

let cached: ServerEnv | null = null;

/** Herkesçe bilinen geliştirme anahtarları production'da admin olamaz. */
const BLOCKED_PRODUCTION_ADMINS = new Set([
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", // Anvil/Hardhat hesap #0
]);

/**
 * Sunucu ortam değişkenlerini döner.
 *
 * Tembel (lazy) okunur: modül yüklenirken değil, ilk kullanımda doğrulanır.
 * Böylece `next build` sırasında (ortam değişkenlerinin henüz olmadığı anda)
 * derleme patlamaz.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() tarayıcıda çağrılamaz — sunucu sırlarını sızdırırdı.",
    );
  }

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Ortam değişkenleri eksik veya hatalı:\n${issues}\n\n` +
        `web/.env.local dosyasını kontrol et (şablon: web/.env.example)`,
    );
  }

  const adminAddresses = parsed.data.ADMIN_ADDRESSES.split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[a-f0-9]{40}$/.test(a));

  if (
    process.env.NODE_ENV === "production" &&
    adminAddresses.some((address) => BLOCKED_PRODUCTION_ADMINS.has(address))
  ) {
    throw new Error(
      "ADMIN_ADDRESSES production ortamında herkese açık bir Anvil/Hardhat test hesabı içeriyor.",
    );
  }

  cached = {...parsed.data, adminAddresses};
  return cached;
}

/**
 * Veritabanı bağlantı adresi.
 *
 * Ayrı bir fonksiyon olmasının sebebi: yalnızca veritabanına GERÇEKTEN
 * ihtiyaç duyulduğunda doğrulanması. Böylece `DATABASE_URL` eksikken de
 * zincir okumaları ve doğrulama script'leri çalışmaya devam eder.
 */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url || url.length === 0) {
    throw new Error(
      "DATABASE_URL tanımlı değil.\n\n" +
        "  1. https://neon.tech adresinden ücretsiz bir Postgres projesi oluştur\n" +
        '  2. "Connection string" → Pooled connection değerini kopyala\n' +
        "  3. web/.env.local dosyasındaki DATABASE_URL satırına yapıştır\n" +
        "  4. npx prisma db push\n",
    );
  }

  return url;
}

/** Notion senkronu yapılandırılmış mı? Değilse site son cache ile çalışır. */
export function isNotionConfigured(): boolean {
  return getServerEnv().NOTION_TOKEN.length > 0;
}

/** Veritabanı yapılandırılmış mı? (durum ekranlarında kullanılır) */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
