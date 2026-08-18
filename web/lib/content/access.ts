/**
 * ============================================================================
 * İÇERİK ERİŞİM KONTROLÜ — projenin güvenlik sınırı
 *
 * Bu dosya, "hangi ziyaretçi hangi içeriği görür" sorusunun TEK cevap yeridir.
 * Hafta içeriği başka hiçbir yerden okunmaz.
 *
 * ---------------------------------------------------------------------------
 * TEMEL İLKE: KİLİTLİ İÇERİK SUNUCUDAN HİÇ ÇIKMAZ
 *
 * Yaygın (ve sahte) yaklaşım şudur: tüm içeriği gönder, tarayıcıda üstüne
 * blur uygula. Bu koruma değildir — `Ctrl+U` ile sayfa kaynağına bakan
 * herkes metni okur.
 *
 * Buradaki yaklaşım farklı: ziyaretçinin yetkisi yoksa `contentHtml` alanı
 * VERİTABANI SORGUSUNA HİÇ DAHİL EDİLMEZ. Aşağıdaki `PUBLIC_FIELDS` ve
 * `FULL_FIELDS` ayrımı bunu sağlar. Yetkisiz istekte içerik ne sunucu
 * belleğine, ne HTML'e, ne de tarayıcıya ulaşır.
 *
 * Yani koruma "geliştirici dikkat ederse" çalışan bir kural değil, sorgunun
 * kendisinde gömülü bir gerçek.
 *
 * ---------------------------------------------------------------------------
 * ERİŞİM ARTIK İKİ AŞAMALI
 *
 * Eskiden tek soru vardı: "oturum + nick var mı?" Varsa TÜM haftalar açılırdı.
 * Artık ikinci bir soru daha var: "bu kişi bu haftaya geldi mi?"
 *
 *   1. KİMLİK   → oturum açık mı, zincirde nicki var mı?   (bu dosya)
 *   2. İLERLEME → bu haftaya hak kazandı mı, not borcu var mı?
 *                 (lib/notes/progress.ts)
 *
 * İkisi de geçilmeden `contentHtml` sorguya girmez. Yani ilerleme kapısı da
 * kimlik kapısı kadar gerçek — kilitli haftanın metni tarayıcıya ulaşmıyor.
 * ---------------------------------------------------------------------------
 */
import {db} from "@/lib/db";
import {getViewer, type Viewer} from "@/lib/auth/guards";
import {getCampProgress, weekLock, type CampProgress} from "@/lib/notes/progress";

/**
 * HERKESE AÇIK alanlar.
 *
 * `contentHtml` ve `rawBlocks` BİLEREK YOK. Bu nesne kilitli ekrana giden
 * verinin tamamıdır.
 */
const PUBLIC_FIELDS = {
  id: true,
  weekNumber: true,
  title: true,
  teaser: true,
  stage: true,
  publishDate: true,
  status: true,
} as const;

/** Yetkili ziyaretçi için alanlar — gerçek içerik burada */
const FULL_FIELDS = {
  ...PUBLIC_FIELDS,
  contentHtml: true,
} as const;

export type PublicWeek = {
  id: string;
  weekNumber: number;
  title: string;
  teaser: string;
  stage: string | null;
  publishDate: Date | null;
};

export type FullWeek = PublicWeek & {
  contentHtml: string | null;
};

/**
 * Kilidin sebebi — arayüzde her biri FARKLI bir çağrı gösterir.
 *
 * Bu ayrım önemli: "cüzdanını bağla" ile "önce 3. haftanın notunu yaz"
 * kullanıcıya bambaşka iki iş yaptırır. Tek bir "erişim yok" mesajı
 * kullanıcıyı çıkmaza sokardı.
 */
