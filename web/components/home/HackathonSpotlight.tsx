/**
 * Hackathon vitrini. Tek bir bileşende izole edildi; görsel yön beğenilmezse
 * ana sayfadaki import ve bu bileşen kaldırılarak geri alınabilir.
 */
import {PortfolioSearch} from "@/app/portfolyo/PortfolioSearch";
import {ButtonLink} from "@/components/ui/Button";
import {Container} from "@/components/ui/Card";
import styles from "./HackathonSpotlight.module.css";

export function HackathonSpotlight() {
  return (
    <section className={`${styles.spotlight} border-b border-line`} aria-labelledby="spotlight-title">
      <Container className="grid gap-6 py-10 lg:grid-cols-[1.1fr_.9fr] lg:items-stretch lg:py-14">
        <div className="relative overflow-hidden rounded-2xl border border-line-accent bg-surface p-6 md:p-8">
          <div className={styles.grid} aria-hidden="true" />
          <div className="relative">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-accent-text">Yeni · Eğitmen Stüdyosu</span>
            <h2 id="spotlight-title" className="mt-4 max-w-lg text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Bilgini haftalara böl. Topluluğunu zincirde büyüt.
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-fg-secondary">
              Kendi kampını, kaynaklarını ve haftalık NFT art&apos;larını tek panelden hazırla. Başvuruları incele, öğrenci ilerlemesini yönet.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/egitmen" variant="accent">Kampını oluştur →</ButtonLink>
              <ButtonLink href="/kamplar" variant="secondary">Açık kampları gör</ButtonLink>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 md:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-line-accent opacity-60" />
          <div aria-hidden="true" className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-line-accent opacity-40" />
          <div className="relative">
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-accent-text">Herkese açık portfolyo</span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">Nicki yaz, öğrenme izini gör.</h2>
            <p className="mt-2 text-sm leading-relaxed text-fg-secondary">Tamamlanan kamplar, bulunulan hafta ve alınan rozetler tek paylaşılabilir profilde.</p>
            <div className="mt-6"><PortfolioSearch compact /></div>
          </div>
        </div>
      </Container>
    </section>
  );
}
