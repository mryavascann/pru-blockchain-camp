"use client";

/**
 * ============================================================================
 * NOT YAZMA FORMU
 *
 * TASARIM KARARI 1 — BOŞ KUTU YOK.
 *
 * Notion'daki not sayfası boş kaldı çünkü katkı verecek kişiye boş bir alan
 * gösteriliyordu. Burada tür seçilir; tür seçilince o türe ait yer tutucu
 * metin ve SOMUT BİR ÖRNEK devreye girer. "Ne yazacağım?" sorusu forma
 * girmeden cevaplanmış olur.
 *
 * TASARIM KARARI 2 — AYNI BİLGİYİ İKİ KEZ GÖSTERME.
 *
 * İlk sürümde form yedi bölümdü: dört tür kartı (her biri bir paragraf),
 * üç-dört cümlelik yönerge, kapalı örnek, üç alan, iki satır açıklamalı bir
 * kutucuk — ve formun ALTINDA türleri yeniden anlatan koca bir rehber, sağ
 * sütunda da bir rehber daha. Not bırakmak için okuma ödevi gerekiyordu.
 *
 * Şimdi form yalnızca YAZMA işini yapıyor:
 *   - tür = tek satır çip sırası, açıklama sadece SEÇİLİ tür için
 *   - uzun yönerge paragrafı buradan çıktı → "İyi not nasıl olur?" panelinde
 *     (bkz. NotesGuide variant="write" — açılır, varsayılan kapalı)
 *   - yapay zekâ kutucuğunun açıklaması okuma rehberine taşındı; okuyan kişi
 *     için anlamlı, yazan kişi için gürültüydü
 *   - kaynak alanı yalnızca gerektiğinde görünür
 *
 * Hiçbir bilgi silinmedi, hepsi tek bir kanonik yere taşındı.
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
import {
  KIND_ACTIVE,
  KIND_HOVER_BORDER,
  KIND_TEXT,
  NoteKindIcon,
  SparkleIcon,
} from "./kindVisuals";

export type ComposerResult = {
  note: NoteView;
  unlocked?: {
    badgeForWeek: number;
    visibleWeek: number;
    openedWeek: number | null;
    owedWeeks: number[];
    nextWeekAt: string | null;
  };
};

/** Gövdeye bağlantı yapıştırılmışsa kaynak alanını kendiliğinden açarız */
const URL_IN_TEXT = /https?:\/\/\S/i;

