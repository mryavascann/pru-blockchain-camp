/**
 * /kamplar/[slug]/notlar — Ortak ders notları
 *
 * ERİŞİM: oturum + nick + en az bir onaylı hafta.
 *
 * Notlar hafta içeriğinden söz eder; dolayısıyla hafta içeriğiyle AYNI
 * kilide tabidir. Sunucu yalnızca `visibleWeek`'e kadar olan notları
 * sorgular — ileri haftaların notları tarayıcıya hiç ulaşmaz.
 *
 * Bu sayfa arama motorlarına KAPALI: kullanıcı üretimi içerik ve kilitli
 * malzeme.
 */
import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";

import {ButtonLink} from "@/components/ui/Button";
import {Container, EmptyState} from "@/components/ui/Card";
import {WalletGateButton} from "@/components/wallet/ConnectButton";
import {NotesGuide} from "@/components/notes/NotesGuide";
import {getCampBySlug, getProgressForViewer} from "@/lib/content/access";
import {getViewer} from "@/lib/auth/guards";
import {listNotes} from "@/lib/notes/service";
import {NotesBoard} from "./NotesBoard";

type Props = {
  params: Promise<{slug: string}>;
  /* Hafta sayfasından ve yönetim panelinden `?hafta=3` ile geliniyor */
  searchParams: Promise<{hafta?: string}>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: Pick<Props, "params">): Promise<Metadata> {
  const {slug} = await params;
  const camp = await getCampBySlug(slug);

  return {
    title: camp ? `Ortak Notlar · ${camp.name}` : "Ortak Notlar",
    robots: {index: false, follow: false, nocache: true},
  };
}

export default async function NotesPage({params, searchParams}: Props) {
  const {slug} = await params;
  const {hafta} = await searchParams;

  const camp = await getCampBySlug(slug);
  if (!camp) notFound();

  const viewer = await getViewer();

  /* ---- Kimlik kapısı ---- */
  if (!viewer.address || (!viewer.hasNickname && !viewer.isAdmin)) {
    return (
      <Container prose className="py-12 md:py-16">
        <Breadcrumb campSlug={camp.slug} campName={camp.name} />
        <EmptyState
          icon={<span className="text-3xl">📓</span>}
          title="Ortak notlar kamp katılımcılarına özel"
          description={
            viewer.address
              ? "Notları görmek ve bırakmak için önce bir nick belirlemen gerekiyor."
              : "Bu kampın katılımcıları burada birbirine not bırakıyor. Görmek için cüzdanını bağla."
          }
          action={
            viewer.address ? (
              <ButtonLink href="/katil" variant="accent" size="lg">
                Nick Belirle
              </ButtonLink>
            ) : (
              <WalletGateButton continueTo="/katil">
                Cüzdanını Bağla
              </WalletGateButton>
            )
          }
        />
      </Container>
    );
  }

  const progress = await getProgressForViewer(camp, viewer);

  /* ---- İlerleme kapısı: onaylı haftası olmayan kişi ---- */
  if (progress.visibleWeek < 1) {
    return (
      <Container prose className="py-12 md:py-16">
        <Breadcrumb campSlug={camp.slug} campName={camp.name} />
        <EmptyState
          icon={<span className="text-3xl">📓</span>}
          title="Henüz onaylı bir haftan yok"
          description={
            "Kaçıncı haftada olduğunu bildirip kulüp yöneticisinin onayını " +
            "aldığında, geldiğin haftaya kadarki tüm notlar açılır."
          }
          action={
            <ButtonLink href="/katil" variant="accent" size="lg">
              Kampa Katıl
            </ButtonLink>
          }
        />
      </Container>
    );
  }

  /*
   * ⚠️ Sorgu sınırı `progress.visibleWeek`. Bu bir arayüz filtresi değil —
   * ileri haftaların notları veritabanından okunmuyor bile.
   */
  const notes = await listNotes(camp.id, progress.visibleWeek, viewer.address);

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumb campSlug={camp.slug} campName={camp.name} />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Ortak Ders Notları
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-fg-secondary">
          {camp.name} katılımcılarının birbirine bıraktığı notlar. Haftanın
          dersini çalışırken bu sayfayı yan sekmede açık tut.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <NotesBoard
          campSlug={camp.slug}
          campName={camp.name}
          weekCount={camp.weekCount}
          initialNotes={notes.map((note) => ({
            ...note,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString(),
          }))}
          initialWeekFilter={
            /*
             * Sınırın dışındaki bir hafta URL'den gelirse yok sayılır.
             * Güvenlik açısından önemsiz (sunucu zaten o notları
             * göndermiyor) ama kullanıcıyı boş bir listeye düşürmesin.
             */
            hafta && Number(hafta) >= 1 && Number(hafta) <= progress.visibleWeek
              ? Number(hafta)
              : undefined
          }
          progress={{
            entitledWeek: progress.entitledWeek,
            entryWeek: progress.entryWeek,
            visibleWeek: progress.visibleWeek,
            owedWeeks: progress.owedWeeks,
            notedWeeks: progress.notedWeeks,
            blockingWeek: progress.blockingWeek,
          }}
        />

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <NotesGuide variant="read" />
        </aside>
      </div>
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
        className="text-fg-secondary hover:text-fg"
      >
        ← {campName}
      </Link>
    </nav>
  );
}
