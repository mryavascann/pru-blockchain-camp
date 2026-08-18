"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

import {t} from "@/lib/i18n";

type Tab = {href: string; label: string; exact?: boolean};

const TABS: Tab[] = [
  // `exact`: /admin her alt sayfanın önekidir; tam eşleşme aranmazsa
  // "Özet" sekmesi her zaman aktif görünürdü.
  {href: "/admin", label: "Özet", exact: true},
  {href: "/admin/basvurular", label: t.admin.applications},
  {href: "/admin/icerik", label: t.admin.content},
  {href: "/admin/merkle", label: t.admin.merkle},
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-line pb-px"
      aria-label="Yönetim menüsü"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "border-line-accent text-accent-text"
                : "border-transparent text-fg-secondary hover:text-fg",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
