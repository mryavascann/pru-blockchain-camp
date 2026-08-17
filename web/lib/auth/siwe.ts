/**
 * ============================================================================
 * Cüzdan sahipliği doğrulaması — SIWE (EIP-4361)
 *
 * PROBLEM: Bir cüzdan adresi HERKESE AÇIK bilgidir. Leaderboard'dan okunabilir,
 * blok gezgininden görülebilir. Eğer backend "hangi adressin?" diye sorup
 * gelen cevaba güvenseydi, herhangi biri şunu yapabilirdi:
 *
 *     GET /api/weeks/developers/5?address=0xBaskasininAdresi
 *
 * ve o kişinin erişimini taklit edebilirdi.
 *
 * ÇÖZÜM: Kullanıcı, adresinin ÖZEL ANAHTARINA sahip olduğunu kanıtlar.
 * Bunu, sunucunun ürettiği bir mesajı imzalayarak yapar. İmza ücretsizdir
 * (zincire işlem gitmez, gas yoktur) ve sadece o anahtarın sahibi üretebilir.
 *
 * AKIŞ:
 *
 *   1. GET  /api/auth/nonce   → sunucu rastgele nonce üretir, oturuma yazar
 *   2. Tarayıcı EIP-4361 mesajını kurar, cüzdana imzalatır
 *   3. POST /api/auth/verify  → sunucu imzayı, nonce'u ve domain'i doğrular
 *   4. Doğrulanırsa adres oturuma yazılır; nonce SİLİNİR
 *
 * NEDEN viem'in KENDİ SIWE ARAÇLARI:
 * Ayrı bir `siwe` paketi kullanmak ethers.js bağımlılığı getirirdi — projede
 * zaten viem var, iki zincir kütüphanesi taşımak gereksiz. viem'in
 * `verifySiweMessage` fonksiyonu ayrıca ERC-1271 (akıllı kontrat cüzdanları)
 * desteği de sağlıyor, yani Safe gibi çoklu imza cüzdanları da giriş yapabilir.
 *
 * https://eips.ethereum.org/EIPS/eip-4361
 * ============================================================================
 */
import {randomBytes} from "node:crypto";

import {parseSiweMessage, verifySiweMessage} from "viem/siwe";

import {getPublicClient} from "@/lib/chain/client";
import {activeChain} from "@/lib/chain/config";
import {publicEnv} from "@/lib/env";

/** Nonce uzunluğu (EIP-4361 en az 8 alfanümerik karakter ister) */
const NONCE_BYTES = 16;

/** İmzanın kabul edileceği en uzun süre. Eski imzalar reddedilir. */
const MESSAGE_MAX_AGE_MS = 10 * 60 * 1000; // 10 dakika

/** Kriptografik olarak güvenli rastgele nonce üretir */
export function generateNonce(): string {
  // Yalnızca alfanümerik olmalı (EIP-4361 şartı) — base64 yerine hex
  return randomBytes(NONCE_BYTES).toString("hex");
}

/**
 * Sitenin alan adı. SIWE mesajındaki `domain` alanı buna EŞİT OLMAK ZORUNDA.
 *
 * NEDEN KRİTİK: Bu kontrol olmasaydı, bir saldırgan kendi sitesinde
 * ("kotusite.com") kullanıcıya bir SIWE mesajı imzalatıp o imzayı BİZİM
 * sitemizde kullanabilirdi. Domain kontrolü, imzayı ait olduğu siteye
 * kilitler.
 */
export function expectedDomain(): string {
  return new URL(publicEnv.NEXT_PUBLIC_APP_URL).host;
}

export type VerifyResult =
  | {ok: true; address: string; chainId: number}
  | {ok: false; error: string};

/**
 * Bir SIWE mesajını ve imzasını doğrular.
 *
 * @param message   İmzalanan ham EIP-4361 metni
 * @param signature Cüzdanın ürettiği imza
 * @param nonce     Sunucunun oturumda sakladığı nonce
 */
export async function verifySignIn(
  message: string,
  signature: `0x${string}`,
  nonce: string,
): Promise<VerifyResult> {
  /* ---- 1. Mesajı ayrıştır ---- */
  let parsed: ReturnType<typeof parseSiweMessage>;
  try {
    parsed = parseSiweMessage(message);
  } catch {
    return {ok: false, error: "İmza mesajı okunamadı."};
  }

  if (!parsed.address) {
    return {ok: false, error: "İmza mesajında adres yok."};
  }

  /* ---- 2. Zincir doğru mu? ---- */
  // Farklı bir zincirde üretilmiş imzanın burada geçerli sayılmaması gerekir.
  if (parsed.chainId !== undefined && parsed.chainId !== activeChain.id) {
    return {
      ok: false,
      error: `Yanlış ağ. ${activeChain.name} bekleniyordu.`,
    };
  }

  /* ---- 3. Mesaj çok eski mi? ---- */
  if (parsed.issuedAt) {
    const age = Date.now() - new Date(parsed.issuedAt).getTime();
    if (age > MESSAGE_MAX_AGE_MS) {
      return {
        ok: false,
        error: "İmza süresi doldu. Lütfen tekrar dene.",
      };
    }
    // Gelecek tarihli imza — saat kaymasına küçük pay bırakıyoruz
    if (age < -60_000) {
      return {ok: false, error: "İmza tarihi geçersiz."};
    }
  }

  /* ---- 4. İmzayı doğrula ---- */
  //
  // `verifySiweMessage` üç şeyi birden kontrol eder:
  //   • İmza gerçekten `parsed.address` tarafından mı atılmış
  //   • Mesajdaki `nonce` beklediğimizle aynı mı  (replay koruması)
  //   • Mesajdaki `domain` bizim sitemiz mi        (phishing koruması)
  //
  // Üçünden biri tutmazsa `false` döner.
  let valid: boolean;
  try {
    valid = await verifySiweMessage(getPublicClient(), {
      message,
      signature,
      nonce,
      domain: expectedDomain(),
    });
  } catch (error) {
    return {
      ok: false,
      error: `İmza doğrulanamadı: ${
        error instanceof Error ? error.message : "bilinmeyen hata"
      }`,
    };
  }

  if (!valid) {
    return {
      ok: false,
      error: "İmza geçersiz. Doğru cüzdanla imzaladığından emin ol.",
    };
  }

  return {
    ok: true,
    address: parsed.address.toLowerCase(),
    chainId: parsed.chainId ?? activeChain.id,
  };
}
