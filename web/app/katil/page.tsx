/**
 * /katil — Kampa katılım sayfası
 *
 * Sunucu bileşeni: kamp listesini veritabanından okur, akışı istemci
 * bileşenine devreder (cüzdan etkileşimi tarayıcıda olmak zorunda).
 */
import type {Metadata} from "next";

import {JoinFlow} from "@/components/onboarding/JoinFlow";
import {Container} from "@/components/ui/Card";
import {listCamps} from "@/lib/content/access";
import {t} from "@/lib/i18n";

export const metadata: Metadata = {
  title: t.onboarding.title,
  description:
    "PRU Blockchain Kulübü kamplarına katıl, tamamladığın haftaların " +
    "devredilemez rozetlerini cüzdanına al.",
};

export default async function JoinPage() {
  const camps = await listCamps();

  return (
    <Container prose className="py-12 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {t.onboarding.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-fg-secondary">
          Üç adım: cüzdanını bağla, kendine bir nick seç, kaçıncı haftada
          olduğunu bildir. Kulüp yöneticisi onayladığında rozetlerin hazır olur.
        </p>
      </header>

      <JoinFlow
        camps={camps.map((camp) => ({
          id: camp.id,
          slug: camp.slug,
          name: camp.name,
          weekCount: camp.weekCount,
          active: camp.active,
        }))}
      />
    </Container>
  );
}
