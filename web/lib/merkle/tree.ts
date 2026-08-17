/**
 * ============================================================================
 * Merkle ağacı üretimi ve proof çıkarma
 *
 * ⚠️ BU DOSYA KONTRATLA BİREBİR UYUMLU OLMAK ZORUNDA.
 *
 * Kontrat tarafındaki yaprak formülü (contracts/src/MerkleClaim.sol):
 *
 *     leaf = keccak256( bytes.concat( keccak256( abi.encode(account, campId, week) ) ) )
 *
 * OpenZeppelin'in `StandardMerkleTree` sınıfı TAM OLARAK bu formülü üretir:
 *   - İçteki hash  : abi.encode edilmiş değerin keccak256'sı
 *   - Dıştaki hash : ikinci ön görüntü saldırısına (second preimage) karşı
 *   - Kardeş hash  : küçük olan solda olacak şekilde SIRALANMIŞ
 *
 * Üçü de OpenZeppelin'in Solidity tarafındaki `MerkleProof.verify` ile uyumlu.
 *
 * Bu uyumu varsaymıyoruz — `npm run verify:merkle` komutu CANLI KONTRATA
 * sorarak doğruluyor (scripts/verify-merkle-format.ts).
 *
 * Doküman: https://github.com/OpenZeppelin/merkle-tree
 * ============================================================================
 */
import {StandardMerkleTree} from "@openzeppelin/merkle-tree";
import {getAddress} from "viem";
import type {Address} from "viem";

/**
 * Yaprak kodlaması. Sıra ve tipler kontrattaki `abi.encode(account, campId, week)`
 * ile AYNI olmak zorunda. Değiştirilirse tüm eski proof'lar geçersizleşir.
 */
const LEAF_ENCODING = ["address", "uint256", "uint256"] as const;

/** Ağaç içinde tutulan bir satır */
type LeafValue = [string, string, string];

export type BuiltTree = {
  /** 0x ile başlayan kök — zincire bu yazılır */
  root: `0x${string}`;
  /** `StandardMerkleTree.dump()` çıktısı — veritabanında saklanır */
  dump: unknown;
  /** Ağaçtaki kişi sayısı */
  entryCount: number;
};

/**
 * Bir (kamp, hafta) için hak eden adreslerden merkle ağacı kurar.
 *
 * @param campId    Zincirdeki kamp kimliği
 * @param week      Hafta numarası
 * @param addresses Hak eden cüzdan adresleri (sıra önemsiz, tekrarlar temizlenir)
 *
 * @throws Liste boşsa. Boş ağaç kurulamaz ve boş root yazmak anlamsızdır —
 *         kontrat `bytes32(0)` root'u "henüz yayınlanmadı" olarak yorumlar.
 */
export function buildMerkleTree(
  campId: number,
  week: number,
  addresses: readonly string[],
): BuiltTree {
  // Adresleri normalize et ve tekrarları temizle.
  //
  // Normalizasyon şart: aynı cüzdan "0xAbC..." ve "0xabc..." olarak iki kez
  // girerse ağaçta iki farklı yaprak oluşur. Kontrat çift mint'i zaten
  // engeller ama ağaç gereksiz büyür ve proof'lar uzar.
  const unique = [...new Set(addresses.map((a) => getAddress(a)))].sort();

  if (unique.length === 0) {
    throw new Error(
      `Kamp ${campId} hafta ${week} için hak eden kimse yok — ağaç kurulamaz.`,
    );
  }

  const values: LeafValue[] = unique.map((address) => [
    address,
    String(campId),
    String(week),
  ]);

  const tree = StandardMerkleTree.of(values, [...LEAF_ENCODING]);

  return {
    root: tree.root as `0x${string}`,
    dump: tree.dump(),
    entryCount: unique.length,
  };
}

/**
 * Saklanmış bir ağaçtan belirli bir adresin proof'unu çıkarır.
 *
 * @returns Proof dizisi, ya da adres ağaçta yoksa `null`
 *
 * NEDEN AĞACI SAKLIYORUZ, HER SEFERİNDE YENİDEN KURMUYORUZ:
 * Ağaç, üretildiği andaki listeye göre kurulur. Sonradan listeye biri
 * eklenirse YENİ bir ağaç ve YENİ bir root oluşur. Eğer proof isteğinde
 * ağacı o anki listeden yeniden kursaydık, zincirdeki (eski) root'la
 * uyuşmayan proof'lar üretirdik ve kullanıcının işlemi revert ederdi.
 *
 * Saklanan ağaç, zincire yazılmış root'un TAM KARŞILIĞIDIR.
 */
export function getProofFromDump(
  dump: unknown,
  address: string,
  campId: number,
  week: number,
): `0x${string}`[] | null {
  const tree = StandardMerkleTree.load(
    dump as Parameters<typeof StandardMerkleTree.load>[0],
  );
  const target = getAddress(address);

  for (const [index, value] of tree.entries()) {
    const [leafAddress, leafCampId, leafWeek] = value as LeafValue;

    if (
      leafAddress === target &&
      Number(leafCampId) === campId &&
      Number(leafWeek) === week
    ) {
      return tree.getProof(index) as `0x${string}`[];
    }
  }

  return null;
}

/** Saklanmış bir ağacın kökünü döner (bütünlük kontrolü için) */
export function getRootFromDump(dump: unknown): `0x${string}` {
  const tree = StandardMerkleTree.load(
    dump as Parameters<typeof StandardMerkleTree.load>[0],
  );
  return tree.root as `0x${string}`;
}

/**
 * Tek bir yaprağın hash'ini hesaplar.
 * Kontrattaki `merkleLeaf(address,uint256,uint256)` ile aynı sonucu vermeli.
 */
export function computeLeaf(
  address: Address,
  campId: number,
  week: number,
): `0x${string}` {
  return StandardMerkleTree.of(
    [[getAddress(address), String(campId), String(week)]],
    [...LEAF_ENCODING],
  ).root as `0x${string}`;
  // Tek yapraklı ağaçta kök = yaprak. Kontrat tarafında da böyle
  // (MerkleRoots.t.sol → test_SingleLeafTree_Works).
}
