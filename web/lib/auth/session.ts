/**
 * ============================================================================
 * Oturum yönetimi — şifreli çerez (iron-session)
 *
 * NEDEN VERİTABANI TABLOSU YOK:
 * Oturum verisi (adres + nonce) çok küçük ve kısa ömürlü. Bunu şifreli bir
 * çerezde taşımak, her istekte veritabanına gitmekten hem daha hızlı hem
 * daha ucuz. iron-session çerezi AES ile şifreler ve imzalar — istemci
 * içeriği ne okuyabilir ne değiştirebilir.
 *
 * ÇEREZ AYARLARININ GEREKÇELERİ:
 *
 *   httpOnly : true   → JavaScript çerezi okuyamaz. XSS açığı olsa bile
 *                       saldırgan oturumu çalamaz.
 *   sameSite : "lax"  → Başka sitelerden gelen POST istekleriyle çerez
 *                       gönderilmez (CSRF koruması). "strict" olsaydı
 *                       harici bir bağlantıdan gelen kullanıcı oturumsuz
 *                       görünürdü — "lax" doğru denge.
 *   secure   : üretimde true → çerez yalnızca HTTPS üzerinden gider.
 *                       Yerelde http://localhost kullanıldığı için kapalı.
 *   maxAge   : 7 gün  → Kamp haftalarca sürüyor; her ziyarette yeniden imza
 *                       istemek gereksiz sürtünme olurdu.
 * ============================================================================
 */
import {getIronSession, type SessionOptions} from "iron-session";
import {cookies} from "next/headers";

import {getServerEnv} from "@/lib/env";

/** Oturumda tutulan veri */
export type SessionData = {
  /**
   * SIWE için üretilmiş tek kullanımlık rastgele değer.
   *
   * NEDEN GEREKLİ: Nonce olmasaydı bir saldırgan, kullanıcının daha önce
   * ürettiği bir imzayı yakalayıp sonsuza kadar tekrar kullanabilirdi
   * (replay attack). Nonce her girişte yenilenir ve KULLANILDIKTAN SONRA
   * SİLİNİR — aynı imza ikinci kez kabul edilmez.
   */
  nonce?: string;

  /** Doğrulanmış cüzdan adresi — HER ZAMAN KÜÇÜK HARF */
  address?: string;

  /** İmzanın atıldığı zincir */
  chainId?: number;

  /** Oturumun açıldığı an (ISO 8601) */
  issuedAt?: string;

  /**
   * Zincirde nicki olduğu DOĞRULANDI mı?
   *
   * Yalnızca `true` yazılır, asla `false` yazılmaz. Gerekçe: nick bir kez
   * alındıktan sonra kaybolmaz (kullanıcı değiştirebilir ama silemez), yani
   * `true` sonsuza dek geçerlidir. Bu sayede her sayfa görüntülemesinde
   * zincire gitmek gerekmez. Nicki olmayan kullanıcı için her seferinde
   * sorulur — onlar zaten azınlık ve tek seferlik.
   */
  hasNickname?: boolean;

  /** Zincirden okunmuş nick (önbellek) */
  nickname?: string;
};

const SEVEN_DAYS = 60 * 60 * 24 * 7;

function sessionOptions(): SessionOptions {
  return {
    password: getServerEnv().SESSION_SECRET,
    cookieName: "pru_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SEVEN_DAYS,
    },
  };
}

/**
 * Mevcut isteğin oturumunu döner.
 * Oturum yoksa boş bir nesne döner (hata fırlatmaz).
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

/**
 * Oturumdaki doğrulanmış adresi döner.
 * @returns Küçük harfli adres, ya da oturum yoksa `null`
 */
export async function getSessionAddress(): Promise<string | null> {
  const session = await getSession();
  return session.address ?? null;
}
