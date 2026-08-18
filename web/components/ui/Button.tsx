/**
 * Buton — brand.md §7.1
 *
 * Varyantlar ve ne zaman kullanılacağı:
 *   primary   → sayfadaki TEK ana eylem
 *   accent    → "Rozeti Al", "Cüzdanını Bağla" (menekşe = doğrulanmış/aktif)
 *   secondary → ikincil eylem
 *   ghost     → üçüncül, tablo içi
 *   danger    → Reddet, Burn, Pause
 *
 * ---------------------------------------------------------------------------
 * NEDEN İKİ AYRI BİLEŞEN: `Button` VE `ButtonLink`
 *
 * Önce `<Link><Button/></Link>` yazmıştım — yani `<a>` içinde `<button>`.
 * Bu GEÇERSİZ HTML'dir (etkileşimli öğe iç içe geçemez) ve gerçek bir hataya
 * yol açtı: tarayıcı bağlantıya kendi ziyaret-edilmiş rengini uyguladı,
 * buton metni koyu mora dönüp okunmaz hâle geldi.
 *
 * Doğrusu: bağlantı ise `<a>`, eylem ise `<button>` render etmek.
 * Ortak stiller `buttonClasses()` içinde tek yerde duruyor.
 * ---------------------------------------------------------------------------
 *
 * YÜKLENME DURUMUNDA GENİŞLİK SABİT KALIR: metin görünmez yapılır ama yerinde
 * durur, spinner üstüne bindirilir. Aksi hâlde buton daralıp genişler ve
 * etrafındaki düzen zıplar (brand.md §7.1).
 */
import Link from "next/link";
import {forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes} from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

/*
 * Renkler artık @theme köprüsündeki SEMANTİK Tailwind sınıflarıyla veriliyor
 * (bg-surface, text-fg, border-line-strong …), köşeli parantezli arbitrary
 * değerlerle değil.
 *
 * Gerekçe: `text-[var(--x)]` Tailwind'de belirsizdir (yazı boyutu mu renk mi?)
 * ve sessizce yanlış özelliğe uygulanabilir. Tema token'ı olarak tanımlanan
 * sınıflarda böyle bir belirsizlik yoktur.
 */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg border border-transparent hover:brightness-110",
  accent: "bg-accent text-accent-fg border border-transparent hover:brightness-110",
  secondary:
    "bg-surface text-fg border border-line-strong hover:border-line-accent hover:bg-subtle",
  ghost:
    "bg-transparent text-fg-secondary border border-transparent hover:bg-subtle hover:text-fg",
  danger: "bg-danger text-white border border-transparent hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-base gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

const BASE = [
  "relative inline-flex items-center justify-center rounded-md",
  "font-semibold whitespace-nowrap select-none no-underline",
  "transition-[transform,filter,background-color,border-color,color] duration-150 ease-out",
  "hover:-translate-y-px active:translate-y-0",
].join(" ");

/** Ortak stil üretici — `Button` ve `ButtonLink` ikisi de bunu kullanır */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/*                          EYLEM BUTONU  (<button>)                          */
/* -------------------------------------------------------------------------- */

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
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
        buttonClasses({variant, size, fullWidth, className}),
        "disabled:opacity-45 disabled:cursor-not-allowed",
        "disabled:hover:translate-y-0 disabled:hover:brightness-100",
      ].join(" ")}
      {...rest}
    >
      <span className={`inline-flex items-center gap-2 ${loading ? "invisible" : ""}`}>
        {children}
      </span>

      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/*                        BAĞLANTI BUTONU  (<a>)                              */
/* -------------------------------------------------------------------------- */

export type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Harici bağlantı — yeni sekmede açılır, rel güvenliği eklenir */
  external?: boolean;
};

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  fullWidth = false,
  external = false,
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = buttonClasses({variant, size, fullWidth, className});

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        {...rest}
      >
        <span className="inline-flex items-center gap-2">{children}</span>
      </a>
    );
  }

  // İç bağlantılarda `next/link` — istemci tarafı geçiş ve ön yükleme için
  return (
    <Link href={href} className={classes} {...rest}>
      <span className="inline-flex items-center gap-2">{children}</span>
    </Link>
  );
}

/** Dönen yükleme göstergesi. `prefers-reduced-motion` altında globals.css durdurur. */
export function Spinner({className = ""}: {className?: string}) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
