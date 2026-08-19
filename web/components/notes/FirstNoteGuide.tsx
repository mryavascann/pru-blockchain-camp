"use client";

/**
 * ============================================================================
 * TEK SEFERLİK POPUP — ilk notunu yazacak kişiye
 *
 * ---------------------------------------------------------------------------
 * NEDEN AYRI BİR EKRAN, NEDEN "TEK SEFERLİK" YAZIYOR
 *
 * Yazma rehberi önce formun altında sürekli açık duruyordu: ilk gelen kişi
 * için gerekli, ikinci notunu yazan için gürültü. Sonra bir bağlantının
 * arkasına alındı — bu sefer ilk gelen kişi hiç okumadan boş kutuya bakıyordu.
 *
 * Rehber ilk notta bir kez modal olarak açılır; kişi "Okudum, Anladım" der
 * ve bir daha otomatik olarak gösterilmez.
 *
 * Üstteki "TEK SEFERLİK" etiketi ve altındaki cümle bilerek var. Bir kullanıcı
 * karşısına çıkan uzun metni "bu her seferinde mi çıkacak?" diye okur; cevabı
 * en baştan verirsek metni okur, cevabı vermezsek kapatmanın yolunu arar.
 * ---------------------------------------------------------------------------
 * NEREDE SAKLANIYOR
 *
 * `localStorage`, kamp başına bir anahtar. Sunucuda bir alan açmadık: burada
 * korunan şey bir hak ya da kural değil, yalnızca "bu metni gördüm" bilgisi.
 * Yanlış tarafa düşerse (tarayıcı temizlendi, başka cihaz) bedeli, bir kez
 * daha görünen bir rehber — kabul edilebilir.
 *
 * `localStorage` erişilemiyorsa GÖSTERMEME tarafına düşüyoruz: her açılışta
 * çıkan bir "tek seferlik" ekran, hiç çıkmayandan daha kötü. Rehber zaten
 * formun altındaki bağlantıdan her zaman açılabiliyor.
 * ============================================================================
 */
import {useEffect, useRef} from "react";

import {Button} from "@/components/ui/Button";
import type {NoteKind} from "@/lib/notes/rules";
import {NotesGuide} from "./NotesGuide";

const STORAGE_PREFIX = "pru:notes-guide-seen:";

/** Bu kampta karşılama ekranı daha önce onaylandı mı? */
export function hasSeenNotesGuide(campSlug: string): boolean {
  /* Sunucuda ve localStorage kapalıyken "görüldü" sayıyoruz — bkz. başlık */
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + campSlug) === "1";
  } catch {
    return true;
  }
}

function markSeen(campSlug: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + campSlug, "1");
  } catch {
    /* Yazamadıysak da akış durmasın; en kötü ihtimalle bir kez daha çıkar */
  }
}

export function FirstNoteGuide({
  campSlug,
  weekNumber,
  kind,
  onDone,
  onCancel,
}: {
  campSlug: string;
  /** Onaydan sonra hangi haftaya yazılacağı — beklentiyi baştan söylüyoruz */
  weekNumber: number;
  /** Seçilmiş tür varsa rehber o türün yönergesini öne alır */
  kind?: NoteKind;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialogRef.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/75 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-note-guide-title"
        aria-describedby="first-note-guide-description"
        tabIndex={-1}
        className="reveal-soft relative max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-xl border-2 border-line-accent bg-elevated shadow-[var(--shadow-action-hover)] outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header
          className="relative overflow-hidden border-b border-line-accent px-5 py-6 sm:px-7"
          style={{
            background:
              "radial-gradient(circle at 92% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 45%), linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, var(--bg-elevated)), var(--bg-elevated))",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1.5 bg-accent"
          />

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="İlk not rehberini kapat"
              className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-md border border-line-strong bg-surface/75 text-lg text-fg-secondary transition-colors hover:border-line-accent hover:text-fg"
            >
              ×
            </button>
          )}

          <span className="inline-flex items-center rounded-full border border-line-accent bg-accent px-3 py-1 text-xs font-extrabold tracking-[0.14em] text-accent-fg uppercase shadow-[var(--shadow-action)]">
            İlk Not Rehberi · Tek Seferlik
          </span>

          <h2
            id="first-note-guide-title"
            className="mt-4 pr-10 text-2xl leading-tight font-extrabold tracking-tight md:text-3xl"
          >
            İlk Notundan Önce —{" "}
            <span className="text-accent-text">Kısa Bir Açıklama</span>
          </h2>

          <p
            id="first-note-guide-description"
            className="mt-3 max-w-2xl text-base leading-relaxed text-fg-secondary"
          >
            Bu rehber ilk notunda{" "}
            <strong className="font-extrabold text-accent-text">
              yalnızca bir kez
            </strong>{" "}
            gösterilir. Onayladıktan sonra doğrudan not formuna geçersin ve
            sonraki notlarında otomatik olarak tekrar açılmaz.
          </p>
        </header>

        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <NotesGuide variant="write" kind={kind} />

          <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-line bg-elevated/95 p-4 backdrop-blur sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:p-6">
            <Button
              variant="accent"
              onClick={() => {
                markSeen(campSlug);
                onDone();
              }}
            >
              Okudum, Anladım — {weekNumber}. Haftaya Yazmaya Başla
            </Button>

            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Vazgeç
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
