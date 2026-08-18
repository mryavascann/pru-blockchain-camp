"use client";

/**
 * ============================================================================
 * İçerik yönetimi
 *
 * Notion'da OLMAYAN üç şey buradan yönetilir:
 *
 *   1. Özet (teaser)     → kilitli ekranda gösterilecek vitrin metni
 *   2. Taslak / Yayında  → hafta sitede görünsün mü
 *   3. Herkese açık hafta→ hangi hafta cüzdansız görülebilir (SEO'ya açık)
 *
 * ÖZET NEDEN BURADA, NOTION'DA DEĞİL:
 * Kilitli ekrana giden metin, kilitli içerikten TÜRETİLMEMELİDİR. Notion'da
 * bilerek yazılmış bir callout/quote varsa senkron onu otomatik alır. Yoksa
 * alan boş kalır ve buradan doldurulur — ders içeriğinin ilk paragrafı asla
 * otomatik kopyalanmaz.
 *
 * `teaserSource === "paragraph"` ise öneri gerçek ders içeriğidir; arayüz
 * bunu AÇIKÇA uyararak sunar ve adminin onayını bekler.
 * ============================================================================
 */
import {useState} from "react";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/Button";
import {Card, Pill} from "@/components/ui/Card";
import {t} from "@/lib/i18n";

type Week = {
  weekNumber: number;
  title: string;
  teaser: string;
  teaserSuggestion: string | null;
  teaserSource: string | null;
  status: "DRAFT" | "PUBLISHED";
  syncStatus: "PENDING" | "OK" | "FAILED";
  lastError: string | null;
  syncedAt: string | null;
  stage: string | null;
};

type Camp = {
  id: number;
  slug: string;
  name: string;
  weekCount: number;
  publicWeekNumber: number | null;
  weeks: Week[];
};

