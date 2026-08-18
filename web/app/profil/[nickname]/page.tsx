import type {Metadata} from "next";
import {notFound} from "next/navigation";

import {ButtonLink} from "@/components/ui/Button";
import {Card, Container, EmptyState, Pill} from "@/components/ui/Card";
import {ProgressBoxes} from "@/components/ui/Progress";
import {getPublicPortfolio} from "@/lib/portfolio";
import {SharePortfolio} from "./SharePortfolio";

type Props = {params: Promise<{nickname: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {nickname} = await params;
  const portfolio = await getPublicPortfolio(nickname);
  if (!portfolio) return {title: "Portfolyo bulunamadı", robots: {index: false}};
  return {
    title: `${portfolio.nickname} · Kamp Portfolyosu`,
    description: `${portfolio.nickname}, ${portfolio.camps.length} kampta ilerliyor ve ${portfolio.completedCampCount} kamp tamamladı.`,
    openGraph: {
      title: `${portfolio.nickname} · PRU Kamp Portfolyosu`,
      description: `${portfolio.totalBadges} zincir üstü rozet · ${portfolio.completedCampCount} tamamlanan kamp`,
    },
  };
}

export default async function PublicPortfolioPage({params}: Props) {
  const {nickname} = await params;
  const portfolio = await getPublicPortfolio(nickname);
  if (!portfolio) notFound();

  return (
    <Container className="py-12 md:py-16">
      <header className="relative overflow-hidden rounded-2xl border border-line-accent bg-surface p-6 md:p-10">
        <div aria-hidden="true" className="portfolio-orbit" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-text">Kamp Portfolyosu</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">{portfolio.nickname}</h1>
            <p className="mt-2 font-mono text-sm text-fg-muted">{portfolio.maskedAddress}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Stat value={portfolio.totalBadges} label="zincir rozeti" />
            <Stat value={portfolio.completedCampCount} label="tamamlanan kamp" />
            <Stat value={portfolio.noteCount} label="topluluk notu" />
          </div>
        </div>
        <div className="relative mt-6"><SharePortfolio /></div>
      </header>

      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Öğrenme yolculuğu</h2>
            <p className="mt-1 text-sm text-fg-secondary">Onaylı ilerleme ve cüzdana alınmış haftalık rozetler.</p>
          </div>
          <ButtonLink href="/portfolyo" size="sm" variant="secondary">Başka bir nick ara</ButtonLink>
        </div>

        {portfolio.camps.length === 0 ? (
          <EmptyState title="Henüz görünür kamp ilerlemesi yok" description="Onaylanan kamp başvuruları burada görünmeye başlayacak." />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {portfolio.camps.map((camp) => (
              <Card key={camp.slug} interactive>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {camp.instructorName && <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{camp.instructorName}</p>}
                    <h3 className="mt-1 text-xl font-bold">{camp.name}</h3>
                  </div>
                  <Pill tone={camp.completed ? "reward" : "accent"}>{camp.completed ? "Tamamlandı ✓" : `${camp.currentWeek}. hafta`}</Pill>
                </div>
                <div className="mt-5"><ProgressBoxes progress={camp.progress} /></div>
                <div className="mt-4 flex items-center justify-between text-sm text-fg-secondary">
                  <span>{camp.currentWeek}/{camp.weekCount} hafta</span>
                  <span>{camp.earnedBadges} NFT rozet</span>
                </div>
                <div className="mt-5"><ButtonLink href={`/kamplar/${camp.slug}`} size="sm" variant="secondary">Kampı incele →</ButtonLink></div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </Container>
  );
}

function Stat({value, label}: {value: number; label: string}) {
  return <div className="min-w-28 rounded-lg border border-line bg-subtle px-4 py-3 text-right"><p className="text-2xl font-extrabold text-accent-text">{value}</p><p className="text-xs text-fg-secondary">{label}</p></div>;
}

