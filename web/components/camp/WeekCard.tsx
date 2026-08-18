/**
 * Hafta kartı — brand.md §7.3
 *
 *   public       → herkese açık örnek hafta, turkuaz kenarlık
 *   owned        → rozeti alınmış, amber onay işareti
 *   açık         → kişi bu haftaya gelmiş, içerik okunabilir
 *   notNeeded    → önceki haftanın notu yazılmadığı için kapalı
 *   notReached   → henüz bu haftaya gelinmedi
 *
 * Kilitli kartta da başlık ve özet GÖRÜNÜR — bunlar zaten herkese açık
 * bilgi. Gizlenen tek şey ders içeriğidir.
 *
 * KİLİT SEBEBİNİ KARTTA GÖSTERİYORUZ: "kilitli" demek kullanıcıya ne
 * yapacağını söylemez. "3. haftanın notunu bırak" söyler.
 */
import Link from "next/link";

import {Card, Pill} from "@/components/ui/Card";
import {fmt, t} from "@/lib/i18n";

export function WeekCard({
  campSlug,
  weekNumber,
  title,
  teaser,
  isPublic = false,
  owned = false,
  lock,
}: {
  campSlug: string;
  weekNumber: number;
  title: string;
  teaser?: string;
  isPublic?: boolean;
  owned?: boolean;
  /** Kapalıysa sebebi. Yoksa hafta açık demektir. */
  lock?:
    | {kind: "not-approved"}
    | {
        kind: "not-reached";
        /** Hâlâ bekleyen not borcu (yoksa null) */
        owedWeek: number | null;
        /** "6 gün 11 saat" — planlanan açılışa kalan süre (bilinmiyorsa null) */
        remaining: string | null;
      }
    | {kind: "note-required"; blockingWeek: number};
}) {
  const closed = Boolean(lock) && !isPublic;

  return (
    <Link
      href={
        closed && lock?.kind === "note-required"
          ? `/kamplar/${campSlug}/notlar`
          : `/kamplar/${campSlug}/hafta/${weekNumber}`
      }
      className="group block rounded-lg"
    >
      <Card
        interactive
        accent={isPublic}
        className={["h-full", closed ? "opacity-75" : ""].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <Pill tone={isPublic ? "accent" : "neutral"}>
            {fmt(t.camp.weekLabel, {n: weekNumber}).toUpperCase()}
          </Pill>

          {isPublic ? (
            <Pill tone="accent">🌐 {t.camp.publicBadge}</Pill>
          ) : owned ? (
            <span
              className="text-reward"
              title={t.profile.claimed}
              aria-label={t.profile.claimed}
            >
              <AwardIcon />
            </span>
          ) : (
            <span className="text-fg-muted" aria-hidden="true">
              <LockIcon />
            </span>
          )}
        </div>

        <h3 className="mt-3 font-semibold leading-snug transition-colors group-hover:text-accent-text">
          {title}
        </h3>

        {teaser && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-secondary">
            {teaser}
          </p>
        )}

        {lock?.kind === "note-required" && (
          <p className="mt-3 rounded-md border border-line-accent bg-subtle px-2.5 py-1.5 text-xs font-medium text-accent-text">
            📓 Açmak için {lock.blockingWeek}. haftanın notunu bırak
          </p>
        )}

        {/*
          "Henüz gelmedin" kartı, kişinin YAPACAK BİR İŞİ olup olmadığını
          ayırt eder. Borç varsa iş var; yoksa beklemekten başka yapacağı
          bir şey yok ve bunu açıkça söylemek gerekiyor — aksi hâlde
          kullanıcı olmayan bir görev arıyor.
        */}
        {lock?.kind === "not-reached" && (
          <p className="mt-3 text-xs text-fg-muted">
            {lock.owedWeek !== null
              ? `Önce ${lock.owedWeek}. haftanın notunu bırak.`
              : lock.remaining
                ? `Planlanan açılışa ~${lock.remaining} var.`
                : "Bu haftaya henüz gelmedin."}
          </p>
        )}

        {lock?.kind === "not-approved" && (
          <p className="mt-3 text-xs text-fg-muted">
            Başvurun onaylandığında açılır.
          </p>
        )}

        <span className="mt-4 inline-block text-sm font-medium text-accent-text">
          {isPublic
            ? t.camp.viewWeek
            : lock?.kind === "note-required"
              ? "Not bırak"
              : lock
                ? "Müfredatı gör"
                : t.camp.continue}{" "}
          →
        </span>
      </Card>
    </Link>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      <circle cx="12" cy="8" r="6" />
    </svg>
  );
}
