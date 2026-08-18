import Link from "next/link";

import {Container} from "@/components/ui/Card";
import {contractAddress, explorerAddressUrl, activeChain} from "@/lib/chain/config";
import {t} from "@/lib/i18n";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <Container className="py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <p className="font-[family-name:var(--font-heading)] text-lg font-bold">
              {t.site.name}
            </p>
            <p className="mt-1 text-sm text-fg-secondary">
              {t.site.university}
            </p>
            <p className="mt-3 text-sm text-fg-secondary">
              {t.site.tagline}
            </p>
          </div>

          <nav className="flex flex-col gap-2 text-sm" aria-label="Alt menü">
            <Link href="/kamplar" className="text-fg-secondary hover:text-fg">
              {t.nav.camps}
            </Link>
            <Link href="/siralama" className="text-fg-secondary hover:text-fg">
              {t.nav.leaderboard}
            </Link>
            <Link href="/katil" className="text-fg-secondary hover:text-fg">
              {t.nav.join}
            </Link>
          </nav>
        </div>

        {/*
          Kontrat adresi footer'da açıkça duruyor.
          Rozetlerin doğrulanabilir olması, "bize güvenin" demekten iyidir:
          isteyen zincire bakıp kimin ne aldığını kendi gözüyle görebilir.
        */}
        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-xs text-fg-muted md:flex-row md:items-center md:justify-between">
          <span>
            Kontrat ({activeChain.name}):{" "}
            <a
              href={explorerAddressUrl(contractAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="mono underline underline-offset-2 hover:text-fg-secondary"
            >
              {contractAddress}
            </a>
          </span>
          <span>
            © {new Date().getFullYear()} {t.site.name}
          </span>
        </div>
      </Container>
    </footer>
  );
}
