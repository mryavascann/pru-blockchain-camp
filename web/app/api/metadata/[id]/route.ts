/**
 * GET /api/metadata/[id]
 *
 * ERC-1155 metadata uç noktası. Kontrattaki `uri()` buraya işaret eder:
 *
 *     https://prublockchain.vercel.app/api/metadata/{id}.json
 *
 * Cüzdanlar ve OpenSea `{id}` yerine tokenId koyar ve bu adresi çağırır.
 *
 * ---------------------------------------------------------------------------
 * `{id}` NEDEN İKİ BİÇİMDE DE KABUL EDİLİYOR
 *
 * ERC-1155 standardı `{id}` yerine tokenId'nin ONALTILIK, 64 karaktere
 * sıfırla doldurulmuş, `0x` ÖNEKSİZ hâlinin konmasını söyler:
 *
 *     .../0000000000000000000000000000000000000000000000000000000000010003.json
 *
 * OpenSea ve çoğu cüzdan böyle yapar. Ancak bazı araçlar (ve elle test
 * edenler) ondalık gönderir: `.../65539.json`
 *
 * Uç nokta ikisini de kabul eder. Standarda uymayan istemciler yüzünden
 * rozetlerin görselsiz görünmesi, kabul etmemekten çok daha kötü bir sonuç.
 * ---------------------------------------------------------------------------
 *
 * İKİ AŞAMALI METADATA PLANININ 1. AŞAMASI:
 * Metadata burada, ANLIK ÜRETİLİR. Kamp adı değişirse basılmış tüm
 * rozetlerin adı anında güncellenir — zincirde işlem yok, gas yok.
 * Kamp yapısı oturunca her şey IPFS'e taşınıp `freezeMetadata()` ile
 * kalıcı hâle getirilecek.
 */
import {NextResponse} from "next/server";

import {db} from "@/lib/db";
import {decodeTokenId, parseTokenIdParam} from "@/lib/chain/tokenId";
import {publicEnv} from "@/lib/env";

/** brand.md → --navy-900. OpenSea `#` ÖNEKSİZ ister. */
const BACKGROUND_COLOR = "0A1729";

export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>},
) {
  const {id} = await params;

  const tokenId = parseTokenIdParam(id);
  if (tokenId === null) {
    return NextResponse.json(
      {error: "Geçersiz tokenId."},
      {status: 400},
    );
  }

  const {campId, week} = decodeTokenId(tokenId);

  if (campId < 1 || week < 1) {
    return NextResponse.json(
      {error: "Bu tokenId geçerli bir rozete karşılık gelmiyor."},
      {status: 404},
    );
  }

  const camp = await db.camp.findUnique({
    where: {chainCampId: campId},
    select: {id: true, name: true, slug: true, weekCount: true},
  });

  if (!camp) {
    return NextResponse.json({error: "Kamp bulunamadı."}, {status: 404});
  }

  const weekRow = await db.week.findUnique({
    where: {campId_weekNumber: {campId: camp.id, weekNumber: week}},
    select: {title: true, imageCid: true, imageAssetId: true},
  });

  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  /*
   * Görsel: IPFS CID varsa `ipfs://` şeması kullanılır.
   *
   * NEDEN `ipfs://`, gateway URL'si değil: gateway'ler kapanır, alan adı
   * değişir. `ipfs://` her istemcinin kendi çözümleyicisiyle çalışır ve
   * kalıcıdır. CID yoksa (görseller henüz üretilmedi) anlık üretilen bir
   * yer tutucuya düşülür — rozet "bozuk" değil, "henüz tasarlanmamış" görünür.
   */
  const image = weekRow?.imageCid
    ? `ipfs://${weekRow.imageCid}`
    : weekRow?.imageAssetId
      ? `${appUrl}/api/media/${weekRow.imageAssetId}`
      : `${appUrl}/api/metadata/${tokenId.toString()}/image`;

  const weekTitle = weekRow?.title ?? `Hafta ${week}`;

  const metadata = {
    name: `${camp.name} — Hafta ${week}`,
    description:
      `Bu rozet, PRU Blockchain Kulübü "${camp.name}" kampının ${week}. ` +
      `haftasını (${weekTitle}) tamamlayan katılımcıya verilmiştir. ` +
      `Devredilemez (soulbound) bir başarı rozetidir.`,
    image,
    external_url: `${appUrl}/kamplar/${camp.slug}/hafta/${week}`,
    background_color: BACKGROUND_COLOR,
    attributes: [
      {trait_type: "Kamp", value: camp.name},
      {
        trait_type: "Hafta",
        value: week,
        display_type: "number",
        max_value: camp.weekCount,
      },
      {trait_type: "Konu", value: weekTitle},
      {trait_type: "Rozet Tipi", value: "Haftalık Tamamlama"},
      {trait_type: "Devredilebilir", value: "Hayır"},
      {trait_type: "Kurum", value: "Piri Reis Üniversitesi"},
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      /*
       * 5 dakika önbellek: kamp adı değişirse en geç 5 dakikada yansır.
       * `stale-while-revalidate` sayesinde kullanıcı bu süre dolduğunda da
       * beklemez — eski sürüm gösterilirken arka planda yenilenir.
       */
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      // Cüzdanlar ve pazaryerleri farklı kaynaklardan çağırır
      "Access-Control-Allow-Origin": "*",
    },
  });
}
