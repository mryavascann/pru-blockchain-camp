/**
 * GET /api/collection
 *
 * Koleksiyon seviyesi metadata. Kontrattaki `contractURI()` buraya işaret eder.
 *
 * OpenSea bu adresi çağırıp koleksiyonun adını, açıklamasını, logosunu ve
 * banner'ını okur. Olmasaydı koleksiyon "Unnamed Collection" olarak görünür
 * ve rozetler dağınık, kimliksiz durur.
 *
 * https://docs.opensea.io/docs/contract-level-metadata
 */
import {NextResponse} from "next/server";

import {db} from "@/lib/db";
import {publicEnv} from "@/lib/env";
import {contractAddress} from "@/lib/chain/config";

export async function GET() {
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Kapak görseli için ilk kampın CID'ini kullanıyoruz (varsa).
  // Görseller Faz 3'te üretilecek; o zamana kadar yer tutucuya düşülür.
  const firstCamp = await db.camp.findFirst({
    where: {coverCid: {not: null}},
    orderBy: {displayOrder: "asc"},
    select: {coverCid: true},
  });

  const image = firstCamp?.coverCid
    ? `ipfs://${firstCamp.coverCid}`
    : `${appUrl}/api/metadata/65537/image`; // Kamp 1 / Hafta 1 yer tutucusu

  return NextResponse.json(
    {
      name: "PRU Blockchain Kulübü — Kamp Rozetleri",
      description:
        "Piri Reis Üniversitesi Blockchain Kulübü'nün kamp programlarını " +
        "tamamlayan katılımcılara verilen devredilemez (soulbound) başarı " +
        "rozetleri. Her rozet bir kampın bir haftasını temsil eder ve " +
        "sahibinden ayrılamaz.",
      image,
      banner_image_url: `${appUrl}/api/metadata/65537/image`,
      external_link: appUrl,
      collaborators: [contractAddress],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
