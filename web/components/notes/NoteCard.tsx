"use client";

/**
 * Tek bir not.
 *
 * Metin `NoteBody` ile basılır — o dosyada `dangerouslySetInnerHTML` yok,
 * olmamalı da (bkz. components/notes/NoteBody.tsx).
 *
 * ---------------------------------------------------------------------------
 * UZUN NOTLAR KISALTILIR
 *
 * Gövde 4000 karaktere kadar çıkabiliyor. Tek bir uzun not, listeyi tarayan
 * kişinin ekranını tamamen kaplıyor ve altındaki beş notu görünmez yapıyordu.
 * Belirli bir uzunluğun üstündeki notlar kısaltılıp "Devamını Oku" ile
 * açılıyor.
 *
 * Kısaltma SADECE GÖRSEL: metnin tamamı zaten sayfada (React düğümü olarak),
 * yalnızca kapsayıcının yüksekliği sınırlı. Ctrl+F ile arayan biri kapalı
 * nottaki kelimeyi de bulur.
 * ---------------------------------------------------------------------------
 */
import {useState} from "react";

import {Card, Pill} from "@/components/ui/Card";
import {isNoteKind, noteKindLabel, safeUrl} from "@/lib/notes/rules";
import {NoteBody} from "./NoteBody";
import {KIND_PILL, LinkIcon, NoteKindIcon, SparkleIcon} from "./kindVisuals";

export type NoteView = {
  id: string;
  weekNumber: number;
  kind: string;
  title: string;
  body: string;
  sourceUrl: string | null;
  aiAssisted: boolean;
  authorNickname: string;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Bu uzunluğun üstündeki notlar kısaltılır.
 *
 * 420 karakter, ekranda kabaca altı satır — bir notun "ne anlattığını"
 * anlamaya yeter, listeyi ele geçirmeye yetmez.
 */
const CLAMP_ABOVE = 420;

export function NoteCard({
  note,
  onEdit,
  showWeek = true,
}: {
  note: NoteView;
  onEdit?: (note: NoteView) => void;
  showWeek?: boolean;
}) {
  /* Kaynak bağlantısı ekranda İKİNCİ kez doğrulanıyor — bkz. NoteBody */
  const source = safeUrl(note.sourceUrl);
  const edited = note.updatedAt !== note.createdAt;
  const kind = isNoteKind(note.kind) ? note.kind : null;

  const long =
    note.body.length > CLAMP_ABOVE || note.body.split("\n").length > 8;
  const [expanded, setExpanded] = useState(false);
  const clamped = long && !expanded;

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral" className={kind ? KIND_PILL[kind] : ""}>
            {kind && <NoteKindIcon kind={kind} className="h-3.5 w-3.5" />}
            {noteKindLabel(note.kind)}
          </Pill>

          {showWeek && <Pill tone="muted">{note.weekNumber}. Hafta</Pill>}

          {note.aiAssisted && (
            <Pill tone="neutral" className="!text-warning !border-warning">
              <SparkleIcon className="h-3.5 w-3.5" />
              Yapay Zekâ Yardımıyla
            </Pill>
          )}
        </div>

        {note.isMine && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="rounded-md border border-line px-2 py-1 text-xs font-medium text-fg-secondary transition-colors hover:border-line-accent hover:text-fg"
          >
            Düzenle
          </button>
        )}
      </div>

      <h3 className="mt-3 font-bold leading-snug">{note.title}</h3>

      <div
        className={[
          "mt-2",
          clamped ? "relative max-h-40 overflow-hidden" : "",
        ].join(" ")}
      >
        <NoteBody text={note.body} />

        {/* Kesme çizgisi yerine erime — metnin devamı olduğu hissi kalsın */}
        {clamped && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent"
          />
        )}
      </div>

      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 text-sm font-semibold text-accent-text underline underline-offset-2"
        >
          {expanded ? "Kısalt" : "Devamını Oku"}
        </button>
      )}

      {source && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-accent-text underline underline-offset-2"
        >
          <LinkIcon className="h-4 w-4" />
          <span className="truncate">{source}</span>
        </a>
      )}

      <p className="mt-3 border-t border-line pt-2.5 text-xs text-fg-muted">
        <span className="font-semibold text-fg-secondary">
          {note.authorNickname}
        </span>
        {" · "}
        {new Date(note.createdAt).toLocaleDateString("tr-TR", {
          dateStyle: "medium",
        })}
        {edited && " · düzenlendi"}
        {note.isMine && " · senin notun"}
      </p>
    </Card>
  );
}
