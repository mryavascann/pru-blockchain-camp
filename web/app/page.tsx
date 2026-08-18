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
import Link from "next/link";

import {Button} from "@/components/ui/Button";
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
      <section className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        {/* Dekoratif zemin — içerikten bağımsız, ekran okuyucuya görünmez */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, var(--teal-500) 0, transparent 45%), radial-gradient(circle at 80% 60%, var(--navy-500) 0, transparent 45%)",
          }}
        />

        <Container className="relative py-20 md:py-32">
          <div className="max-w-3xl">
            <Pill tone="accent">{t.site.university}</Pill>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Kampı tamamla,
              <br />
              rozetin{" "}
              <span className="text-[var(--accent-text)]">zincirde</span> kalsın.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--fg-secondary)]">
              {t.site.name} kamplarında her haftayı tamamladığında, o haftaya
              ait devredilemez bir rozet kazanırsın. Rozetler cüzdanında durur;
              satılamaz, devredilemez, kaybolmaz.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/kamplar">
                <Button variant="accent" size="lg">
                  {t.nav.camps} →
                </Button>
              </Link>
              <Link href="/siralama">
                <Button variant="secondary" size="lg">
                  {t.nav.leaderboard}
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* KAMPLAR                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Container className="py-16 md:py-24">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          Kamp Programları
        </h2>
        <p className="mt-2 text-[var(--fg-secondary)]">
          Müfredat herkese açık. İçeriğe erişmek için kampa katılman yeterli.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {camps.map((camp) => (
            <Card key={camp.id} interactive>
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-bold tracking-tight">{camp.name}</h3>
                <Pill tone={camp.active ? "accent" : "muted"}>
                  {camp.weekCount} {t.camp.weeks}
                </Pill>
              </div>

              {camp.description && (
                <p className="mt-3 text-[var(--fg-secondary)]">
                  {camp.description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/kamplar/${camp.slug}`}>
                  <Button variant="secondary">{t.camp.viewCamp}</Button>
                </Link>

                {/* Herkese açık örnek hafta — vitrin (Faz 0 şartı) */}
                {camp.publicWeekNumber !== null && (
                  <Link
                    href={`/kamplar/${camp.slug}/hafta/${camp.publicWeekNumber}`}
                  >
                    <Button variant="ghost">
                      🌐 {t.locked.sampleLink} →
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Container>

      {/* ---------------------------------------------------------------- */}
      {/* NASIL ÇALIŞIR                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
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
                  className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent)] font-bold text-[var(--accent-fg)]"
                  aria-hidden="true"
                >
                  {step.n}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-[var(--fg-secondary)]">
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
          <p className="mt-10 max-w-2xl text-sm text-[var(--fg-muted)]">
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
