/**
 * GET /api/leaderboard
 *
 * HERKESE AÇIK. Cüzdan gerekmez, oturum gerekmez.
 *
 * ---------------------------------------------------------------------------
 * VERİ KAYNAĞI: ZİNCİR — veritabanı değil.
 *
 * Bu ayrım kritik. Veritabanı "kim hak ediyor" bilgisini tutar; zincir ise
 * "kim gerçekten aldı" bilgisini. Leaderboard İKİNCİSİNİ gösterir.
 *
 * Aksi hâlde tabloda rozetini hiç almamış kişiler görünürdü ve sıralama
 * gerçeği yansıtmazdı. Rozetin anlamı "hak ettim" değil, "aldım"dır.
 *
 * Adres listesi veritabanından geliyor (kimlere bakacağımızı bilmek için),
 * ama HER SATIRIN DEĞERİ zincirden okunuyor.
 * ---------------------------------------------------------------------------
 *
 * PERFORMANS: 40 katılımcı × 27 hafta = 1080 bakiye sorgusu, `balanceOfBatch`
 * sayesinde 1-3 RPC çağrısında tamamlanıyor. ERC-1155 seçmemizin somut
 * karşılığı burada görülüyor.
 */
import {db} from "@/lib/db";
import {readBalancesForPairs, readNicknames} from "@/lib/chain/client";
import {encodeTokenId} from "@/lib/chain/tokenId";
import {handle, ok} from "@/lib/api";

export const dynamic = "force-dynamic";

/** Tabloda gösterilecek en fazla satır */
const MAX_ROWS = 200;

type Row = {
  address: string;
  nickname: string;
  campSlug: string;
  campName: string;
  completedWeeks: number;
  totalWeeks: number;
  /** Hangi haftaların alındığı — ilerleme kutucukları için */
  progress: boolean[];
};

export async function GET() {
  return handle(async () => {
    const camps = await db.camp.findMany({
      orderBy: {displayOrder: "asc"},
      select: {id: true, slug: true, name: true, weekCount: true},
    });

    if (camps.length === 0) {
      return ok({rows: [], updatedAt: new Date().toISOString()});
    }

    /*
     * Kime bakacağız: hak ediş kaydı olan herkes.
     *
     * Bu liste veritabanından geliyor çünkü zincirde "tüm sahipleri listele"
     * diye bir fonksiyon yok (ERC-1155 enumerable değil ve olması da
     * gereksiz gas maliyeti demek olurdu). Ama listedeki her kişinin
     * DURUMU zincirden okunuyor.
     */
    const participants = await db.weeklyCompletion.findMany({
      distinct: ["address", "campId"],
      select: {address: true, campId: true},
      take: MAX_ROWS * camps.length,
    });

    if (participants.length === 0) {
      return ok({rows: [], updatedAt: new Date().toISOString()});
    }

    /* ---- Tüm (adres, tokenId) ikililerini tek listede topla ---- */
    const campById = new Map(camps.map((c) => [c.id, c]));
    const pairs: {address: `0x${string}`; tokenId: bigint}[] = [];
    const index: {address: string; campId: number; week: number}[] = [];

    for (const participant of participants) {
      const camp = campById.get(participant.campId);
      if (!camp) continue;

      for (let week = 1; week <= camp.weekCount; week++) {
        pairs.push({
          address: participant.address as `0x${string}`,
          tokenId: encodeTokenId(camp.id, week),
        });
        index.push({
          address: participant.address,
          campId: camp.id,
          week,
        });
      }
    }

    /* ---- Tek toplu okuma ---- */
    const balances = await readBalancesForPairs(pairs);

    /* ---- Satırları kur ---- */
    const rowMap = new Map<string, Row>();

    for (let i = 0; i < index.length; i++) {
      const {address, campId, week} = index[i];
      const camp = campById.get(campId)!;
      const key = `${address}:${campId}`;

      let row = rowMap.get(key);
      if (!row) {
        row = {
          address,
          nickname: "",
          campSlug: camp.slug,
          campName: camp.name,
          completedWeeks: 0,
          totalWeeks: camp.weekCount,
          progress: new Array(camp.weekCount).fill(false),
        };
        rowMap.set(key, row);
      }

      if (balances[i]) {
        row.progress[week - 1] = true;
        row.completedWeeks += 1;
      }
    }

    /* ---- Nickleri zincirden oku ---- */
    const uniqueAddresses = [...new Set(participants.map((p) => p.address))];
    const nicknames = await readNicknames(
      uniqueAddresses as `0x${string}`[],
    );

    for (const row of rowMap.values()) {
      row.nickname = nicknames.get(row.address) ?? "";
    }

    /*
     * Sıralama: tamamlanan hafta sayısına göre azalan.
     * Eşitlikte nick alfabetik — deterministik olması önemli, aksi hâlde
     * her yenilemede satırlar yer değiştirir ve kullanıcı kendini bulamaz.
     */
    const rows = [...rowMap.values()]
      .filter((r) => r.completedWeeks > 0) // rozeti olmayan tabloda görünmez
      .sort(
        (a, b) =>
          b.completedWeeks - a.completedWeeks ||
          a.nickname.localeCompare(b.nickname, "tr"),
      )
      .slice(0, MAX_ROWS);

    return ok(
      {rows, updatedAt: new Date().toISOString()},
      {
        headers: {
          // 60 saniye önbellek: yeni bir rozet alındığında en geç 1 dakikada
          // yansır. Zincir okuması pahalı olduğu için her istekte yapılmaz.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  });
}
