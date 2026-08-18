"use client";

/**
 * Tek tıklamalı cüzdan girişi.
 *
 * Düğme, useAuth içindeki birleşik akışı başlatır:
 * cüzdanı bağla → gerekiyorsa ağı değiştir → SIWE mesajını imzala.
 * Kullanıcı cüzdanında gerekli güvenlik onaylarını görür ama sitede ayrıca
 * "Giriş İçin İmzala" düğmesine basmaz.
 */
import {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";

import {Button, type ButtonProps} from "@/components/ui/Button";
import {shortenAddress} from "@/components/ui/Address";
import {activeChain} from "@/lib/chain/config";
import {useAuth} from "@/lib/hooks/useAuth";
import {fmt, t} from "@/lib/i18n";

export function ConnectButton() {
  const router = useRouter();
  const {
    isConnected,
    session,
    isLoadingSession,
    isWalletReady,
    hasWallet,
    needsSignIn,
    wrongNetwork,
    authenticate,
    changeAccount,
    signOut,
    disconnect,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function chooseAnotherWallet() {
    try {
      authenticate.reset();
      await changeAccount.mutateAsync();
      setMenuOpen(false);
      router.refresh();
    } catch {
      // Hata düğmenin/menünün hemen yanında gösterilir.
    }
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  if ((isLoadingSession && !isConnected) || !isWalletReady) {
    return <div className="h-10 w-36 animate-pulse rounded-md bg-subtle" />;
  }

  /* Aktif cüzdanla oturum uyuşmuyorsa veya ağ yanlışsa aynı birleşik akış. */
  if (needsSignIn || (isConnected && wrongNetwork)) {
    return (
      <div ref={wrapperRef} className="relative flex items-center gap-2">
        <Button
          variant={wrongNetwork ? "danger" : "accent"}
          loading={authenticate.isPending}
          onClick={() => {
            changeAccount.reset();
            authenticate.mutate(undefined);
          }}
          title={t.wallet.signInHint}
        >
          {authenticate.isPending
            ? t.wallet.signingIn
            : wrongNetwork
              ? fmt(t.wallet.switchNetwork, {network: activeChain.name})
              : t.wallet.connect}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          loading={changeAccount.isPending}
          onClick={() => void chooseAnotherWallet()}
        >
          {changeAccount.isPending ? t.wallet.changing : t.wallet.change}
        </Button>
        <AuthError error={changeAccount.error ?? authenticate.error} />
      </div>
    );
  }

  if (session?.address) {
    return (
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 transition-colors hover:border-line-accent"
        >
          <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
          <span className="flex flex-col items-start leading-none">
            {session.nickname ? (
              <>
                <span className="text-sm font-semibold">{session.nickname}</span>
                <span className="mono text-[11px] text-fg-muted">
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
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-elevated shadow-[var(--shadow-lg)]"
          >
            {!session.hasNickname && (
              <Link
                href="/katil"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block border-b border-line px-4 py-3 text-sm font-semibold text-accent-text hover:bg-subtle"
              >
                {t.locked.noNickname.cta}
              </Link>
            )}

            <Link
              href="/profil"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm hover:bg-subtle"
            >
              {t.nav.profile}
            </Link>

            {session.isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm hover:bg-subtle"
              >
                {t.nav.admin}
              </Link>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={changeAccount.isPending}
              onClick={() => void chooseAnotherWallet()}
              className="block w-full border-t border-line px-4 py-3 text-left text-sm text-fg-secondary hover:bg-subtle hover:text-fg disabled:opacity-50"
            >
              {changeAccount.isPending ? t.wallet.changing : t.wallet.change}
            </button>

            {changeAccount.error && (
              <p
                role="alert"
                className="border-t border-danger px-4 py-3 text-xs leading-relaxed text-danger"
              >
                {changeAccount.error.message}
              </p>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                signOut.mutate();
                disconnect();
              }}
              className="block w-full border-t border-line px-4 py-3 text-left text-sm text-fg-secondary hover:bg-subtle hover:text-fg"
            >
              {t.wallet.disconnect}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 font-semibold text-accent-fg"
        title={t.wallet.noWalletHelp}
      >
        {t.wallet.installMetamask}
      </a>
    );
  }

  return (
    <div ref={wrapperRef} className="relative flex items-center gap-2">
      <Button
        variant="accent"
        loading={authenticate.isPending}
        onClick={() => {
          changeAccount.reset();
          authenticate.mutate(undefined);
        }}
      >
        {authenticate.isPending ? t.wallet.signingIn : t.wallet.connect}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        loading={changeAccount.isPending}
        onClick={() => void chooseAnotherWallet()}
      >
        {changeAccount.isPending ? t.wallet.changing : t.wallet.change}
      </Button>
      <AuthError error={changeAccount.error ?? authenticate.error} />
    </div>
  );
}

/**
 * Sunucuda kilitli gösterilen bir sayfadaki CTA. Önce bağlantı ve imzayı
 * tamamlar, sonra bilgi formuna/geçiş hedefine götürür. Böylece /katil
 * sayfasında kullanıcıya ikinci kez "Cüzdanını Bağla" denmez.
 */
export function WalletGateButton({
  continueTo,
  children,
  variant = "accent",
  size = "lg",
  ...buttonProps
}: {
  continueTo: string;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
} & Omit<ButtonProps, "children" | "onClick" | "loading">) {
  const router = useRouter();
  const {session, needsSignIn, authenticate} = useAuth();

  async function continueAfterAuthentication() {
    try {
      if (!session?.address || needsSignIn) {
        await authenticate.mutateAsync(undefined);
      }
      router.push(continueTo);
      router.refresh();
    } catch {
      // Mutation hatayı CTA'nın hemen altında gösterir; yönlendirme yapılmaz.
    }
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <Button
        {...buttonProps}
        variant={variant}
        size={size}
        loading={authenticate.isPending}
        onClick={() => void continueAfterAuthentication()}
      >
        {authenticate.isPending ? t.wallet.signingIn : children}
      </Button>
      <AuthError error={authenticate.error} centered />
    </div>
  );
}

function AuthError({
  error,
  centered = false,
}: {
  error: Error | null;
  centered?: boolean;
}) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className={`absolute top-full z-50 mt-2 w-72 rounded-md border border-danger bg-elevated p-2 text-xs text-danger shadow-[var(--shadow-lg)] ${
        centered ? "left-1/2 -translate-x-1/2 text-center" : "right-0"
      }`}
    >
      {error.message}
    </p>
  );
}
