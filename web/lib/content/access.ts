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
 * ---------------------------------------------------------------------------
 */
import {db} from "@/lib/db";
import {getViewer, type Viewer} from "@/lib/auth/guards";

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

/** Kilidin sebebi — arayüzde farklı çağrı gösterilir */
export type LockReason =
  /** Cüzdan bağlı değil → "Cüzdanını Bağla" */
  | "no-session"
  /** Cüzdan bağlı ama zincirde nicki yok → "Nick Belirle" */
  | "no-nickname";

export type WeekAccess =
  /** Tam erişim: oturum doğrulandı ve nick var */
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
 * Bir haftayı ZİYARETÇİYE GÖRE getirir.
 *
 * Karar sırası:
 *   1. Hafta yayında mı?            → değilse null (yokmuş gibi davranılır)
 *   2. Bu hafta public örnek mi?    → evetse herkese tam içerik + SEO
 *   3. Oturum var mı?               → yoksa kilitli ("no-session")
 *   4. Zincirde nick var mı?        → yoksa kilitli ("no-nickname")
 *   5. Hepsi tamamsa                → tam içerik
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
  const isPublicSample = camp.publicWeekNumber === weekNumber;

  if (isPublicSample) {
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

  /* ---- 3 & 4. Yetki yoksa: SORGUYA `contentHtml` HİÇ GİRMEZ ---- */
  const isAuthorized = Boolean(viewer.address) && viewer.hasNickname;

  if (!isAuthorized) {
    const week = await db.week.findUnique({
      where: {campId_weekNumber: {campId: camp.id, weekNumber}},
      // ⚠️ PUBLIC_FIELDS — `contentHtml` burada YOK.
      //    Gerçek içerik veritabanından hiç okunmuyor.
      select: PUBLIC_FIELDS,
    });

    if (!week || week.status !== "PUBLISHED") return null;

    return {
      level: "locked",
      week: stripStatus(week),
      reason: viewer.address ? "no-nickname" : "no-session",
      indexable: false,
    };
  }

  /* ---- 5. Tam erişim ---- */
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
 * `status` alanını dışarı sızdırmıyoruz — iç durum bilgisi, ziyaretçiyi
 * ilgilendirmez. (Yayında olmayan haftalar zaten `null` dönüyor.)
 */
function stripStatus<T extends {status: unknown}>(row: T): Omit<T, "status"> {
  const {status: _status, ...rest} = row;
  return rest;
}
