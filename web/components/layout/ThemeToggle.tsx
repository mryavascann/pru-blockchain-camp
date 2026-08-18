"use client";

/**
 * Tema geçişi — brand.md §2.2
 *
 * Üç durum döngüsü: sistem → açık → koyu → sistem
 *
 * Varsayılan koyudur (kripto kitlesi bunu bekliyor, rozet görselleri koyu
 * zeminde daha iyi duruyor), ama SİSTEM TERCİHİ HER ZAMAN SAYGI GÖRÜR.
 * Kullanıcı açıkça bir şey seçmediyse `data-theme` niteliği hiç yazılmaz
 * ve CSS `prefers-color-scheme`'e bırakılır.
 */
import {useEffect, useState} from "react";

import {t} from "@/lib/i18n";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "pru-theme";
const ORDER: Theme[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* localStorage engelli (gizli sekme vb.) — sistem temasında kal */
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    try {
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem(STORAGE_KEY, next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {
      /* yazılamadıysa en azından bu oturumda uygula */
      if (next !== "system") {
        document.documentElement.setAttribute("data-theme", next);
      }
    }
  }

  /*
   * Sunucuda tema bilinmez. Yüklenmeden önce sabit bir yer tutucu
   * gösteriyoruz — aksi hâlde sunucu ve tarayıcı farklı ikon üretir
   * ve React hydration uyarısı verir.
   */
  if (!mounted) {
    return <div className="h-9 w-9" aria-hidden="true" />;
  }

  const label =
    theme === "system"
      ? t.common.themeSystem
      : theme === "light"
        ? t.common.themeLight
        : t.common.themeDark;

  return (
    <button
      type="button"
      onClick={() => apply(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      title={`${t.common.theme}: ${label}`}
      aria-label={`${t.common.theme}: ${label}`}
      className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-primary)]"
    >
      {theme === "system" ? <MonitorIcon /> : theme === "light" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg {...iconProps}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
