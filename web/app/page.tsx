/**
 * Landing sayfası — HERKESE AÇIK, SEO'ya açık.
 *
 * Cüzdan gerektirmez. brand.md §9.1: "Cüzdan hiçbir zaman kapıda zorlanmaz."
 * Ziyaretçi kulübü ve kampları tanır, örnek haftayı okur, ancak kilitli bir
 * şeye uzandığında bağlantı istenir.
 *
 * Sunucu bileşeni: veriyi doğrudan veritabanından okur, API'ye HTTP isteği
 * atmaz. Aynı süreç içinde olduğu için daha hızlı ve ek bir ağ turu yok.
 */

import {HackathonSpotlight} from "@/components/home/HackathonSpotlight";
import {LearningChainArt} from "@/components/home/LearningChainArt";
import {ButtonLink} from "@/components/ui/Button";
import {Card, Container, Pill} from "@/components/ui/Card";
import {listCamps} from "@/lib/content/access";
import {t} from "@/lib/i18n";

export const revalidate = 300;

export default async function HomePage() {
  const camps = await listCamps();

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* HERO                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <Container className="relative grid items-center gap-6 py-16 md:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)] lg:gap-4 lg:py-24">
          <div className="relative z-10 max-w-3xl lg:max-w-[680px]">
            <Pill tone="accent">{t.site.university}</Pill>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Kampı tamamla,
              <br />
              rozetin{" "}
              <span className="text-accent-text">zincirde</span> kalsın.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-secondary">
              {t.site.name} kamplarında her haftayı tamamladığında, o haftaya
              ait devredilemez bir rozet kazanırsın. Rozetler cüzdanında durur;
              satılamaz, devredilemez, kaybolmaz.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/kamplar" variant="accent" size="lg">
                {t.nav.camps} →
              </ButtonLink>
              <ButtonLink href="/siralama" variant="secondary" size="lg">
                {t.nav.leaderboard}
              </ButtonLink>
            </div>
          </div>

          <LearningChainArt />
        </Container>
      </section>

      {/* Hackathon görsel/ürün vitrini: tek bileşen olarak geri alınabilir. */}
      <HackathonSpotlight />

      {/* ---------------------------------------------------------------- */}
      {/* KAMPLAR                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Container className="py-16 md:py-24">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Kamp Programları
        </h2>
        <p className="mt-2 text-fg-secondary">
          Müfredat herkese açık. İçeriğe erişmek için kampa katılman yeterli.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {camps.map((camp) => (
            <Card key={camp.id} interactive>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  {camp.coverAssetId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${camp.coverAssetId}`}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    {camp.instructorName && (
                      <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                        {camp.instructorName}
                      </p>
                    )}
                    <h3 className="text-xl font-bold tracking-tight">{camp.name}</h3>
                  </div>
                </div>
                <Pill tone={camp.active ? "accent" : "muted"}>
                  {camp.weekCount} {t.camp.weeks}
                </Pill>
              </div>

              {camp.description && (
                <p className="mt-3 text-fg-secondary">
                  {camp.description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href={`/kamplar/${camp.slug}`} variant="secondary">
                  {t.camp.viewCamp}
                </ButtonLink>

                {/* Herkese açık örnek hafta — vitrin (Faz 0 şartı) */}
                {camp.publicWeekNumber !== null && (
                  <ButtonLink
                    href={`/kamplar/${camp.slug}/hafta/${camp.publicWeekNumber}`}
                    variant="ghost"
                  >
                    🌐 {t.locked.sampleLink} →
                  </ButtonLink>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Container>

      {/* ---------------------------------------------------------------- */}
      {/* NASIL ÇALIŞIR                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-line bg-surface">
        <Container className="py-16 md:py-24">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Nasıl çalışıyor?
          </h2>

          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              {
                n: "1",
                title: "Cüzdanını bağla",
                text: "Bir mesaj imzalarsın. Ücretsizdir — zincire işlem gitmez, gas ödemezsin.",
              },
              {
                n: "2",
                title: "Nick seç",
                text: "Sıralamada görüneceğin isim. Cüzdanına zincir üzerinde bağlanır.",
              },
              {
                n: "3",
                title: "Haftanı bildir",
                text: "Kaçıncı haftada olduğunu söylersin. Kulüp yöneticisi onaylar.",
              },
              {
                n: "4",
                title: "Rozetlerini al",
                text: "Onaylanan haftaların rozetlerini tek işlemde cüzdanına basarsın.",
              },
            ].map((step) => (
              <li key={step.n}>
                <span
                  className="grid h-9 w-9 place-items-center rounded-full bg-accent font-bold text-accent-fg"
                  aria-hidden="true"
                >
                  {step.n}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-fg-secondary">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>

          {/*
            DÜRÜSTLÜK NOTU — Faz 0'da kararlaştırıldı.
            Sistem "trustless" değil; rozetlerin değeri kulübün itibarına
            dayanıyor. Bunu gizlemek yerine açıkça yazıyoruz.
          */}
          <p className="mt-10 max-w-2xl text-sm text-fg-muted">
            Rozetler PRU Blockchain Kulübü tarafından onaylanır ve Base ağında
            saklanır. Kulüp, hangi katılımcının hangi haftayı tamamladığını
            belirleyen taraftır; tüm yönetim işlemleri zincirde açıkça
            görülebilir.
          </p>
        </Container>
      </section>
    </>
  );
}
