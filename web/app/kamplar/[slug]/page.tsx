/**
 * /kamplar/[slug] — Müfredat özeti. HERKESE AÇIK, SEO'ya açık.
 *
 * Faz 0 şartı: "Her kampın müfredat özeti (hafta başlıkları görünür,
 * içerikleri görünmez)."
 *
 * Bu sayfa yeni üye çekmenin vitrinidir. `getCurriculum()` yalnızca
 * PUBLIC_FIELDS ile sorgu yapar — ders içeriği veritabanından okunmaz bile.
 *
 * Kullanıcı giriş yapmışsa hangi rozetleri aldığı da gösterilir; bu bilgi
 * ZİNCİRDEN okunur, veritabanından değil.
 */
import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";

import {WeekCard} from "@/components/camp/WeekCard";
import {ProgressBoxes} from "@/components/ui/Progress";
import {Container, EmptyState, Pill} from "@/components/ui/Card";
import {getCampBySlug, getCurriculum, getProgressForViewer} from "@/lib/content/access";
import {weekLock} from "@/lib/notes/progress";
import {getViewer} from "@/lib/auth/guards";
import {readProgress} from "@/lib/chain/client";
import {t} from "@/lib/i18n";

type Props = {params: Promise<{slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {slug} = await params;
  const camp = await getCampBySlug(slug);

  if (!camp) return {title: t.errors.notFound};

  return {
    title: camp.name,
    description:
      camp.description ??
      `${camp.name} — ${camp.weekCount} haftalık kamp programının müfredatı.`,
    openGraph: {
      title: camp.name,
      description: camp.description ?? undefined,
    },
  };
}

export default async function CampPage({params}: Props) {
  const {slug} = await params;

  const camp = await getCampBySlug(slug);
  if (!camp) notFound();

  const weeks = await getCurriculum(camp.id);
  const viewer = await getViewer();

  /*
   * Kullanıcının ilerlemesi ZİNCİRDEN okunur.
   * RPC düşerse sayfa çalışmaya devam etsin — ilerleme gösterilmez, o kadar.
   */
  let progress: boolean[] | null = null;
  if (viewer.address) {
    progress = await readProgress(
      viewer.address as `0x${string}`,
      camp.id,
      camp.weekCount,
    ).catch(() => null);
  }

  /*
   * İlerleme kapısı: hangi haftalar açık?
   *
   * Bu bilgi kartlarda KİLİT SEBEBİ olarak gösteriliyor — hafta başlıkları
   * zaten herkese açık, gizlenen ders içeriği. "Kilitli" demek yerine
   * "3. haftanın notunu bırak" demek kullanıcıya ne yapacağını söylüyor.
   */
  const campProgress = await getProgressForViewer(camp, viewer);

  /* Haftaları aşamalara göre grupla (Notion'daki "1. AŞAMA" / "1. AY") */
  const groups = new Map<string, typeof weeks>();
  for (const week of weeks) {
    const key = week.stage ?? "";
    const list = groups.get(key) ?? [];
    list.push(week);
    groups.set(key, list);
  }

  return (
    <Container className="py-12 md:py-16">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {camp.name}
          </h1>
          <Pill tone={camp.active ? "accent" : "muted"}>
            {camp.weekCount} {t.camp.weeks}
          </Pill>
        </div>

        {camp.description && (
          <p className="mt-4 text-lg leading-relaxed text-fg-secondary">
            {camp.description}
          </p>
        )}

        {progress && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">İlerlemen</p>
            <ProgressBoxes progress={progress} />
          </div>
        )}
      </header>

      {/*
        Ortak notlar tanıtımı. Müfredatın ÜSTÜNDE duruyor çünkü kampı
        inceleyen kişinin bilmesi gereken bir şey: burada yalnız değilsin.
      */}
      <section className="mt-8 rounded-lg border border-line-accent bg-subtle p-5 md:p-6">
        <h2 className="text-lg font-bold tracking-tight">
          <span aria-hidden="true">📓</span> Bu kampta yalnız değilsin
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-secondary">
          Her haftanın bir <strong className="text-fg">ortak not defteri</strong>{" "}
          var. Katılımcılar takıldıkları yerleri, anlamadıkları terimlerin
          açıklamalarını ve işlerine yarayan kaynakları oraya yazıyor. Dersi
          çalışırken defteri yan sekmede açık tutabilir, bir yerde tıkandığında
          senden önce aynı yerde tıkanmış birinin çözümünü okuyabilirsin.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-secondary">
          Defter böyle büyüyor: haftanın rozetini alırken sen de bir not
          bırakıyorsun, o not bir sonraki haftayı açıyor.
        </p>
        <Link
          href={`/kamplar/${camp.slug}/notlar`}
          className="mt-3 inline-block text-sm font-semibold text-accent-text underline underline-offset-4"
        >
          Ortak notlara git →
        </Link>
      </section>

      {weeks.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title={t.camp.noWeeksYet}
            description="İçerik hazırlanıyor. Kısa süre içinde burada olacak."
          />
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-12">
          {[...groups.entries()].map(([stage, stageWeeks]) => (
            <section key={stage || "default"}>
              {stage && (
                <h2 className="mb-4 text-lg font-bold tracking-tight text-fg-secondary">
                  {stage}
                </h2>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stageWeeks.map((week) => (
                  <WeekCard
                    key={week.id}
                    campSlug={camp.slug}
                    weekNumber={week.weekNumber}
                    title={week.title}
                    teaser={week.teaser}
                    isPublic={camp.publicWeekNumber === week.weekNumber}
                    owned={progress?.[week.weekNumber - 1] ?? false}
                    lock={cardLock(campProgress, week.weekNumber)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Container>
  );
}

/**
 * `CampProgress` → hafta kartının kilit rozeti.
 *
 * `weekLock` beş durum döner; kart yalnızca üçünü çizer. Kimlik sebepleri
 * ("cüzdan yok", "nick yok") burada ilgisiz: müfredat sayfası zaten herkese
 * açık ve o kişiler için hiçbir hafta "kilitli" gösterilmemeli — henüz
 * kampta değiller.
 */
function cardLock(
  campProgress: Awaited<ReturnType<typeof getProgressForViewer>>,
  weekNumber: number,
):
  | {kind: "not-approved"}
  | {kind: "not-reached"}
  | {kind: "note-required"; blockingWeek: number}
  | undefined {
  const lock = weekLock(campProgress, weekNumber);

  switch (lock.kind) {
    case "open":
      return undefined;
    case "not-approved":
      return {kind: "not-approved"};
    case "not-reached":
      return {kind: "not-reached"};
    case "note-required":
      return {kind: "note-required", blockingWeek: lock.blockingWeek};
  }
}
