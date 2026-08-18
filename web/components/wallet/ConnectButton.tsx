"use client";

/**
 * ============================================================================
 * Cüzdan bağlantı düğmesi — beş durum
 *
 *   1. Cüzdan yok           → "MetaMask'i Kur" yönlendirmesi
 *   2. Bağlı değil          → "Cüzdanını Bağla"
 *   3. Yanlış ağ            → "Base Sepolia'ya geç"  (brand.md §9.4)
 *   4. Bağlı, imza yok      → "Giriş İçin İmzala"
 *   5. Giriş yapılmış       → nick + adres + menü
 *
 * brand.md §9.4: "Yanlış ağ engel değil, tek tık." Kullanıcıyı kilitlemek
 * yerine tek düğmeyle çözüm sunuyoruz.
 * ============================================================================
 */
import {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useConnect, useDisconnect, useSwitchChain} from "wagmi";

import {Button, Spinner} from "@/components/ui/Button";
import {shortenAddress} from "@/components/ui/Address";
import {useAuth} from "@/lib/hooks/useAuth";
import {expectedChain} from "@/lib/wagmi";
import {fmt, t} from "@/lib/i18n";

export function ConnectButton() {
  const {
    isConnected,
    walletAddress,
    session,
    isLoadingSession,
    needsSignIn,
    wrongNetwork,
    signIn,
    signOut,
  } = useAuth();

  const {connect, connectors, isPending: isConnecting} = useConnect();
  const {disconnect} = useDisconnect();
  const {switchChain, isPending: isSwitching} = useSwitchChain();

  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* Dışarı tıklayınca menüleri kapat */
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  /* Sunucudan oturum bilgisi gelene kadar düzen zıplamasın */
  if (isLoadingSession && !isConnected) {
    return <div className="h-10 w-36 animate-pulse rounded-[var(--radius-md)] bg-[color:var(--bg-subtle)]" />;
  }

  /* ---- 3. Yanlış ağ ---- */
  if (isConnected && wrongNetwork) {
    return (
      <Button
        variant="danger"
        loading={isSwitching}
        onClick={() => switchChain({chainId: expectedChain.id})}
      >
        {isSwitching
          ? t.wallet.switching
          : fmt(t.wallet.switchNetwork, {network: expectedChain.name})}
      </Button>
    );
  }

  /* ---- 4. Bağlı ama imza atılmamış ---- */
  if (isConnected && needsSignIn) {
    return (
      <div ref={wrapperRef} className="flex items-center gap-2">
        <Button
          variant="accent"
          loading={signIn.isPending}
          onClick={() => signIn.mutate()}
          title={t.wallet.signInHint}
        >
          {signIn.isPending ? t.wallet.signingIn : t.wallet.signIn}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => disconnect()}>
          {t.wallet.disconnect}
        </Button>
      </div>
    );
  }

  /* ---- 5. Giriş yapılmış ---- */
  if (session?.address) {
    return (
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-3 transition-colors hover:border-[color:var(--border-accent)]"
        >
          <span className="h-2 w-2 rounded-full bg-[color:var(--accent)]" aria-hidden="true" />
          <span className="flex flex-col items-start leading-none">
            {session.nickname ? (
              <>
                <span className="text-sm font-semibold">{session.nickname}</span>
                <span className="mono text-[11px] text-[color:var(--fg-muted)]">
                  {shortenAddress(session.address)}
                </span>
              </>
            ) : (
              <span className="mono text-sm">{shortenAddress(session.address)}</span>
            )}
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-[var(--shadow-lg)]"
          >
            {!session.hasNickname && (
              <Link
                href="/katil"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block border-b border-[color:var(--border-subtle)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-text)] hover:bg-[color:var(--bg-subtle)]"
              >
                {t.locked.noNickname.cta}
              </Link>
            )}

            <Link
              href="/profil"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm hover:bg-[color:var(--bg-subtle)]"
            >
              {t.nav.profile}
            </Link>

            {session.isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-[color:var(--bg-subtle)]"
              >
                {t.nav.admin}
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                signOut.mutate();
                disconnect();
              }}
              className="block w-full border-t border-[color:var(--border-subtle)] px-4 py-3 text-left text-sm text-[color:var(--fg-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--fg-primary)]"
            >
              {t.wallet.disconnect}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ---- 1 & 2. Bağlı değil ---- */
  const injectedConnector = connectors.find((c) => c.id === "injected");
  const hasInjectedWallet =
    typeof window !== "undefined" && "ethereum" in window;

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="accent"
        loading={isConnecting}
        onClick={() => {
          // Tek cüzdan varsa seçim ekranı göstermeye gerek yok
          if (hasInjectedWallet && injectedConnector && connectors.length <= 2) {
            connect({connector: injectedConnector});
          } else {
            setPickerOpen((open) => !open);
          }
        }}
      >
        {isConnecting ? t.wallet.connecting : t.wallet.connect}
      </Button>

      {pickerOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-[var(--shadow-lg)]">
          {!hasInjectedWallet && (
            <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
              <p className="text-sm font-semibold">{t.wallet.noWallet}</p>
              <p className="mt-1 text-xs text-[color:var(--fg-secondary)]">
                {t.wallet.noWalletHelp}
              </p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-[color:var(--accent-text)] underline underline-offset-2"
              >
                {t.wallet.installMetamask} →
              </a>
            </div>
          )}

          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              onClick={() => {
                connect({connector});
                setPickerOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[color:var(--bg-subtle)]"
            >
              {connector.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={connector.icon} alt="" width={20} height={20} />
              )}
              <span>{connector.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** İmza sürecini gösteren küçük yardımcı — form içi kullanım için */
export function SignInPrompt() {
  const {signIn, needsSignIn} = useAuth();
  if (!needsSignIn) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[color:var(--border-accent)] bg-[color:var(--bg-subtle)] p-4">
      <p className="text-sm">{t.wallet.signInHint}</p>
      <Button
        variant="accent"
        loading={signIn.isPending}
        onClick={() => signIn.mutate()}
      >
        {signIn.isPending ? (
          <>
            <Spinner /> {t.wallet.signingIn}
          </>
        ) : (
          t.wallet.signIn
        )}
      </Button>
      {signIn.isError && (
        <p className="text-sm text-[color:var(--danger)]">{signIn.error.message}</p>
      )}
    </div>
  );
}
