"use client";

/**
 * ============================================================================
 * NOT YAZMA FORMU
 *
 * TASARIM KARARI — BOŞ KUTU YOK.
 *
 * Notion'daki not sayfası boş kaldı çünkü katkı verecek kişiye boş bir alan
 * gösteriliyordu. Burada önce TÜR seçilir; tür seçilince o türe ait yönerge,
 * yer tutucu metin ve SOMUT BİR ÖRNEK açılır. "Ne yazacağım?" sorusu forma
 * girmeden cevaplanmış olur.
 *
 * Doğrulama `lib/notes/rules.ts` içindeki `validateNote` ile yapılıyor —
 * sunucunun kullandığı fonksiyonun aynısı. Formdaki kontrol bir kolaylık;
 * asıl karar sunucuda veriliyor, ikisi asla ayrışamaz.
 * ============================================================================
 */
import {useState} from "react";

import {Button} from "@/components/ui/Button";
import {
  BODY_MAX,
  BODY_MIN,
  NOTE_KIND_LIST,
  NOTE_KIND_INFO,
  TITLE_MAX,
  validateNote,
  type NoteKind,
} from "@/lib/notes/rules";
import type {NoteView} from "./NoteCard";

export type ComposerResult = {
  note: NoteView;
  unlocked?: {
    badgeForWeek: number;
    visibleWeek: number;
    openedWeek: number | null;
    owedWeeks: number[];
  };
};

export function NoteComposer({
  campSlug,
  weekNumber,
  existing,
  onSaved,
  onCancel,
}: {
  campSlug: string;
  weekNumber: number;
  /** Doluysa düzenleme kipi */
  existing?: NoteView;
  onSaved: (result: ComposerResult) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<NoteKind | null>(
    (existing?.kind as NoteKind) ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? "");
  const [aiAssisted, setAiAssisted] = useState(existing?.aiAssisted ?? false);
  const [showExample, setShowExample] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = kind ? NOTE_KIND_INFO[kind] : null;
  const bodyLength = body.trim().length;
  const remaining = Math.max(0, BODY_MIN - bodyLength);

  const check = kind
    ? validateNote({kind, title, body, sourceUrl, aiAssisted})
    : null;
  const canSubmit = check?.ok === true && !busy;

  async function submit() {
    if (!kind) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(
        existing ? `/api/notes/${existing.id}` : "/api/notes",
        {
          method: existing ? "PATCH" : "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            campSlug,
            weekNumber,
            kind,
            title,
            body,
            sourceUrl: sourceUrl.trim() || null,
            aiAssisted,
          }),
        },
      );

      const json = await response.json();
      if (!json.ok) {
        setError(json.error ?? "Not kaydedilemedi.");
        return;
      }

      onSaved(json.data as ComposerResult);
    } catch {
      setError("Bağlantı sorunu. İnternetini kontrol edip tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- 1. Tür ---------------- */}
      <div>
        <span className="mb-2 block text-sm font-semibold">
          Ne tür bir not bırakıyorsun?
        </span>

        <div className="grid gap-2 sm:grid-cols-2">
          {NOTE_KIND_LIST.map((option) => {
            const selected = kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setKind(option.value);
                  setShowExample(false);
                }}
                aria-pressed={selected}
                className={[
                  "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-line-accent bg-subtle"
                    : "border-line hover:border-line-strong",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </span>
                <span className="text-xs leading-relaxed text-fg-secondary">
                  {option.summary}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------- 2. Tür seçilince açılan yönerge ---------------- */}
      {info && (
        <>
          <div className="rounded-lg border border-line-accent bg-subtle p-4">
            <p className="text-sm leading-relaxed text-fg-secondary">
              {info.guidance}
            </p>

            <button
              type="button"
              onClick={() => setShowExample((v) => !v)}
              className="mt-2 text-sm font-semibold text-accent-text underline underline-offset-2"
            >
              {showExample ? "Örneği gizle" : "Örnek bir not göster"}
            </button>

            {showExample && (
              <div className="mt-3 rounded-md border border-line bg-surface p-3">
                <p className="text-sm font-bold">{info.example.title}</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
                  {info.example.body}
                </p>
                <p className="mt-2 text-xs text-fg-muted">
                  Bu bir örnek — kopyalama, kendi deneyimini yaz.
                </p>
              </div>
            )}
          </div>

          {/* ---------------- 3. Başlık ---------------- */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Başlık</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TITLE_MAX}
              placeholder="Listede görünecek kısa başlık"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-line-accent"
            />
          </label>

          {/* ---------------- 4. Gövde ---------------- */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">Notun</span>
              <span
                className={[
                  "text-xs tabular-nums",
                  remaining > 0 ? "text-fg-muted" : "text-success",
                ].join(" ")}
              >
                {remaining > 0
                  ? `en az ${remaining} karakter daha`
                  : `${bodyLength} / ${BODY_MAX}`}
              </span>
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={BODY_MAX}
              rows={8}
              placeholder={info.placeholder}
              className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-fg outline-none focus:border-line-accent"
            />
          </label>

          {/* ---------------- 5. Kaynak ---------------- */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">
              Kaynak bağlantısı{" "}
              <span className="font-normal text-fg-muted">
                {info.requiresSource ? "(zorunlu)" : "(isteğe bağlı)"}
              </span>
            </span>
            <input
              type="url"
              inputMode="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-line-accent"
            />
          </label>

          {/* ---------------- 6. Yapay zekâ işareti ---------------- */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-3">
            <input
              type="checkbox"
              checked={aiAssisted}
              onChange={(event) => setAiAssisted(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-sm">
              <span className="font-semibold">
                Bu açıklamayı bir yapay zekâya sordum
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-fg-secondary">
                Notun değerini düşürmez — okuyan kişi doğru gözle baksın diye
                işaretliyoruz. Yapay zekâ yanılabilir.
              </span>
            </span>
          </label>

          {/* ---------------- 7. Kaydet ---------------- */}
          {check && !check.ok && bodyLength > 0 && (
            <p className="text-sm text-fg-muted">{check.error}</p>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              loading={busy}
              disabled={!canSubmit}
              onClick={submit}
            >
              {existing ? "Notu güncelle" : "Notu bırak"}
            </Button>

            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={busy}>
                Vazgeç
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
