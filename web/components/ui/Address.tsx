"use client";

/**
 * Cüzdan adresi gösterimi — brand.md §7.5 ve §9.5
 *
 * İKİ KURAL:
 *   1. Adresler HER ZAMAN mono font + kısaltma (ilk 6 + son 4)
 *   2. Nick varsa NİCK ÖNDE, adres altta ikincil bilgi olarak
 *      (brand.md §9.5: "Kimlik nick'tir, adres ikincildir")
 */
import {useState} from "react";

import {explorerAddressUrl} from "@/lib/chain/config";
import {t} from "@/lib/i18n";

/** 0x1a2b3c…9f8e */
export function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AddressChip({
  address,
  nickname,
  showExplorer = true,
  className = "",
}: {
  address: string;
  nickname?: string;
  showExplorer?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      // 2 saniye sonra normale dön (brand.md §7.5)
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi reddedildi — sessizce geç, kullanıcı elle seçebilir */
    }
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex flex-col leading-tight">
        {nickname && <span className="font-semibold">{nickname}</span>}
        <span
          className={[
            "mono text-sm",
            nickname ? "text-[color:var(--fg-muted)]" : "text-[color:var(--fg-primary)]",
          ].join(" ")}
        >
          {shortenAddress(address)}
        </span>
      </span>

      <button
        type="button"
        onClick={copy}
        title={copied ? t.wallet.copied : t.wallet.copyAddress}
        aria-label={copied ? t.wallet.copied : t.wallet.copyAddress}
        className="rounded-[var(--radius-sm)] p-1 text-[color:var(--fg-muted)] transition-colors hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--fg-primary)]"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>

      {showExplorer && (
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          title={t.wallet.viewOnExplorer}
          aria-label={t.wallet.viewOnExplorer}
          className="rounded-[var(--radius-sm)] p-1 text-[color:var(--fg-muted)] transition-colors hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--fg-primary)]"
        >
          <ExternalIcon />
        </a>
      )}
    </span>
  );
}

/* Lucide ikon setinden, 1.75 çizgi kalınlığı (brand.md §11) */

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--success)]"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
