/**
 * Buton — brand.md §7.1
 *
 * Varyantlar ve ne zaman kullanılacağı:
 *   primary   → sayfadaki TEK ana eylem
 *   accent    → "Rozeti Al", "Cüzdanını Bağla" (turkuaz = doğrulanmış/aktif)
 *   secondary → ikincil eylem
 *   ghost     → üçüncül, tablo içi
 *   danger    → Reddet, Burn, Pause
 *
 * YÜKLENME DURUMUNDA GENİŞLİK SABİT KALIR: metin görünmez yapılır ama
 * yerinde durur, spinner üstüne bindirilir. Aksi hâlde buton daralıp
 * genişler ve etrafındaki düzen zıplar (brand.md §7.1).
 */
import {forwardRef, type ButtonHTMLAttributes} from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-fg)] hover:brightness-110 border border-transparent",
  accent:
    "bg-[var(--accent)] text-[var(--accent-fg)] hover:brightness-110 border border-transparent",
  secondary:
    "bg-[var(--bg-surface)] text-[var(--fg-primary)] border border-[var(--border-strong)] hover:border-[var(--border-accent)]",
  ghost:
    "bg-transparent text-[var(--fg-secondary)] border border-transparent hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]",
  danger:
    "bg-[var(--danger)] text-white hover:brightness-110 border border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-base gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={[
          "relative inline-flex items-center justify-center rounded-[var(--radius-md)]",
          "font-semibold whitespace-nowrap select-none",
          "transition-[transform,filter,background-color,border-color] duration-150 ease-out",
          "hover:-translate-y-px active:translate-y-0",
          "disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100",
          VARIANTS[variant],
          SIZES[size],
          fullWidth ? "w-full" : "",
          className,
        ].join(" ")}
        {...rest}
      >
        {/* Genişliği koruyan görünmez metin */}
        <span
          className={[
            "inline-flex items-center gap-2",
            loading ? "invisible" : "",
          ].join(" ")}
        >
          {children}
        </span>

        {loading && (
          <span className="absolute inset-0 grid place-items-center">
            <Spinner />
          </span>
        )}
      </button>
    );
  },
);

/** Dönen yükleme göstergesi. `prefers-reduced-motion` altında globals.css durdurur. */
export function Spinner({className = ""}: {className?: string}) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
