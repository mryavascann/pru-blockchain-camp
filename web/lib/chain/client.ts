/**
 * ============================================================================
 * Zincir okuma istemcisi (sunucu tarafı)
 *
 * Backend'in zincirden okuduğu her şey buradan geçer: kim hangi rozete sahip,
 * kampların zincirdeki hâli, nickler, merkle root'lar.
 *
 * ⚠️ BU DOSYA HİÇBİR ZAMAN YAZMA (write) YAPMAZ.
 * Backend'in private key'i yok ve olmayacak. Merkle root yazma gibi işlemleri
 * admin kendi cüzdanıyla yapar (Faz 3'te admin panelinden, şimdilik
 * `contracts/script/SetMerkleRoot.s.sol` ile).
 *
 * Gerekçe: sunucuda private key tutmak, sunucu ele geçirildiğinde kontratın
 * da ele geçirilmesi demektir. İmza yetkisini insanda tutmak bu riski
 * tamamen ortadan kaldırır.
 * ============================================================================
 */
import {createPublicClient, getAddress} from "viem";
import type {Address, PublicClient} from "viem";

import {getServerEnv} from "@/lib/env";
import {pruCampBadgesAbi} from "./abi";
import {activeChain, contractAddress} from "./config";
import {createReadTransport} from "./transport";
import {tokenIdsForCamp} from "./tokenId";

let cached: PublicClient | null = null;

/** Zincir okuma istemcisi (tekil örnek) */
export function getPublicClient(): PublicClient {
  if (cached) return cached;

  const {RPC_URL} = getServerEnv();

  cached = createPublicClient({
    chain: activeChain,
    /*
     * TEK RPC DEĞİL, HAVUZ. `RPC_URL` tanımlıysa önce o denenir; cevap
     * vermezse sıradaki adrese geçilir (bkz. transport.ts).
     *
     * Eskiden burada tek adres ve `retryCount: 3` vardı. Bir sağlayıcı
     * kalıcı olarak `eth_call` reddetmeye başladığında üç deneme de aynı
     * ölü adrese gittiği için kesinti tüm siteye yansıyordu.
     */
    transport: createReadTransport(RPC_URL || undefined),
  }) as PublicClient;

  return cached;
}

/** Kontrat çağrıları için ortak parametreler */
const contract = {
  address: contractAddress,
  abi: pruCampBadgesAbi,
} as const;

/* -------------------------------------------------------------------------- */
/*                                 OKUMALAR                                   */
/* -------------------------------------------------------------------------- */

/**
 * Bir kullanıcının bir kamptaki tüm haftalık ilerlemesini TEK çağrıda okur.
 *
 * ERC-1155'i seçmemizin somut kazancı burada görünüyor: `balanceOfBatch` ile
 * 15 haftanın tamamı bir RPC isteğinde gelir. ERC-721 olsaydı 15 ayrı
 * `ownerOf` çağrısı gerekirdi — leaderboard'da 40 kişi × 15 hafta = 600 istek.
 *
 * @returns Uzunluğu `weekCount` olan dizi; `[i] === true` ise (i+1). hafta alınmış
 */
export async function readProgress(
  address: Address,
  campId: number,
  weekCount: number,
): Promise<boolean[]> {
  if (weekCount <= 0) return [];

  const tokenIds = tokenIdsForCamp(campId, weekCount);
  const owner = getAddress(address);

  const balances = await getPublicClient().readContract({
    ...contract,
    functionName: "balanceOfBatch",
    args: [Array.from({length: weekCount}, () => owner), tokenIds],
  });

  return (balances as readonly bigint[]).map((b) => b > 0n);
}

/** Bir adresin zincirdeki nicki. Kayıtlı değilse boş dize döner. */
export async function readNickname(address: Address): Promise<string> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "nicknameOf",
    args: [getAddress(address)],
  });
  return result as string;
}

/** Bir adresin zincirde nicki var mı? Rozet almanın ön koşulu. */
export async function readHasNickname(address: Address): Promise<boolean> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "hasNickname",
    args: [getAddress(address)],
  });
  return result as boolean;
}

/** Bir nickin zincirdeki sahibi. Sahipsizse sıfır adres döner. */
export async function readNicknameOwner(nickname: string): Promise<Address> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "ownerOfNickname",
    args: [nickname],
  });
  return result as Address;
}

export type OnChainCamp = {
  campId: number;
  name: string;
  weekCount: number;
  active: boolean;
  exists: boolean;
};

/**
 * Zincirdeki tüm kampları okur.
 *
 * Admin panelinde "veritabanı ile zincir uyuşuyor mu" karşılaştırması için
 * kullanılır. İkisi ayrıştıysa (örneğin zincirde hafta sayısı artırılmış ama
 * DB güncellenmemişse) admin uyarılır.
 */
