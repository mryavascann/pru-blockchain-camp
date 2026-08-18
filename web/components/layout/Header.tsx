"use client";

/**
 * Site başlığı — brand.md §6 (64px sabit yükseklik, sticky)
 *
 * MOBİL ÖNCELİKLİ: Menü mobilde açılır panel, ≥768px'te yatay. Cüzdan
 * düğmesi HER ZAMAN görünür — mobilde menünün içine gizlenmez, çünkü
 * kullanıcının en sık ihtiyaç duyacağı eylem odur.
 */
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect, useState} from "react";

import {ConnectButton} from "@/components/wallet/ConnectButton";
import {Container} from "@/components/ui/Card";
import {useAuth} from "@/lib/hooks/useAuth";
import {t} from "@/lib/i18n";
import {ThemeToggle} from "./ThemeToggle";

const LINKS = [
  {href: "/kamplar", label: t.nav.camps},
  {href: "/siralama", label: t.nav.leaderboard},
] as const;

export function Header() {
  const pathname = usePathname();
  const {session} = useAuth();
  const [open, setOpen] = useState(false);

  /* Sayfa değişince mobil menüyü kapat */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = [
    ...LINKS,
    ...(session?.address ? [{href: "/profil", label: t.nav.profile}] : []),
    ...(session?.isAdmin ? [{href: "/admin", label: t.nav.admin}] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 backdrop-blur">
      <Container>
        <div className="flex h-[var(--header-height)] items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-[family-name:var(--font-heading)] font-extrabold tracking-tight"
          >
            <Logo />
            <span className="hidden sm:inline">{t.site.shortName}</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--bg-subtle)] text-[var(--fg-primary)]"
                      : "text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <ConnectButton />

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label="Menü"
              className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-subtle)] md:hidden"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <nav
          className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] md:hidden"
          aria-label="Mobil menü"
        >
          <Container className="flex flex-col py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium text-[var(--fg-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
              >
                {link.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}

/** Geçici logo — kulüp logosu geldiğinde değişecek (brand.md §12) */
function Logo() {
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] bg-[var(--accent)] text-sm font-extrabold text-[var(--accent-fg)]"
      aria-hidden="true"
    >
      P
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
