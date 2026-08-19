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
import {base, baseSepolia} from "viem/chains";
import type {Address, Chain} from "viem";

import {publicEnv} from "@/lib/env/public";

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
