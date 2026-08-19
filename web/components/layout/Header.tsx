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
import {useState} from "react";

import {ConnectButton} from "@/components/wallet/ConnectButton";
import {Container} from "@/components/ui/Card";
import {useAuth} from "@/lib/hooks/useAuth";
import {t} from "@/lib/i18n";
import {ThemeToggle} from "./ThemeToggle";

const LINKS = [
  {href: "/kamplar", label: t.nav.camps},
  {href: "/siralama", label: t.nav.leaderboard},
  {href: "/portfolyo", label: "Portfolyolar"},
] as const;

export function Header() {
  const pathname = usePathname();
  const {session} = useAuth();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  // Route değişince önceki yol artık eşleşmez ve menü etkisiz biçimde kapanır.
  const open = menuPath === pathname;

  const links = [
    ...LINKS,
    ...(session?.address ? [{href: "/profil", label: t.nav.profile}] : []),
    ...(session?.address ? [{href: "/egitmen", label: "Eğitmen"}] : []),
    ...(session?.isAdmin ? [{href: "/admin", label: t.nav.admin}] : []),
  ];

  return (
    <header className="site-header sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <Container>
        <div className="flex h-[var(--header-height)] items-center justify-between gap-4">
          <Link
            href="/"
            className="brand-mark flex items-center gap-2.5 font-[family-name:var(--font-heading)] font-extrabold tracking-tight"
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
                    "site-nav-link rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-subtle text-fg"
                      : "text-fg-secondary hover:bg-subtle hover:text-fg",
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
              onClick={() => setMenuPath(open ? null : pathname)}
              aria-expanded={open}
              aria-label="Menü"
              className="grid h-9 w-9 place-items-center rounded-md text-fg-secondary transition-colors hover:bg-subtle md:hidden"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <nav
          className="reveal-soft border-t border-line bg-surface/95 backdrop-blur md:hidden"
          aria-label="Mobil menü"
        >
          <Container className="flex flex-col py-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-sm font-medium text-fg-secondary hover:bg-subtle hover:text-fg"
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

/**
 * Kulüp logosu.
 *
 * `public/logo.png` dosyası varsa onu gösterir; yoksa (henüz eklenmediyse
 * veya yüklenemezse) mor kare içinde "P" yer tutucusuna düşer.
 *
 * NEDEN `next/image` DEĞİL: `next/image` olmayan bir dosyada çalışma anında
 * hata verir ve sayfayı bozar. Düz `<img>` + `onError` ile logo eksikken de
 * site sorunsuz açılır — dosya eklendiği an kendiliğinden görünür.
 */
function Logo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-extrabold text-accent-fg"
        aria-hidden="true"
      >
        P
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      width={36}
      height={36}
      onError={() => setFailed(true)}
      className="h-9 w-9 rounded-full"
    />
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