export type LockReason =
  /** Cüzdan bağlı değil → "Cüzdanını Bağla" */
  | {kind: "no-session"}
  /** Cüzdan bağlı ama zincirde nicki yok → "Nick Belirle" */
  | {kind: "no-nickname"}
  /** Onaylı başvurusu yok → "Başvurun inceleniyor / Kampa katıl" */
  | {kind: "not-approved"}
  /** Bu haftaya henüz gelmedi → "Şu an N. haftadasın" */
  | {kind: "not-reached"; entitledWeek: number}
  /** Önceki hafta için not borcu var → "Önce N. haftanın notunu bırak" */
  | {kind: "note-required"; blockingWeek: number};

export type WeekAccess =
  /** Tam erişim: kimlik ve ilerleme kapılarının ikisi de geçildi */
  | {level: "full"; week: FullWeek; indexable: false}
  /** Herkese açık örnek hafta: cüzdan gerekmez, SEO'ya açık */
  | {level: "public-sample"; week: FullWeek; indexable: true}
  /** Kilitli: yalnızca başlık + özet gönderilir */
  | {level: "locked"; week: PublicWeek; reason: LockReason; indexable: false};

export type CampSummary = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  weekCount: number;
  active: boolean;
  publicWeekNumber: number | null;
};

/** Bir kampı slug ile bulur (herkese açık bilgi) */
export async function getCampBySlug(slug: string): Promise<CampSummary | null> {
  return db.camp.findUnique({
    where: {slug},
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      weekCount: true,
      active: true,
      publicWeekNumber: true,
    },
  });
}

/** Tüm kampları listeler (landing sayfası) */
export async function listCamps(): Promise<CampSummary[]> {
  return db.camp.findMany({
    orderBy: {displayOrder: "asc"},
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      weekCount: true,
      active: true,
      publicWeekNumber: true,
    },
  });
}

/**
 * Bir kampın MÜFREDAT ÖZETİNİ döner — herkese açık.
 *
 * Yalnızca hafta başlıkları, özetler ve aşama bilgisi. Gerçek içerik yok.
 * Bu liste arama motorlarına da açıktır: yeni üye çekmenin vitrini.
 *
 * ⚠️ İLERLEME KAPISI BURAYA UYGULANMAZ ve bu doğru: hafta BAŞLIKLARI zaten
 * herkese açıktı, kilit ders İÇERİĞİNİN üstünde. Müfredatı gizleseydik
 * kampın ne öğrettiğini kimse göremez, kimse başvurmazdı.
 */
export async function getCurriculum(campId: number): Promise<PublicWeek[]> {
  const weeks = await db.week.findMany({
    where: {campId, status: "PUBLISHED"},
    orderBy: {weekNumber: "asc"},
    select: PUBLIC_FIELDS,
  });

  return weeks.map(stripStatus);
}

/**
 * Ziyaretçinin bir kamptaki ilerleme durumunu döner.
 *
 * Müfredat sayfası bunu kullanarak hangi haftanın kilitli göründüğünü
 * çizer. Kilit BİLGİSİ herkese açıktır (hangi haftada olduğun sır değil);
 * kilitlenen şey haftanın İÇERİĞİ.
 */
export async function getProgressForViewer(
  camp: CampSummary,
  viewerOverride?: Viewer,
): Promise<CampProgress> {
  const viewer = viewerOverride ?? (await getViewer());
  return getCampProgress(
    viewer.address,
    camp.id,
    camp.weekCount,
    viewer.isAdmin,
  );
}

/**
 * Bir haftayı ZİYARETÇİYE GÖRE getirir.
 *
 * Karar sırası:
 *   1. Hafta yayında mı?            → değilse null (yokmuş gibi davranılır)
 *   2. Bu hafta public örnek mi?    → evetse herkese tam içerik + SEO
 *   3. Oturum var mı?               → yoksa kilitli ("no-session")
 *   4. Zincirde nick var mı?        → yoksa kilitli ("no-nickname")
 *   5. Bu haftaya geldi mi?         → gelmediyse kilitli (üç sebepten biri)
 *   6. Hepsi tamamsa                → tam içerik
 *
 * @returns Erişim sonucu, ya da hafta yoksa/yayında değilse `null`
 */
