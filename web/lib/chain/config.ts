/**
 * ============================================================================
 * Zincir yapılandırması — TEK DEĞİŞİM NOKTASI
 *
 * Testnet'ten mainnet'e geçiş tek bir ortam değişkeniyle yapılır:
 *     NEXT_PUBLIC_CHAIN="baseSepolia"  →  "base"
 *     NEXT_PUBLIC_CONTRACT_ADDRESS="0x..."
 *
 * Kodun hiçbir yerinde zincir kimliği, RPC adresi veya kontrat adresi
 * doğrudan yazılmaz. Hepsi buradan gelir.
 * ============================================================================
 */
import {fallback, http} from "viem";
import {base, baseSepolia} from "viem/chains";
import type {Address, Chain, Transport} from "viem";

import {publicEnv} from "@/lib/env";

const CHAINS = {
  baseSepolia,
  base,
} as const satisfies Record<string, Chain>;

/** Uygulamanın çalıştığı zincir */
export const activeChain: Chain = CHAINS[publicEnv.NEXT_PUBLIC_CHAIN];

/* -------------------------------------------------------------------------- */
/*                              RPC HAVUZU                                    */
/* -------------------------------------------------------------------------- */

/**
 * ============================================================================
 * OKUMA İÇİN BİRDEN FAZLA RPC — NEDEN
 *
 * Uzun süre tek adres kullanıldı: `https://sepolia.base.org`. 2026-08-19'da
 * o adres YARI ÇALIŞIR duruma düştü — `eth_blockNumber` ve `eth_getBalance`
 * cevap verirken `eth_call` isteklerinin TAMAMI "no backend is currently
 * healthy to serve traffic" ile reddedildi (ölçüldü: 20/20 başarısız).
 *
 * Sonucu şuydu: nick zincirde kayıtlıyken site "Nick Belirle" gösterdi,
 * çünkü nick okuması bir `eth_call`. Ağ ayakta görünüyordu; kimse neyin
 * bozuk olduğunu anlamadı.
 *
 * Aynı anda ölçülen diğer adresler sorunsuz çalışıyordu. Yani sorun ağda
 * değil, TEK BİR SAĞLAYICIYA BAĞLI OLMAKTAYDI.
 *
 * SIRALAMA: ölçüme göre publicnode en istikrarlısıydı (10/10), resmî adres
 * 0/10, drpc 1/10. Liste bu sırayla; biri düşerse viem sıradakine geçer.
 *
 * NOT: `1rpc.io/base-sepolia` bilerek listede yok — "unknown network"
 * döndürüyor, Base Sepolia'yı desteklemiyor.
 * ============================================================================
 */
const RPC_POOL = {
  baseSepolia: [
    "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.base.org",
    "https://base-sepolia.drpc.org",
  ],
  base: [
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org",
    "https://base.drpc.org",
  ],
} as const satisfies Record<keyof typeof CHAINS, readonly string[]>;

/** Aktif zincirin RPC listesi, denenme sırasıyla */
export const rpcUrls: readonly string[] = RPC_POOL[publicEnv.NEXT_PUBLIC_CHAIN];

/**
 * Tek bir RPC'nin cevap vermesi için beklenecek süre.
 *
 * Kısa tutuldu (varsayılan 10sn değil): amaç ölü bir adreste beklemek değil,
 * hızla sıradakine geçmek. Üçü birden ölürse en kötü ihtimalle 18 saniyede
 * hata döner — sayfayı süresiz kilitlemez.
 */
const REQUEST_TIMEOUT = 6_000;

/**
 * Okuma istemcileri için taşıyıcı üretir.
 *
 * @param preferredUrl Varsa listenin BAŞINA alınır (sunucudaki `RPC_URL`
 *                     ortam değişkeni için — özel/ücretli bir uç nokta
 *                     tanımlandıysa önce o denenmeli, ama tek çare olmamalı).
 *
 * `retryCount: 0` bilinçli: yeniden deneme yerine SIRADAKİ ADRESE geçmek
 * istiyoruz. Aynı ölü adrese üç kez sormanın faydası yok — bu, eski
 * yapılandırmanın (`retryCount: 3`) kesintiyi neden karşılayamadığının da
 * cevabı.
 */
export function createReadTransport(preferredUrl?: string): Transport {
  const urls = preferredUrl
    ? [preferredUrl, ...rpcUrls.filter((url) => url !== preferredUrl)]
    : [...rpcUrls];

  return fallback(
    urls.map((url) => http(url, {timeout: REQUEST_TIMEOUT})),
    {retryCount: 0},
  );
}

/** Kontratın (proxy) adresi */
export const contractAddress = publicEnv.NEXT_PUBLIC_CONTRACT_ADDRESS as Address;

/** Testnet mi? Arayüzde uyarı şeridi göstermek için kullanılır. */
export const isTestnet = publicEnv.NEXT_PUBLIC_CHAIN === "baseSepolia";

/** Blok gezgini kök adresi (BaseScan) */
export const explorerUrl =
  activeChain.blockExplorers?.default.url ?? "https://basescan.org";

/** Bir işlemin gezgindeki adresi */
export function explorerTxUrl(txHash: string): string {
  return `${explorerUrl}/tx/${txHash}`;
}

/** Bir adresin gezgindeki sayfası */
export function explorerAddressUrl(address: string): string {
  return `${explorerUrl}/address/${address}`;
}
