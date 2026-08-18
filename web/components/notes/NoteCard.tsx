"use client";

/**
 * Tek bir not.
 *
 * Metin `NoteBody` ile basılır — o dosyada `dangerouslySetInnerHTML` yok,
 * olmamalı da (bkz. components/notes/NoteBody.tsx).
 */
import {Card, Pill} from "@/components/ui/Card";
import {noteKindIcon, noteKindLabel, safeUrl} from "@/lib/notes/rules";
import {NoteBody} from "./NoteBody";

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

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="accent">
            <span aria-hidden="true">{noteKindIcon(note.kind)}</span>
            {noteKindLabel(note.kind)}
          </Pill>

          {showWeek && <Pill tone="muted">{note.weekNumber}. hafta</Pill>}

          {note.aiAssisted && (
            <Pill tone="neutral" className="!text-warning !border-warning">
              <span aria-hidden="true">🤖</span>
              yapay zekâ yardımıyla
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

      <div className="mt-2">
        <NoteBody text={note.body} />
      </div>

      {source && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-3 inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-accent-text underline underline-offset-2"
        >
          <span aria-hidden="true">🔗</span>
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