export async function readAllCamps(): Promise<OnChainCamp[]> {
  const [ids, camps] = (await getPublicClient().readContract({
    ...contract,
    functionName: "getAllCamps",
  })) as [
    readonly bigint[],
    readonly {name: string; weekCount: number; active: boolean; exists: boolean}[],
  ];

  return ids.map((id, i) => ({
    campId: Number(id),
    name: camps[i].name,
    weekCount: Number(camps[i].weekCount),
    active: camps[i].active,
    exists: camps[i].exists,
  }));
}

/** Bir (kamp, hafta) için zincire yazılmış merkle root. Yazılmamışsa 0x00..00 */
export async function readMerkleRoot(
  campId: number,
  week: number,
): Promise<`0x${string}`> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "merkleRootOf",
    args: [BigInt(campId), BigInt(week)],
  });
  return result as `0x${string}`;
}

/**
 * Bir proof'un zincire göre geçerli olup olmadığını sorar.
 *
 * Backend proof ürettikten sonra bunu çağırır: eğer zincirdeki root henüz
 * güncellenmemişse kullanıcıya boşuna "Rozeti Al" butonu göstermek yerine
 * "Liste yayınlanmayı bekliyor" denir. Kullanıcı başarısız bir işleme gas
 * ödemez.
 */
export async function readIsProofValid(
  address: Address,
  campId: number,
  week: number,
  proof: readonly `0x${string}`[],
): Promise<boolean> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "isProofValid",
    args: [getAddress(address), BigInt(campId), BigInt(week), proof],
  });
  return result as boolean;
}

/**
 * Kontratın merkle yaprağını üretir.
 *
 * `scripts/verify-merkle-format.ts` bunu kullanarak TypeScript tarafındaki
 * yaprak üretiminin kontratla birebir aynı sonucu verdiğini doğrular.
 */
export async function readMerkleLeaf(
  address: Address,
  campId: number,
  week: number,
): Promise<`0x${string}`> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "merkleLeaf",
    args: [getAddress(address), BigInt(campId), BigInt(week)],
  });
  return result as `0x${string}`;
}

/** Kontratın sahibi (admin yetkisinin zincirdeki kaynağı) */
export async function readOwner(): Promise<Address> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "owner",
  });
  return result as Address;
}

/**
 * Çok sayıda (adres, tokenId) ikilisinin bakiyesini TEK RPC çağrısında okur.
 *
 * LEADERBOARD'IN MOTORU BU FONKSİYON.
 *
 * 40 katılımcı × 27 hafta = 1080 sorgu demek. ERC-721 olsaydı bu 1080 ayrı
 * `ownerOf` çağrısı olurdu ve leaderboard sayfası açılmazdı. ERC-1155'in
 * `balanceOfBatch` fonksiyonu hepsini tek istekte döner.
 *
 * Yine de sonsuz büyütmüyoruz: çok büyük `eth_call` istekleri RPC
 * sağlayıcılarında zaman aşımına uğrar. `CHUNK_SIZE` ile parçalıyoruz.
 */
const BALANCE_CHUNK_SIZE = 400;

export async function readBalancesForPairs(
  pairs: readonly {address: Address; tokenId: bigint}[],
): Promise<boolean[]> {
  if (pairs.length === 0) return [];

  const client = getPublicClient();
  const results: boolean[] = [];

  for (let i = 0; i < pairs.length; i += BALANCE_CHUNK_SIZE) {
    const chunk = pairs.slice(i, i + BALANCE_CHUNK_SIZE);

    const balances = (await client.readContract({
      ...contract,
      functionName: "balanceOfBatch",
      args: [
        chunk.map((p) => getAddress(p.address)),
        chunk.map((p) => p.tokenId),
      ],
    })) as readonly bigint[];

    for (const balance of balances) {
      results.push(balance > 0n);
    }
  }

  return results;
}

/** Birden fazla adresin nickini tek seferde okur (sırayla, küçük listeler için) */
export async function readNicknames(
  addresses: readonly Address[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Nickler `string` döndüğü için `balanceOfBatch` gibi toplu bir fonksiyon
  // yok. Katılımcı sayısı düşük olduğu için paralel okuma yeterli.
  const results = await Promise.all(
    addresses.map(async (address) => {
      try {
        return [address.toLowerCase(), await readNickname(address)] as const;
      } catch {
        return [address.toLowerCase(), ""] as const;
      }
    }),
  );

  for (const [address, nickname] of results) {
    map.set(address, nickname);
  }
  return map;
}

/** Kontrat duraklatılmış mı? */
export async function readPaused(): Promise<boolean> {
  const result = await getPublicClient().readContract({
    ...contract,
    functionName: "paused",
  });
  return result as boolean;
}
