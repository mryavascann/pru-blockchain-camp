/**
 * ============================================================================
 * İLERLEME KAPISI — bir katılımcı hangi haftayı görebilir?
 *
 * Bu dosya tek bir soruya cevap verir ve o cevabı hem içerik erişimi hem de
 * rozet alma kullanır. Kural tek yerde durur; iki ayrı yorumu olamaz.
 *
 * ---------------------------------------------------------------------------
 * KURAL (istekteki örnekle birebir)
 *
 *   "3. haftadaysam 1-2-3. haftaları görebileyim, 4. hafta ve sonrasını
 *    göremeyeyim. 1 hafta geçince NFT'yi mintlerken not istesin, sonra
 *    4. hafta açılsın."
 *
 * Üç kavram var, karıştırılmamalı:
 *
 *   hakEdilenHafta (entitledWeek)
 *       Yöneticinin onayladığı en yüksek haftadan başlar. Mevcut haftanın ilk
 *       notunun üzerinden 7 gün geçtiğinde yalnızca o cüzdan için bir artar.
 *
 *   girişHaftası (entryWeek)
 *       Kişinin kampa katıldığı hafta (onaylı başvurudaki `declaredWeek`).
 *       Bundan ÖNCEKİ haftalar geri doldurmadır — o haftalarda kişi ortada
 *       yoktu, dolayısıyla not borcu yoktur. İstekteki "1 ve 2. haftaları
 *       mintledim" kısmı tam olarak budur.
 *
 *   notBorcu (owedWeeks)
 *       girişHaftası <= W <= hakEdilenHafta olan ve kişinin henüz not
 *       yazmadığı haftalar.
 *
 * Buradan iki sonuç çıkar:
 *
 *   ROZET   : W haftasının rozeti, W için not borcu varsa alınamaz.
 *   GÖRÜNÜM : En küçük borçlu haftadan SONRASI kilitlidir. Borçlu haftanın
 *             KENDİSİ görünür — insanın not yazabilmesi için o haftayı
 *             okuyabiliyor olması gerekir.
 *
 * Örnekle: giriş 3, hakEdilen 3, borç [3]
 *     → görünen 1-2-3 (borçlu hafta dahil), rozet 1-2 serbest, rozet 3 kapalı
 *   Kişi 3'ün notunu yazar
 *     → 3. hafta rozeti açılır; 4. hafta için kişisel 7 günlük sayaç başlar.
 *   Yedi gün geçer, hakEdilen 4 olur, borç [4]
 *     → görünen 1-2-3-4. 4'ün notu yazılınca 5 için yeni sayaç başlar.
 * ---------------------------------------------------------------------------
 *
 * YÖNETİCİ İSTİSNASI: Admin her şeyi görür. İçeriği denetlemesi, eksik
 * özetleri doldurması ve notları denetlemesi gerekiyor; kendi kampına
 * başvurup not yazması saçma olurdu.
 */
import {db} from "@/lib/db";

export type CampProgress = {
  campId: number;

  /**
   * Yöneticinin onayladığı veya kişisel 7 günlük süresi dolduğu için açılan
   * en yüksek hafta. 0 = hiç onaylı hafta yok.
   */
  entitledWeek: number;

  /**
   * Kişinin kampa giriş haftası. Bundan öncesi geri doldurmadır (not istenmez).
   * Onaylı başvuru yoksa `entitledWeek + 1` döner — yani hiçbir hafta borçlu
   * sayılmaz.
   */
  entryWeek: number;

  /** Not yazılmış haftalar, artan sırada */
  notedWeeks: number[];

  /** Not borcu olan haftalar, artan sırada */
  owedWeeks: number[];

  /**
   * Görülebilen en yüksek hafta. Bundan büyük haftalar kilitlidir.
   * 0 = hiçbir hafta açık değil.
   */
  visibleWeek: number;

  /**
   * Görünümü kilitleyen hafta (varsa). Bu haftanın notu yazılınca bir sonraki
   * hafta için kişisel 7 günlük sayaç başlar. Yoksa null.
   */
  blockingWeek: number | null;

  /**
   * Bir sonraki haftanın kişiye özel açılışı.
   *
   * Mevcut haftanın ilk notunun üzerinden yedi gün hesaplanır. Süre dolunca
   * yalnızca bu cüzdanın bu kamptaki bir sonraki haftası açılır.
   */
  nextWeekAt: Date | null;

  /** Yönetici mi? (her şeyi görür) */
  isAdmin: boolean;
};

/** Yöneticiler ve tam erişimliler için kapıyı tamamen açan sonuç */
function unrestricted(campId: number, weekCount: number): CampProgress {
  return {
    campId,
    entitledWeek: weekCount,
    entryWeek: weekCount + 1,
    notedWeeks: [],
    owedWeeks: [],
    visibleWeek: weekCount,
    blockingWeek: null,
    nextWeekAt: null,
    isAdmin: true,
  };
}

