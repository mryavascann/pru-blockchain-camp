/**
 * ============================================================================
 * Yetki kontrolleri
 *
 * Üç seviye var:
 *
 *   ziyaretçi  → oturum yok. Landing, müfredat özeti, public örnek hafta,
 *                leaderboard erişilebilir.
 *   üye        → SIWE ile doğrulanmış cüzdan. Tüm kamp içeriği açılır
 *                (nick koşuluyla — bkz. `getViewer`).
 *   admin      → ADMIN_ADDRESSES listesindeki cüzdan. Admin paneli.
 *
 * ADMIN NEDEN ZİNCİRDEKİ `owner()` DEĞİL:
 * Kontratın sahibi zincir işlemlerini yapan cüzdandır (ileride donanım
 * cüzdanı olacak). Admin paneli ise başvuru onaylama, Notion senkronu
 * tetikleme gibi ZİNCİR DIŞI işler yapar — bunlar için soğuk cüzdanı her
 * seferinde bağlamak anlamsız. Bu yüzden iki yetki ayrı tutuluyor.
 * ============================================================================
 */
import {cache} from "react";

import {readHasNickname, readNickname} from "@/lib/chain/client";
import {getServerEnv} from "@/lib/env";
import {getSession} from "./session";

export type Viewer = {
  /** Doğrulanmış adres (küçük harf), oturum yoksa null */
  address: string | null;
  /** Zincirde nicki var mı? */
  hasNickname: boolean;
  /** Zincirdeki nick (yoksa boş dize) */
  nickname: string;
  /** Admin paneline erişebilir mi? */
  isAdmin: boolean;
};

const ANONYMOUS: Viewer = {
  address: null,
  hasNickname: false,
  nickname: "",
  isAdmin: false,
};

/**
 * Mevcut isteğin ziyaretçisini döner.
 *
 * `cache()` ile sarılı: aynı istek içinde kaç kez çağrılırsa çağrılsın
 * zincire yalnızca BİR kez gidilir. Bir sayfada hem layout hem içerik hem
 * de bir component ziyaretçiyi sorabilir — hepsi aynı sonucu paylaşır.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getSession();
  const address = session.address;

  if (!address) return ANONYMOUS;

  const isAdmin = getServerEnv().adminAddresses.includes(address);

  /*
   * Nick durumunu zincirden okuyoruz.
   *
   * OPTİMİZASYON: Nick bir kez alındıktan sonra ASLA kaybolmaz (kullanıcı
   * değiştirebilir ama silemez). Bu yüzden `true` sonucu oturuma yazılıp
   * bir daha sorulmaz. Yalnızca henüz nicki olmayan kullanıcılar için
   * zincire gidilir — onlar da zaten azınlık ve tek seferlik.
   */
  if (session.hasNickname) {
    return {
      address,
      hasNickname: true,
      nickname: session.nickname ?? "",
      isAdmin,
    };
  }

  try {
    const hasNickname = await readHasNickname(address as `0x${string}`);
    const nickname = hasNickname
      ? await readNickname(address as `0x${string}`)
      : "";

    if (hasNickname) {
      session.hasNickname = true;
      session.nickname = nickname;
      await session.save();
    }

    return {address, hasNickname, nickname, isAdmin};
  } catch {
    /*
     * Zincire ulaşılamıyor (RPC düştü). Oturumu düşürmüyoruz — kullanıcı
     * giriş yapmış durumda kalır, sadece nick bilgisi bilinmiyor sayılır.
     * Bu, RPC kesintisinin tüm siteyi kilitlemesini engeller.
     */
    return {address, hasNickname: false, nickname: "", isAdmin};
  }
});

/** Oturum açmış kullanıcı gerektirir. Yoksa hata fırlatır. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.address) {
    throw new UnauthorizedError("Bu işlem için cüzdan bağlaman gerekiyor.");
  }
  return viewer;
}

/** Admin yetkisi gerektirir. Yoksa hata fırlatır. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) {
    throw new ForbiddenError("Bu sayfa için yönetici yetkisi gerekiyor.");
  }
  return viewer;
}

/* -------------------------------------------------------------------------- */
/*                                 HATALAR                                    */
/* -------------------------------------------------------------------------- */

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}
