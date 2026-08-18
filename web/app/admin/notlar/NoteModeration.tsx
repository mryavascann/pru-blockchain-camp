"use client";

/**
 * Not denetim listesi — gizle / geri aç.
 *
 * SİLME YOK, bilinçli: gizlenen not veritabanında durur. Yanlışlıkla
 * gizlenirse geri alınır, ve "benim notum nerede" sorusuna cevap verilebilir.
 *
 * ⚠️ Gizlemek, yazarın o hafta için NOT BORCUNU KAPATMAYA DEVAM EDER —
 * yani gizlenen notun sahibinin açılmış haftası geri kapanmaz, aldığı rozet
 * geri alınmaz. Gerekçe lib/notes/service.ts'te; özeti: bir yaptırımı sessiz
 * bir yan etki olarak uygulamak yerine, yönetim kişiyle konuşmalı.
 */
import {useState} from "react";
import {useRouter} from "next/navigation";

import {AddressChip} from "@/components/ui/Address";
import {Button} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";
import {NoteBody} from "@/components/notes/NoteBody";
import {noteKindIcon, noteKindLabel} from "@/lib/notes/rules";

type AdminNote = {
  id: string;
  campName: string;
  campSlug: string;
  weekNumber: number;
  kind: string;
  title: string;
  body: string;
  sourceUrl: string | null;
  aiAssisted: boolean;
  authorNickname: string;
  address: string;
  status: string;
  createdAt: string;
};

export function NoteModeration({notes}: {notes: AdminNote[]}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | "VISIBLE" | "HIDDEN">("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = notes.filter((n) =>
    filter === "ALL" ? true : n.status === filter,
  );

  async function toggle(note: AdminNote) {
    setBusy(note.id);
    setError(null);

    try {
      const response = await fetch("/api/admin/notes", {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          noteId: note.id,
          status: note.status === "HIDDEN" ? "VISIBLE" : "HIDDEN",
        }),
      });

      const json = await response.json();
      if (json.ok) router.refresh();
      else setError(json.error ?? "İşlem başarısız.");
    } catch {
      setError("Bağlantı sorunu.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["ALL", "Tümü"],
            ["VISIBLE", "Görünür"],
            ["HIDDEN", "Gizlenmiş"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={[
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === value
                ? "border-line-accent bg-subtle text-accent-text"
                : "border-line text-fg-secondary hover:text-fg",
            ].join(" ")}
          >
            {label}
            <span className="ml-2 tabular-nums opacity-70">
              {value === "ALL"
                ? notes.length
                : notes.filter((n) => n.status === value).length}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title="Not yok"
          description="Katılımcılar not bıraktıkça burada görünecek."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((note) => (
            <Card key={note.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="accent">
                    <span aria-hidden="true">{noteKindIcon(note.kind)}</span>
                    {noteKindLabel(note.kind)}
                  </Pill>
                  <Pill tone="muted">
                    {note.campName} · {note.weekNumber}. hafta
                  </Pill>
                  {note.aiAssisted && (
                    <Pill tone="neutral" className="!text-warning !border-warning">
                      🤖 yapay zekâ
                    </Pill>
                  )}
                  {note.status === "HIDDEN" && (
                    <Pill tone="danger">gizlenmiş</Pill>
                  )}
                </div>

                <Button
                  size="sm"
                  variant={note.status === "HIDDEN" ? "secondary" : "danger"}
                  loading={busy === note.id}
                  disabled={busy !== null}
                  onClick={() => toggle(note)}
                >
                  {note.status === "HIDDEN" ? "Geri aç" : "Gizle"}
                </Button>
              </div>

              <h3 className="mt-3 font-bold leading-snug">{note.title}</h3>

              <div className="mt-2">
                <NoteBody text={note.body} />
              </div>

              {note.sourceUrl && (
                <p className="mono mt-2 break-all text-xs text-fg-muted">
                  {note.sourceUrl}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-2.5 text-xs text-fg-muted">
                <AddressChip
                  address={note.address}
                  nickname={note.authorNickname}
                />
                <span>
                  {new Date(note.createdAt).toLocaleString("tr-TR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