/**
 * Bir adresin bir kamptaki ilerleme durumunu hesaplar.
 *
 * Üç sorgu atar (tamamlamalar, başvuru, notlar) ve hepsi indeksli. Sayfa
 * başına bir kez çağrılır.
 *
 * @param address  Küçük harf cüzdan adresi. `null` ise oturum yok demektir.
 * @param isAdmin  Yönetici ise tüm kapılar açılır.
 */
export async function getCampProgress(
  address: string | null,
  campId: number,
  weekCount: number,
  isAdmin = false,
): Promise<CampProgress> {
  if (isAdmin) return unrestricted(campId, weekCount);

  if (!address) {
    return {
      campId,
      entitledWeek: 0,
      entryWeek: 1,
      notedWeeks: [],
      owedWeeks: [],
      visibleWeek: 0,
      blockingWeek: null,
      nextWeekAt: null,
      isAdmin: false,
    };
  }

  const normalized = address.toLowerCase();

  const [latestCompletion, application, notes] = await Promise.all([
    db.weeklyCompletion.findFirst({
      where: {address: normalized, campId},
      orderBy: {weekNumber: "desc"},
      select: {weekNumber: true},
    }),
    db.application.findFirst({
      where: {address: normalized, campId, status: "APPROVED"},
      select: {declaredWeek: true},
    }),
    db.weekNote.findMany({
      where: {address: normalized, campId},
      select: {weekNumber: true, createdAt: true},
    }),
  ]);

  const recordedWeek = Math.min(latestCompletion?.weekNumber ?? 0, weekCount);

  /*
   * Onaylı başvuru yoksa hiçbir hafta borçlu sayılmaz ve kişisel sayaç
   * çalışmaz. Elle eklenmiş bir tamamlama kaydı erişimi yanlışlıkla büyütmesin.
   */
  const entryWeek = application?.declaredWeek ?? recordedWeek + 1;

  /* İlk not tarihi kapının tamamlandığı andır; sonraki notlar sayacı yenilemez. */
  const firstNoteAtByWeek = new Map<number, Date>();
  for (const note of notes) {
    const current = firstNoteAtByWeek.get(note.weekNumber);
    if (!current || note.createdAt < current) {
      firstNoteAtByWeek.set(note.weekNumber, note.createdAt);
    }
  }

  /*
   * KİŞİSEL HAFTA TAKVİMİ
   *
   * Her cüzdan ve kamp kendi not tarihleriyle yürür. Bir haftanın ilk notundan
   * yedi gün sonra yalnızca o kişinin sonraki haftası açılır. Yönetici kaydı
   * daha ilerideyse onu başlangıç/override olarak kabul ederiz.
   */
  const now = Date.now();
  let entitledWeek = recordedWeek;
  let nextWeekAt: Date | null = null;
  while (application && entitledWeek > 0 && entitledWeek < weekCount) {
    let hasEarlierDebt = false;
    for (let week = entryWeek; week < entitledWeek; week++) {
      if (!firstNoteAtByWeek.has(week)) {
        hasEarlierDebt = true;
        break;
      }
    }
    if (hasEarlierDebt) break;

    const noteAt = firstNoteAtByWeek.get(entitledWeek);
    if (!noteAt) break;

    const availableAt = new Date(noteAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (availableAt.getTime() > now) {
      nextWeekAt = availableAt;
      break;
    }

    entitledWeek += 1;
  }

  const notedWeeks = [...new Set(notes.map((n) => n.weekNumber))].sort(
    (a, b) => a - b,
  );
  const notedSet = new Set(notedWeeks);

  const owedWeeks: number[] = [];
  for (let week = entryWeek; week <= entitledWeek; week++) {
    if (!notedSet.has(week)) owedWeeks.push(week);
  }

  /*
   * Borçlu haftanın KENDİSİ görünür, sonrası kilitli.
   * Not yazabilmek için o haftayı okuyabiliyor olmak gerekir.
   */
  const visibleWeek = owedWeeks.length > 0 ? owedWeeks[0] : entitledWeek;
  const blockingWeek = owedWeeks.length > 0 ? owedWeeks[0] : null;

  /* Not borcu varsa sayaç başlamaz; önce mevcut haftanın notu tamamlanır. */
  if (blockingWeek !== null) nextWeekAt = null;

  return {
    campId,
    entitledWeek,
    entryWeek,
    notedWeeks,
    owedWeeks,
    visibleWeek,
    blockingWeek,
    nextWeekAt,
    isAdmin: false,
  };
}

/** Bu hafta bu kişiye açık mı? */
export function canSeeWeek(progress: CampProgress, weekNumber: number): boolean {
  return weekNumber <= progress.visibleWeek;
}

/** Bu haftanın rozeti alınabilir mi? (not borcu yoksa evet) */
export function canClaimWeek(
  progress: CampProgress,
  weekNumber: number,
): boolean {
  return !progress.owedWeeks.includes(weekNumber);
}

/**
 * Bir haftanın neden kapalı olduğunu söyler.
 *
 * Arayüz bu ayrımı kullanır: "başvurun onaylanmadı" ile "önce not yaz"
 * çok farklı iki durum ve kullanıcıya farklı şey yaptırır.
 */
export type WeekLock =
  /** Açık */
  | {kind: "open"}
  /** Hiç onaylı haftan yok — başvurun bekliyor ya da hiç başvurmadın */
  | {kind: "not-approved"}
  /** Bu haftaya henüz gelmedin (yönetici henüz açmadı) */
  | {kind: "not-reached"; entitledWeek: number}
  /** Önceki bir hafta için not borcun var */
  | {kind: "note-required"; blockingWeek: number};

export function weekLock(
  progress: CampProgress,
  weekNumber: number,
): WeekLock {
  if (canSeeWeek(progress, weekNumber)) return {kind: "open"};

  if (progress.entitledWeek === 0) return {kind: "not-approved"};

  /*
   * Hafta HAK EDİLMİŞ ama görünmüyorsa, tek sebep not borcudur.
   *
   * ⚠️ Koşuldaki `weekNumber <= entitledWeek` şart. Onsuz, henüz açılmamış
   * bir hafta için de "not bırak, açılsın" derdik — oysa not yazılsa bile
   * o hafta açılmaz, çünkü kamp oraya daha gelmedi. Kullanıcıya yapması
   * hiçbir şeyi değiştirmeyecek bir iş söylemek, kilit mesajının tamamını
   * güvenilmez yapar.
   */
  if (weekNumber <= progress.entitledWeek && progress.blockingWeek !== null) {
    return {kind: "note-required", blockingWeek: progress.blockingWeek};
  }

  return {kind: "not-reached", entitledWeek: progress.entitledWeek};
}

/* -------------------------------------------------------------------------- */
/*                        ROZET KAPISI (PROOF SAKLAMA)                        */
/* -------------------------------------------------------------------------- */

export type ClaimCandidate = {
  weekNumber: number;
  /** Zincire sunulacak merkle proof'u */
  proof: `0x${string}`[];
  /** Rozet zaten cüzdanda mı? */
  alreadyClaimed: boolean;
};

export type ClaimSplit = {
  /** Her hafta, `needsNote` bayrağı eklenmiş hâlde. Borçlu haftanın proof'u BOŞ. */
  weeks: (ClaimCandidate & {needsNote: boolean})[];
  /** `claimBatch` çağrısına girecek haftalar */
  readyWeekNumbers: number[];
  /** Sırası `readyWeekNumbers` ile birebir eşleşen proof listesi */
  readyProofs: `0x${string}`[][];
  /** Rozeti için önce not yazılması gereken haftalar */
  needsNote: number[];
};

/**
 * Not borcu olan haftaların proof'unu SAKLAR.
 *
 * ⚠️ NOT ZORUNLULUĞUNUN GERÇEK UYGULAMA NOKTASI BURASI.
 *
 * Arayüzdeki bir `disabled` özniteliği koruma değildir — tarayıcı
 * konsolundan `claimBatch` çağıran biri onu atlar. Asıl kapı PROOF'un
 * kendisidir: proof olmadan kontrat `InvalidMerkleProof` ile geri çevirir.
 * Bu fonksiyon borçlu haftanın proof'unu boş diziyle değiştirir; gerçek
 * proof yanıta hiç yazılmaz.
 *
 * Saf bir fonksiyon (veritabanı yok, ağ yok) — bilinçli: güvenlik kararının
 * doğrudan test edilebilmesi için. Bkz. scripts/test-notes.ts.
 *
 * ⚠️ DÜRÜST SINIR: Bu kriptografik bir kilit değil, katılım kuralı. O haftanın
 * hak eden tüm adreslerini bilen biri ağacı yeniden kurup kendi proof'unu
 * üretebilir. Liste yayınlanmıyor ama kontrat "not yazıldı mı" diye soramaz —
 * notlar zincir dışıdır.
 */
export function splitByNoteDebt(
  candidates: ClaimCandidate[],
  owedWeeks: number[],
): ClaimSplit {
  const owed = new Set(owedWeeks);

  const weeks = candidates.map((entry) => {
    const needsNote = owed.has(entry.weekNumber);
    return {
      ...entry,
      needsNote,
      /* Borçlu haftanın gerçek proof'u yanıta GİRMEZ */
      proof: needsNote ? ([] as `0x${string}`[]) : entry.proof,
    };
  });

  const ready = weeks.filter((w) => !w.alreadyClaimed && !w.needsNote);

  return {
    weeks,
    readyWeekNumbers: ready.map((w) => w.weekNumber),
    readyProofs: ready.map((w) => w.proof),
    needsNote: weeks
      .filter((w) => !w.alreadyClaimed && w.needsNote)
      .map((w) => w.weekNumber),
  };
}
