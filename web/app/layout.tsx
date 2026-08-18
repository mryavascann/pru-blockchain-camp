import type {Metadata, Viewport} from "next";
import {Inter, JetBrains_Mono, Plus_Jakarta_Sans} from "next/font/google";

import {Header} from "@/components/layout/Header";
import {Footer} from "@/components/layout/Footer";
import {TestnetBanner} from "@/components/layout/TestnetBanner";
import {publicEnv} from "@/lib/env";
import {t} from "@/lib/i18n";
import {Providers} from "./providers";
import "./globals.css";

/* ---------------------------------------------------------------------------
   FONTLAR  (brand.md §3.1)

   `latin-ext` alt kümesi ZORUNLU. Onsuz ğ ü ş İ ı ç ö karakterleri düşer ve
   yerine yedek fonttan alınan uyumsuz glifler gelir. Türkçe bir sitede bu
   kabul edilemez.
   --------------------------------------------------------------------------- */
const heading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${t.site.name} — Kamp Rozetleri`,
    template: `%s · ${t.site.shortName}`,
  },
  description: t.site.tagline,
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: t.site.name,
  },
  robots: {
    // Varsayılan olarak indekslenebilir. Kilitli sayfalar kendi
    // `metadata` tanımlarında bunu `noindex` olarak geçersiz kılar.
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    {media: "(prefers-color-scheme: light)", color: "#f7f9fc"},
    {media: "(prefers-color-scheme: dark)", color: "#050d1a"},
  ],
};

/**
 * Tema tercihini SAYFA BOYANMADAN ÖNCE uygular.
 *
 * Bu script olmadan şu olur: sayfa açılır, varsayılan (koyu) tema görünür,
 * sonra JavaScript çalışıp kullanıcının "açık tema" tercihini uygular ve
 * ekran beyaza döner. Buna "flash of wrong theme" denir ve rahatsız edicidir.
 *
 * `dangerouslySetInnerHTML` burada güvenlidir: içerik sabit, kullanıcı
 * girdisi içermiyor.
 */
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem("pru-theme");
    if (stored === "dark" || stored === "light") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="tr"
      className={`${heading.variable} ${body.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <TestnetBanner />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
