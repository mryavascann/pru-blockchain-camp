/**
 * /kamplar — Kamp listesi. HERKESE AÇIK, SEO'ya açık.
 */
import type {Metadata} from "next";

import {ButtonLink} from "@/components/ui/Button";
import {Card, Container, EmptyState, Pill} from "@/components/ui/Card";
import {listCamps} from "@/lib/content/access";
import {t} from "@/lib/i18n";

export const revalidate = 300;

export const metadata: Metadata = {
  title: t.nav.camps,
  description:
    "PRU Blockchain Kulübü kamp programları: müfredat, haftalık içerik ve rozet sistemi.",
};

export default async function CampsPage() {
  const camps = await listCamps();

  return (
    <Container className="py-12 md:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
        {t.nav.camps}
      </h1>
      <p className="mt-2 max-w-2xl text-fg-secondary">
        Her kampın müfredatı herkese açıktır. Haftaların içeriğine erişmek için
        kampa katılman gerekir.
      </p>

      {camps.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={t.camp.noWeeksYet}
            description="Kamplar hazırlanıyor. Kısa süre içinde burada olacaklar."
          />
        </div>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {camps.map((camp) => (
            <Card key={camp.id} interactive>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight">{camp.name}</h2>
                <Pill tone={camp.active ? "accent" : "muted"}>
                  {camp.weekCount} {t.camp.weeks}
                </Pill>
              </div>

              {camp.description && (
                <p className="mt-3 text-fg-secondary">
                  {camp.description}
                </p>
              )}

              {!camp.active && (
                <p className="mt-3 text-sm text-warning">
                  {t.camp.inactive}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href={`/kamplar/${camp.slug}`} variant="secondary">
                  {t.camp.curriculum}
                </ButtonLink>
                {camp.publicWeekNumber !== null && (
                  <ButtonLink
                    href={`/kamplar/${camp.slug}/hafta/${camp.publicWeekNumber}`}
                    variant="ghost"
                  >
                    🌐 {t.locked.sampleLink}
                  </ButtonLink>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
