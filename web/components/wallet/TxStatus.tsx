"use client";

/**
 * İşlem durumu göstergesi — brand.md §7.7
 *
 * Dört durumun HER BİRİ görünür. Özellikle `pending` durumunda işlem hash'i
 * ve BaseScan bağlantısı HER ZAMAN gösterilir: kullanıcı ne olduğunu kendi
 * gözüyle doğrulayabilmeli, bize inanmak zorunda kalmamalı.
 */
import {Spinner} from "@/components/ui/Button";
import {explorerTxUrl} from "@/lib/chain/config";
import type {TxState} from "@/lib/hooks/useTransaction";
import {t} from "@/lib/i18n";

export function TxStatus({
  state,
  hash,
  error,
  successMessage,
  onRetry,
}: {
  state: TxState;
  hash?: `0x${string}`;
  error?: string | null;
  successMessage?: string;
  onRetry?: () => void;
}) {
  if (state === "idle") return null;

  if (state === "awaiting-signature") {
    return (
      <Box tone="info">
        <Spinner />
        <div>
          <p className="font-semibold">{t.tx.awaitingSignature}</p>
          <p className="text-sm text-fg-secondary">
            Cüzdan penceresini kontrol et.
          </p>
        </div>
      </Box>
    );
  }

  if (state === "pending") {
    return (
      <Box tone="info">
        <Spinner />
        <div className="min-w-0">
          <p className="font-semibold">{t.tx.pending}</p>
          {hash && (
            <a
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mono block truncate text-sm text-accent-text underline underline-offset-2"
            >
              {hash.slice(0, 18)}… · {t.tx.viewTx}
            </a>
          )}
        </div>
      </Box>
    );
  }

  if (state === "success") {
    return (
      <Box tone="success">
        <CheckIcon />
        <div className="min-w-0">
          <p className="font-semibold">{successMessage ?? t.tx.success}</p>
          {hash && (
            <a
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mono block truncate text-sm underline underline-offset-2 opacity-80"
            >
              {t.tx.viewTx} →
            </a>
          )}
        </div>
      </Box>
    );
  }

  /* error */
  return (
    <Box tone="danger">
      <AlertIcon />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t.tx.error}</p>
        <p className="text-sm">{error ?? t.errors.unknown}</p>

        {hash && (
          <a
            href={explorerTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mono mt-1 block truncate text-xs underline underline-offset-2 opacity-80"
          >
            {t.tx.viewTx} →
          </a>
        )}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-sm font-semibold underline underline-offset-2"
          >
            {t.tx.retry}
          </button>
        )}
      </div>
    </Box>
  );
}

function Box({
  tone,
  children,
}: {
  tone: "info" | "success" | "danger";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-line-accent text-fg",
    success: "border-success text-success",
    danger: "border-danger text-danger",
  } as const;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border bg-subtle p-4 ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
