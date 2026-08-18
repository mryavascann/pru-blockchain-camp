import Link from "next/link";

import {ButtonLink} from "@/components/ui/Button";
import {Container, EmptyState, Pill} from "@/components/ui/Card";
import {WalletGateButton} from "@/components/wallet/ConnectButton";
import {getViewer} from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Eğitmen Stüdyosu",
  robots: {index: false, follow: false},
};

export default async function InstructorLayout({children}: {children: React.ReactNode}) {
  const viewer = await getViewer();

  if (!viewer.address) {
    return (
      <Container prose className="py-16">
        <EmptyState
          title="Eğitmen stüdyosu için giriş yap"
          description="Kampını cüzdan adresine bağlamak ve yalnızca senin yönetebilmeni sağlamak için ücretsiz bir giriş imzası gerekiyor."
          action={
            <WalletGateButton continueTo="/egitmen" size="md">
              Cüzdanla giriş yap
            </WalletGateButton>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="py-10 md:py-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              Eğitmen Stüdyosu
            </h1>
            <Pill tone="accent">{viewer.nickname || "eğitmen"}</Pill>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-fg-secondary">
            Kampını kur, haftaları ve NFT görsellerini hazırla, öğrencilerini tek yerden izle.
          </p>
        </div>
        <div className="flex gap-2">
          {viewer.isAdmin && (
            <ButtonLink href="/admin/egitmen-kamplari" size="sm" variant="secondary">
              Platform incelemesi
            </ButtonLink>
          )}
          <Link href="/" className="self-center text-sm text-fg-secondary underline underline-offset-4">
            Siteye dön
          </Link>
        </div>
      </header>

      {children}
    </Container>
  );
}