export async function getWeekForViewer(
  campSlug: string,
  weekNumber: number,
  viewerOverride?: Viewer,
): Promise<WeekAccess | null> {
  const camp = await getCampBySlug(campSlug);
  if (!camp) return null;

  /* ---- 2. Herkese açık örnek hafta ---- */
  if (camp.publicWeekNumber === weekNumber) {
    const week = await db.week.findUnique({
      where: {campId_weekNumber: {campId: camp.id, weekNumber}},
      select: FULL_FIELDS,
    });

    if (!week || week.status !== "PUBLISHED") return null;

    return {
      level: "public-sample",
      week: stripStatus(week) as FullWeek,
      indexable: true,
    };
  }

  const viewer = viewerOverride ?? (await getViewer());

  /* ---- 3 & 4. KİMLİK KAPISI ---- */
  if (!viewer.address) {
    return lockedResult(camp.id, weekNumber, {kind: "no-session"});
  }
  if (!viewer.hasNickname && !viewer.isAdmin) {
    return lockedResult(camp.id, weekNumber, {kind: "no-nickname"});
  }

  /* ---- 5. İLERLEME KAPISI ---- */
  const progress = await getCampProgress(
    viewer.address,
    camp.id,
    camp.weekCount,
    viewer.isAdmin,
  );

  const lock = weekLock(progress, weekNumber);

  if (lock.kind !== "open") {
    /*
     * ⚠️ Buraya düşen istekte `contentHtml` SORGUYA GİRMİYOR.
     * İlerleme kilidi de kimlik kilidi kadar gerçek: metin tarayıcıya
     * ulaşmıyor, gizlenmiyor.
     */
    return lockedResult(camp.id, weekNumber, lock);
  }

  /* ---- 6. Tam erişim ---- */
  const week = await db.week.findUnique({
    where: {campId_weekNumber: {campId: camp.id, weekNumber}},
    select: FULL_FIELDS,
  });

  if (!week || week.status !== "PUBLISHED") return null;

  return {
    level: "full",
    week: stripStatus(week) as FullWeek,
    indexable: false,
  };
}

/**
 * Bir kampın herkese açık örnek haftasını döner (varsa).
 * Landing sayfasındaki "Örnek haftayı incele" bağlantısı için.
 */
export async function getPublicSampleWeek(
  campSlug: string,
): Promise<FullWeek | null> {
  const camp = await getCampBySlug(campSlug);
  if (!camp?.publicWeekNumber) return null;

  const access = await getWeekForViewer(campSlug, camp.publicWeekNumber);
  return access?.level === "public-sample" ? access.week : null;
}

/* -------------------------------------------------------------------------- */
/*                                 YARDIMCI                                   */
/* -------------------------------------------------------------------------- */

/**
 * Kilitli sonucu üretir.
 *
 * Tek bir yerde toplandı çünkü burada yapılacak bir hata (yanlışlıkla
 * `FULL_FIELDS` kullanmak) doğrudan içerik sızıntısıdır. Beş ayrı çağrı
 * yerine tek fonksiyon → gözden kaçma ihtimali beşte bir.
 */
async function lockedResult(
  campId: number,
  weekNumber: number,
  reason: LockReason,
): Promise<WeekAccess | null> {
  const week = await db.week.findUnique({
    where: {campId_weekNumber: {campId, weekNumber}},
    // ⚠️ PUBLIC_FIELDS — `contentHtml` burada YOK.
    select: PUBLIC_FIELDS,
  });

  if (!week || week.status !== "PUBLISHED") return null;

  return {level: "locked", week: stripStatus(week), reason, indexable: false};
}

/**
 * `status` alanını dışarı sızdırmıyoruz — iç durum bilgisi, ziyaretçiyi
 * ilgilendirmez. (Yayında olmayan haftalar zaten `null` dönüyor.)
 */
function stripStatus<T extends {status: unknown}>(row: T): Omit<T, "status"> {
  const {status: _status, ...rest} = row;
  return rest;
}
