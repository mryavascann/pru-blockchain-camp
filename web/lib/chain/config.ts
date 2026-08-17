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

import {publicEnv} from "@/lib/env";

const CHAINS = {
  baseSepolia,
  base,
} as const satisfies Record<string, Chain>;

/** Uygulamanın çalıştığı zincir */
export const activeChain: Chain = CHAINS[publicEnv.NEXT_PUBLIC_CHAIN];

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
