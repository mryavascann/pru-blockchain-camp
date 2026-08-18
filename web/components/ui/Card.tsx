/**
 * Kart, etiket ve bölüm başlığı — brand.md §7.2
 *
 * Vurgulu durumlarda KENARLIK KALINLIĞI DEĞİŞMEZ, rengi değişir.
 * Kalınlık değiştirmek 1px'lik bir düzen kaymasına yol açar ve kartlar
 * hover'da titrer.
 */
import type {ReactNode} from "react";

export function Card({
  children,
  className = "",
  accent = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** Turkuaz kenarlık — aktif/seçili/herkese açık durumlar */
  accent?: boolean;
  /** Hover'da yükselsin mi */
  interactive?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[var(--radius-lg)] border bg-[color:var(--bg-surface)]",
        "p-4 md:p-6",
        "shadow-[var(--shadow-sm)]",
        accent
          ? "border-[color:var(--border-accent)]"
          : "border-[color:var(--border-subtle)]",
        interactive
          ? "transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-md)]"
          : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

type PillTone = "neutral" | "accent" | "reward" | "muted" | "danger";

const PILL_TONES: Record<PillTone, string> = {
  neutral:
    "bg-[color:var(--bg-subtle)] text-[color:var(--fg-secondary)] border-[color:var(--border-subtle)]",
  accent:
    "bg-[color:var(--bg-subtle)] text-[color:var(--accent-text)] border-[color:var(--border-accent)]",
  reward:
    "bg-[color:var(--bg-subtle)] text-[color:var(--reward)] border-[color:var(--reward)]",
  muted:
    "bg-transparent text-[color:var(--fg-muted)] border-[color:var(--border-subtle)]",
  danger: "bg-transparent text-[color:var(--danger)] border-[color:var(--danger)]",
};

/** Küçük etiket: "HAFTA 3", "🌐 Herkese Açık", "Bekliyor" */
export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border",
        "px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        PILL_TONES[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** Sayfa içi bölüm başlığı */
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[color:var(--fg-secondary)]">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Sayfa gövdesi için ortak genişlik sarmalayıcısı (brand.md §6) */
export function Container({
  children,
  className = "",
  prose = false,
}: {
  children: ReactNode;
  className?: string;
  /** Okuma genişliği (720px) — uzun metin sayfaları için */
  prose?: boolean;
}) {
  return (
    <div
      className={[
        "mx-auto w-full px-4 md:px-8",
        prose ? "max-w-[var(--prose-max)]" : "max-w-[var(--page-max)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Boş durum — brand.md §9.8: boş durumlar öğretir, sadece "yok" demez */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[color:var(--border-subtle)] px-6 py-12 text-center">
      {icon && <div className="text-[color:var(--fg-muted)]">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-[color:var(--fg-secondary)]">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
