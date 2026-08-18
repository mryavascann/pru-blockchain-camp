/**
 * /admin/merkle — Merkle ağacı üretimi ve zincire yazma
 */
import {db} from "@/lib/db";
import {isAdminViewer} from "@/lib/auth/adminPage";
import {readOwner} from "@/lib/chain/client";
import {MerkleManager} from "./MerkleManager";

export const dynamic = "force-dynamic";

export default async function MerklePage() {
  /* ⚠️ VERİ ÇEKMEDEN ÖNCE — bkz. lib/auth/adminPage.ts */
  if (!(await isAdminViewer())) return null;

  const camps = await db.camp.findMany({
    where: {lifecycle: "PUBLISHED", chainCampId: {not: null}},
    orderBy: {displayOrder: "asc"},
    select: {id: true, slug: true, name: true, weekCount: true},
  });

  /*
   * Kontratın sahibini zincirden okuyoruz. Bağlı cüzdan sahipse arayüz
   * doğrudan "Zincire Yaz" düğmesi gösteriyor; değilse hazır `cast` komutu.
   *
   * RPC düşerse `null` döner ve arayüz komut yolunu gösterir — güvenli taraf.
   */
  const contractOwner = await readOwner().catch(() => null);

  return <MerkleManager camps={camps} contractOwner={contractOwner} />;
}