export function ContentManager({camps}: {camps: Camp[]}) {
  const router = useRouter();
  const [activeSlug, setActiveSlug] = useState(camps[0]?.slug ?? "");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const camp = camps.find((c) => c.slug === activeSlug);

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({campId: camp?.id}),
      });
      const json = await response.json();

      if (json.ok || json.data) {
        const result = json.data ?? json;
        const updated = (result.camps ?? []).reduce(
          (sum: number, c: {updated: number; created: number}) =>
            sum + c.updated + c.created,
          0,
        );
        const warnings = (result.camps ?? []).flatMap(
          (c: {warnings: string[]}) => c.warnings,
        );
        setSyncResult(
          `${updated} hafta güncellendi.` +
            (warnings.length ? ` ${warnings.length} uyarı.` : ""),
        );
        router.refresh();
      } else {
        setSyncResult(json.error ?? t.errors.unknown);
      }
    } catch {
      setSyncResult(t.errors.network);
    } finally {
      setSyncing(false);
    }
  }

  if (!camp) return <p className="text-fg-secondary">Kamp bulunamadı.</p>;

  const missingTeasers = camp.weeks.filter((w) => !w.teaser).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Kamp seçimi + senkron ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {camps.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveSlug(c.slug)}
              aria-pressed={c.slug === activeSlug}
              className={[
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                c.slug === activeSlug
                  ? "border-line-accent bg-subtle text-accent-text"
                  : "border-line text-fg-secondary hover:text-fg",
              ].join(" ")}
            >
              {c.name}
            </button>
          ))}
        </div>

        <Button variant="secondary" size="sm" loading={syncing} onClick={syncNow}>
          {syncing ? t.admin.syncing : t.admin.syncNow}
        </Button>
      </div>

      {syncResult && (
        <p className="rounded-md border border-line-accent bg-subtle p-3 text-sm">
          {syncResult}
        </p>
      )}

      {/* ---- Herkese açık hafta ---- */}
      <PublicWeekPicker camp={camp} onDone={() => router.refresh()} />

      {missingTeasers > 0 && (
        <p className="rounded-md border border-warning bg-subtle p-3 text-sm text-warning">
          <strong>{missingTeasers} haftanın özeti boş.</strong> Kilitli ekranda
          gösterilecek metin olmadan o haftalar çıplak görünür.
        </p>
      )}

      {/* ---- Haftalar ---- */}
      <div className="flex flex-col gap-3">
        {camp.weeks.map((week) => (
          <WeekEditor
            key={week.weekNumber}
            campSlug={camp.slug}
            week={week}
            onDone={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          HERKESE AÇIK HAFTA SEÇİMİ                         */
/* -------------------------------------------------------------------------- */

function PublicWeekPicker({camp, onDone}: {camp: Camp; onDone: () => void}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(weekNumber: number | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/weeks", {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({campSlug: camp.slug, publicWeekNumber: weekNumber}),
      });
      const json = await response.json();
      if (json.ok) onDone();
      else setError(json.error ?? t.errors.unknown);
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-base font-bold tracking-tight">{t.admin.publicWeek}</h2>
      <p className="mt-1 text-sm text-fg-secondary">{t.admin.publicWeekHelp}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => set(null)}
          aria-pressed={camp.publicWeekNumber === null}
          className={[
            "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
            camp.publicWeekNumber === null
              ? "border-line-accent bg-accent text-accent-fg"
              : "border-line text-fg-secondary hover:border-line-strong",
          ].join(" ")}
        >
          Yok
        </button>

        {camp.weeks.map((week) => (
          <button
            key={week.weekNumber}
            type="button"
            disabled={busy || week.status !== "PUBLISHED"}
            onClick={() => set(week.weekNumber)}
            aria-pressed={camp.publicWeekNumber === week.weekNumber}
            title={
              week.status !== "PUBLISHED"
                ? "Taslak haftalar herkese açık yapılamaz"
                : week.title
            }
            className={[
              "h-8 w-8 rounded-md border text-xs font-semibold transition-colors",
              camp.publicWeekNumber === week.weekNumber
                ? "border-line-accent bg-accent text-accent-fg"
                : week.status !== "PUBLISHED"
                  ? "border-line text-fg-muted opacity-40"
                  : "border-line text-fg-secondary hover:border-line-strong",
            ].join(" ")}
          >
            {week.weekNumber}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                             HAFTA DÜZENLEYİCİ                              */
/* -------------------------------------------------------------------------- */

function WeekEditor({
  campSlug,
  week,
  onDone,
}: {
  campSlug: string;
  week: Week;
  onDone: () => void;
}) {
  const [teaser, setTeaser] = useState(week.teaser);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = teaser !== week.teaser;
  const suggestionIsContent = week.teaserSource === "paragraph";

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/weeks", {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({campSlug, weekNumber: week.weekNumber, ...patch}),
      });
      const json = await response.json();
      if (json.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onDone();
      } else {
        setError(json.error ?? t.errors.unknown);
      }
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="!p-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="mono shrink-0 text-sm text-fg-muted">
            H{String(week.weekNumber).padStart(2, "0")}
          </span>
          <span className="truncate font-semibold">{week.title}</span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {week.syncStatus === "FAILED" && <Pill tone="danger">senkron ✕</Pill>}
          {week.status === "DRAFT" && <Pill tone="muted">taslak</Pill>}
          {!week.teaser && <Pill tone="danger">özet yok</Pill>}
          <span className="text-fg-muted" aria-hidden="true">
            {open ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          {week.stage && (
            <p className="text-xs text-fg-muted">{week.stage}</p>
          )}

          {week.syncStatus === "FAILED" && week.lastError && (
            <p className="rounded-md border border-danger p-2 text-xs text-danger">
              Son senkron hatası: {week.lastError}
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">
              {t.admin.teaserLabel}
            </span>
            <textarea
              value={teaser}
              onChange={(event) => setTeaser(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Kilitli ekranda gösterilecek 2-3 cümlelik vitrin metni"
              className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-line-accent"
            />
            <span className="mt-1 block text-xs text-fg-muted">
              {teaser.length} / 500
            </span>
          </label>

          {/* Notion önerisi — kaynağına göre farklı sunulur */}
          {week.teaserSuggestion && week.teaserSuggestion !== teaser && (
            <div
              className={[
                "rounded-md border p-3 text-xs",
                suggestionIsContent
                  ? "border-warning text-warning"
                  : "border-line text-fg-secondary",
              ].join(" ")}
            >
              <p className="font-semibold">
                Notion önerisi{" "}
                {week.teaserSource && `(${week.teaserSource})`}
              </p>
              {suggestionIsContent && (
                <p className="mt-1">⚠️ {t.admin.suggestionFromContent}</p>
              )}
              <p className="mt-2 italic">
                &ldquo;{week.teaserSuggestion.slice(0, 200)}
                {week.teaserSuggestion.length > 200 ? "…" : ""}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setTeaser(week.teaserSuggestion ?? "")}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                {t.admin.useSuggestion}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="accent"
              size="sm"
              loading={busy}
              disabled={!dirty}
              onClick={() => save({teaser})}
            >
              {saved ? t.common.saved : t.common.save}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() =>
                save({status: week.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"})
              }
            >
              {week.status === "PUBLISHED" ? "Taslağa al" : "Yayına al"}
            </Button>

            {week.syncedAt && (
              <span className="text-xs text-fg-muted">
                senkron:{" "}
                {new Date(week.syncedAt).toLocaleString("tr-TR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
