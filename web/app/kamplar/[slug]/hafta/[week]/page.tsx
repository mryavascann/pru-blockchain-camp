/**
 * /kamplar/[slug]/hafta/[week] — Hafta sayfası. ERİŞİM KONTROLLÜ.
 *
 * ---------------------------------------------------------------------------
 * BU SAYFA NEDEN SUNUCU BİLEŞENİ (client değil)
 *
 * Faz 0'da Next.js'i tam olarak bu sayfa için seçtik. Erişim kararı SUNUCUDA
 * verilir; yetkisiz ziyaretçi için `getWeekForViewer()` `contentHtml` alanını
 * sorguya bile eklemez. Yani içerik:
 *
 *   • veritabanından okunmaz
 *   • sunucu belleğine girmez
 *   • HTML'e yazılmaz
 *   • tarayıcıya ulaşmaz
 *
 * Client tarafında yapılan bir kontrol bunu sağlayamazdı — içeriğin
 * tarayıcıya gitmesi gerekirdi ve "gizleme" yalnızca görsel olurdu.
 * ---------------------------------------------------------------------------
 */
import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";

import {LockedPreview} from "@/components/camp/LockedPreview";
import {Container, Pill} from "@/components/ui/Card";
import {getCampBySlug, getWeekForViewer} from "@/lib/content/access";
import {fmt, t} from "@/lib/i18n";

type Props = {params: Promise<{slug: string; week: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {slug, week} = await params;
  const weekNumber = Number(week);

  const camp = await getCampBySlug(slug);
  if (!camp || !Number.isInteger(weekNumber)) {
    return {title: t.errors.notFound};
  }

  const access = await getWeekForViewer(slug, weekNumber);
  if (!access) return {title: t.errors.notFound};

  /*
   * SEO KURALI (Faz 0):
   *   • Herkese açık örnek hafta  → indekslenir, tam açıklama
   *   • Diğer tüm haftalar        → noindex
   *
   * Kilitli sayfaların indekslenmesi, arama sonuçlarında görünüp
   * tıklayanı kilitli ekrana düşürürdü — hem kullanıcı için kötü hem
   * arama motoru için değersiz sayfa.
   */
  const indexable = access.indexable;

  return {
    title: `${access.week.title} · ${camp.name}`,
    description: access.week.teaser || camp.description || undefined,
    robots: indexable
      ? {index: true, follow: true}
      : {index: false, follow: false, nocache: true},
    openGraph: indexable
      ? {
          title: `${access.week.title} — ${camp.name}`,
          description: access.week.teaser || undefined,
        }
      : undefined,
  };
}

export default async function WeekPage({params}: Props) {
  const {slug, week} = await params;
  const weekNumber = Number(week);

  if (!Number.isInteger(weekNumber) || weekNumber < 1) notFound();

  const camp = await getCampBySlug(slug);
  if (!camp) notFound();

  const access = await getWeekForViewer(slug, weekNumber);
  if (!access) notFound();

  /* ---- KİLİTLİ ---- */
  if (access.level === "locked") {
    return (
      <Container prose className="py-10 md:py-14">
        <Breadcrumb campSlug={camp.slug} campName={camp.name} />
        <LockedPreview
          week={access.week}
          reason={access.reason}
          campSlug={camp.slug}
          publicWeekNumber={camp.publicWeekNumber}
        />
      </Container>
    );
  }

  /* ---- AÇIK (public örnek hafta veya tam erişim) ---- */
  const isSample = access.level === "public-sample";

  return (
    <Container prose className="py-10 md:py-14">
      <Breadcrumb campSlug={camp.slug} campName={camp.name} />

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="accent">
            {fmt(t.camp.weekLabel, {n: access.week.weekNumber}).toUpperCase()}
          </Pill>
          {isSample && <Pill tone="accent">🌐 {t.camp.publicBadge}</Pill>}
        </div>

        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
          {access.week.title}
        </h1>

        {access.week.stage && (
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {access.week.stage}
          </p>
        )}

        {access.week.teaser && (
          <p className="mt-4 text-lg leading-relaxed text-[var(--fg-secondary)]">
            {access.week.teaser}
          </p>
        )}
      </header>

      {/*
        İçerik `lib/notion/render.ts` tarafından üretildi. O renderer:
          • tüm metni HTML-kaçış eder
          • yalnızca bilinen bir etiket kümesi üretir
          • javascript:/data: URL'lerini reddeder
          • yalnızca YouTube'u iframe'e alır, diğer siteleri almaz
        Bu yüzden `dangerouslySetInnerHTML` burada denetlenmiş bir girdiyle
        çalışıyor; rastgele kullanıcı içeriği değil.
      */}
      {access.week.contentHtml ? (
        <div
          className="nx-content"
          dangerouslySetInnerHTML={{__html: access.week.contentHtml}}
        />
      ) : (
        <p className="text-[var(--fg-muted)]">{t.camp.noWeeksYet}</p>
      )}

      <WeekNav campSlug={camp.slug} weekNumber={weekNumber} weekCount={camp.weekCount} />
    </Container>
  );
}

function Breadcrumb({
  campSlug,
  campName,
}: {
  campSlug: string;
  campName: string;
}) {
  return (
    <nav className="mb-6 text-sm" aria-label="Sayfa yolu">
      <Link
        href={`/kamplar/${campSlug}`}
        className="text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
      >
        ← {campName}
      </Link>
    </nav>
  );
}

function WeekNav({
  campSlug,
  weekNumber,
  weekCount,
}: {
  campSlug: string;
  weekNumber: number;
  weekCount: number;
}) {
  const previous = weekNumber > 1 ? weekNumber - 1 : null;
  const next = weekNumber < weekCount ? weekNumber + 1 : null;

  return (
    <nav
      className="mt-16 flex justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 text-sm"
      aria-label="Hafta gezinmesi"
    >
      {previous ? (
        <Link
          href={`/kamplar/${campSlug}/hafta/${previous}`}
          className="text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
        >
          ← {fmt(t.camp.weekLabel, {n: previous})}
        </Link>
      ) : (
        <span />
      )}

      {next && (
        <Link
          href={`/kamplar/${campSlug}/hafta/${next}`}
          className="text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
        >
          {fmt(t.camp.weekLabel, {n: next})} →
        </Link>
      )}
    </nav>
  );
}