export function NoteComposer({
  campSlug,
  weekNumber,
  initialKind,
  existing,
  firstNote = false,
  onKindChange,
  onSaved,
  onCancel,
}: {
  campSlug: string;
  weekNumber: number;
  /** Liste ekranındaki tür düğmesinden gelindiyse tür hazır seçili açılır */
  initialKind?: NoteKind;
  /** Doluysa düzenleme kipi */
  existing?: NoteView;
  /**
   * Kişinin bu kamptaki İLK notu mu? Öyleyse örnek not varsayılan açık gelir.
   * İkinci notunda aynı örneği tekrar okutmanın kimseye faydası yok.
   */
  firstNote?: boolean;
  /** Üstteki rehber panelinin seçili türü izleyebilmesi için */
  onKindChange?: (kind: NoteKind) => void;
  onSaved: (result: ComposerResult) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<NoteKind | null>(
    (existing?.kind as NoteKind) ?? initialKind ?? null,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? "");
  const [aiAssisted, setAiAssisted] = useState(existing?.aiAssisted ?? false);
  const [showExample, setShowExample] = useState(firstNote);
  const [sourceOpen, setSourceOpen] = useState(Boolean(existing?.sourceUrl));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * "Vazgeç" iki adımlı: yazılmış bir metin varken ilk tıklama yalnızca
   * soruyor. Yarım saatlik bir notu tek yanlış tıklamayla kaybettirmek,
   * bu ekranda önlenebilecek en pahalı hata.
   */
  const [confirmCancel, setConfirmCancel] = useState(false);

  const info = kind ? NOTE_KIND_INFO[kind] : null;
  const bodyLength = body.trim().length;
  const remaining = Math.max(0, BODY_MIN - bodyLength);

  /*
   * Sayaç sessiz duruyor: yalnızca alt sınırın altındayken ("daha ne kadar
   * yazmalıyım?") ya da üst sınıra yaklaşırken ("neden kesildi?") görünür.
   * Arada kalan normal uzunluklarda kimsenin karakter saymaya ihtiyacı yok.
   */
  const counter =
    remaining > 0
      ? `en az ${remaining} karakter daha`
      : bodyLength > BODY_MAX - 400
        ? `${bodyLength} / ${BODY_MAX}`
        : null;

  /* Kaynak alanı: zorunluysa hep açık, değilse istendiğinde ya da gövdeye
     bağlantı yapıştırıldığında açılır. */
  const showSource =
    Boolean(info?.requiresSource) ||
    sourceOpen ||
    sourceUrl.trim().length > 0 ||
    URL_IN_TEXT.test(body);

  const check = kind
    ? validateNote({kind, title, body, sourceUrl, aiAssisted})
    : null;
  const canSubmit = check?.ok === true && !busy;

  function pickKind(next: NoteKind) {
    setKind(next);
    setShowExample(firstNote);
    onKindChange?.(next);
  }

  /** Yazmaya devam eden biri vazgeçmiyordur — soruyu geri al */
  function edit(setter: (value: string) => void) {
    return (value: string) => {
      if (confirmCancel) setConfirmCancel(false);
      setter(value);
    };
  }

  function handleCancel() {
    const dirty = title.trim().length > 0 || body.trim().length > 0;
    if (dirty && !confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    onCancel?.();
  }

  /** ⌘/Ctrl + Enter — imleci alandan çıkarmadan kaydet */
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      void submit();
    }
  }

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
    <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
      {/* ---------------- 1. Tür — tek satır ---------------- */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-fg-muted">TÜR</span>
        {NOTE_KIND_LIST.map((option) => {
          const selected = kind === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => pickKind(option.value)}
              aria-pressed={selected}
              className={[
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? KIND_ACTIVE[option.value]
                  : `border-line text-fg-secondary hover:text-fg ${KIND_HOVER_BORDER[option.value]}`,
              ].join(" ")}
            >
              {/* Seçiliyken çipin tamamı türün rengi; boştayken rengi
                  yalnızca ikon taşır — sıra renk cümbüşüne dönmesin */}
              <NoteKindIcon
                kind={option.value}
                className={selected ? "h-4 w-4" : `h-4 w-4 ${KIND_TEXT[option.value]}`}
              />
              {option.label}
            </button>
          );
        })}
      </div>

      {!info && (
        <p className="text-sm text-fg-secondary">
          Bir tür seç — ne yazacağını orada anlatıyoruz.
        </p>
      )}

      {info && (
        <>
          {/* -------- 2. Seçili türün tek cümlesi + örnek -------- */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-sm text-fg-secondary">{info.summary}</p>
            <button
              type="button"
              onClick={() => setShowExample((v) => !v)}
              className="text-sm font-medium text-accent-text underline underline-offset-2"
            >
              {showExample ? "Örneği Gizle" : "Örnek Göster"}
            </button>
          </div>

          {showExample && (
            <div className="reveal-soft rounded-md border border-line bg-subtle p-3">
              <p className="text-sm font-bold">{info.example.title}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-fg-secondary">
                {info.example.body}
              </p>
              <p className="mt-2 text-xs text-fg-muted">
                Örnek — kopyalama, kendi deneyimini yaz.
              </p>
            </div>
          )}

          {/* ---------------- 3. Başlık ---------------- */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Başlık</span>
            <input
              type="text"
              value={title}
              onChange={(event) => edit(setTitle)(event.target.value)}
              maxLength={TITLE_MAX}
              placeholder="Listede görünecek kısa başlık"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-line-accent"
            />
          </label>

          {/* ---------------- 4. Gövde ---------------- */}
          <label className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">Notun</span>
              {counter && (
                <span className="text-xs tabular-nums text-fg-muted">
                  {counter}
                </span>
              )}
            </span>
            <textarea
              value={body}
              onChange={(event) => edit(setBody)(event.target.value)}
              maxLength={BODY_MAX}
              rows={8}
              placeholder={info.placeholder}
              className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-fg outline-none focus:border-line-accent"
            />
          </label>

          {/* ---------------- 5. Kaynak (koşullu) ---------------- */}
          {showSource ? (
            <label className="reveal-soft flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                Kaynak Bağlantısı{" "}
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
          ) : (
            <button
              type="button"
              onClick={() => setSourceOpen(true)}
              className="self-start text-sm font-medium text-fg-secondary underline underline-offset-2 hover:text-fg"
            >
              + Kaynak Bağlantısı Ekle
            </button>
          )}

          {/* -------- 6. Yapay zekâ işareti + kaydet, tek satır -------- */}
          {check && !check.ok && bodyLength > 0 && (
            <p className="text-sm text-fg-muted">{check.error}</p>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label
              title="Notun değerini düşürmez — okuyan kişi doğru gözle baksın diye işaretliyoruz. Yapay zekâ yanılabilir."
              className={[
                "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                aiAssisted
                  ? "border-warning text-warning"
                  : "border-line text-fg-secondary hover:border-line-strong hover:text-fg",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={aiAssisted}
                onChange={(event) => setAiAssisted(event.target.checked)}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <SparkleIcon />
              Yapay Zekâya Sordum
            </label>

            <Button
              variant="accent"
              loading={busy}
              disabled={!canSubmit}
              onClick={submit}
            >
              {existing ? "Notu Güncelle" : "Notu Bırak"}
            </Button>

            {onCancel && (
              <Button
                variant={confirmCancel ? "danger" : "ghost"}
                onClick={handleCancel}
                disabled={busy}
              >
                {confirmCancel ? "Yazdıkların silinsin mi?" : "Vazgeç"}
              </Button>
            )}

            <span className="hidden text-xs text-fg-muted sm:inline">
              ⌘/Ctrl + Enter ile kaydedebilirsin
            </span>
          </div>
        </>
      )}
    </div>
  );
}
