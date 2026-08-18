"use client";

/**
 * Not defteri — liste, filtreler ve yazma akışı.
 *
 * Sunucu ilk listeyi hazır gönderiyor (kilit sınırı uygulanmış hâlde);
 * filtreler bu liste üzerinde çalışıyor. Filtre için sunucuya gitmiyoruz
 * çünkü kişinin görebildiği not sayısı doğası gereği sınırlı — bir kampın
 * birkaç haftası, hafta başına birkaç not.
 *
 * ⚠️ Filtrelerin GÜVENLİK İŞLEVİ YOK. Görünürlük sınırı sunucudaki sorguda
 * uygulandı; buradaki hafta seçici yalnızca bir kolaylık.
 */
import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";
import {NoteCard, type NoteView} from "@/components/notes/NoteCard";
import {NoteComposer, type ComposerResult} from "@/components/notes/NoteComposer";
import {NotesGuide} from "@/components/notes/NotesGuide";
import {NOTE_KIND_LIST, type NoteKind} from "@/lib/notes/rules";

type Progress = {
  entitledWeek: number;
  entryWeek: number;
  visibleWeek: number;
  owedWeeks: number[];
  notedWeeks: number[];
  blockingWeek: number | null;
};

export function NotesBoard({
  campSlug,
  campName,
  weekCount,
  initialNotes,
  initialWeekFilter,
  progress,
}: {
  campSlug: string;
  campName: string;
  weekCount: number;
  initialNotes: NoteView[];
  /** `?hafta=3` ile gelindiyse o hafta seçili açılır */
  initialWeekFilter?: number;
  progress: Progress;
}) {
  const router = useRouter();

  const [notes, setNotes] = useState(initialNotes);
  const [weekFilter, setWeekFilter] = useState<number | "all">(
    initialWeekFilter ?? "all",
  );
  const [kindFilter, setKindFilter] = useState<NoteKind | "all">("all");

  /** Yazma paneli: hangi hafta için açık, düzenlenen not var mı */
  const [composer, setComposer] = useState<
    null | {weekNumber: number; existing?: NoteView}
  >(null);

  const [flash, setFlash] = useState<string | null>(null);

  const visibleWeeks = Array.from(
    {length: progress.visibleWeek},
    (_, index) => index + 1,
  );

  const filtered = useMemo(() => {
    return notes.filter((note) => {
      if (weekFilter !== "all" && note.weekNumber !== weekFilter) return false;
      if (kindFilter !== "all" && note.kind !== kindFilter) return false;
      return true;
    });
  }, [notes, weekFilter, kindFilter]);

  /** Hafta başına not sayısı — filtre düğmelerindeki rakam */
  const countsByWeek = useMemo(() => {
    const map = new Map<number, number>();
    for (const note of notes) {
      map.set(note.weekNumber, (map.get(note.weekNumber) ?? 0) + 1);
    }
    return map;
  }, [notes]);

  function handleSaved(result: ComposerResult) {
    const saved = result.note;

    setNotes((current) => {
      const without = current.filter((n) => n.id !== saved.id);
      return [saved, ...without].sort((a, b) =>
        a.weekNumber !== b.weekNumber
          ? a.weekNumber - b.weekNumber
          : b.createdAt.localeCompare(a.createdAt),
      );
    });

    const opened = result.unlocked?.openedWeek ?? null;
    setFlash(
      opened
        ? `Notun kaydedildi. ${opened}. hafta açıldı ve ${saved.weekNumber}. haftanın rozeti artık alınabilir.`
        : result.unlocked
          ? `Notun kaydedildi. ${saved.weekNumber}. haftanın rozeti artık alınabilir.`
          : "Notun güncellendi.",
    );

    setComposer(null);

    /*
     * Not yeni bir hafta açmış olabilir. Sunucu bileşenleri (kilit durumu,
     * müfredat kartları) yalnızca yenilenince güncellenir.
     */
    if (result.unlocked) router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- Not borcu uyarısı ---------------- */}
      {progress.owedWeeks.length > 0 && !composer && (
        <Card accent>
          <p className="font-bold">
            {progress.owedWeeks[0]}. hafta için notunu bekliyoruz
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
            Bu haftanın rozetini alabilmen{" "}
            {progress.entitledWeek > progress.owedWeeks[0] && (
              <>
                ve <strong className="text-fg">
                  {progress.owedWeeks[0] + 1}. haftanın açılması
                </strong>{" "}
              </>
            )}
            için bir not bırakman gerekiyor. Bu haftada öğrendiğin, takıldığın
            ya da birine anlatmak isteyeceğin ne varsa — o yeterli.
          </p>
          <div className="mt-3">
            <Button
              variant="accent"
              onClick={() =>
                setComposer({weekNumber: progress.owedWeeks[0]})
              }
            >
              {progress.owedWeeks[0]}. hafta için not bırak
            </Button>
          </div>
        </Card>
      )}

      {flash && (
        <p
          role="status"
          className="rounded-lg border border-success bg-subtle p-3 text-sm text-success"
        >
          ✓ {flash}
        </p>
      )}

      {/* ---------------- Yazma paneli ---------------- */}
      {composer && (
        <Card accent>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">
              {composer.existing ? "Notunu düzenle" : "Yeni not"} —{" "}
              {composer.weekNumber}. hafta
            </h2>
            <Pill tone="muted">{campName}</Pill>
          </div>

          <div className="mt-4">
            <NoteComposer
              campSlug={campSlug}
              weekNumber={composer.weekNumber}
              existing={composer.existing}
              onSaved={handleSaved}
              onCancel={() => setComposer(null)}
            />
          </div>

          {!composer.existing && (
            <div className="mt-6">
              <NotesGuide variant="write" />
            </div>
          )}
        </Card>
      )}

      {/* ---------------- Filtreler ---------------- */}
      {!composer && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-fg-muted">
              HAFTA
            </span>
            <FilterChip
              active={weekFilter === "all"}
              onClick={() => setWeekFilter("all")}
            >
              Tümü
            </FilterChip>
            {visibleWeeks.map((week) => (
              <FilterChip
                key={week}
                active={weekFilter === week}
                onClick={() => setWeekFilter(week)}
              >
                {week}
                <span className="ml-1 tabular-nums opacity-60">
                  {countsByWeek.get(week) ?? 0}
                </span>
              </FilterChip>
            ))}

            {progress.visibleWeek < weekCount && (
              <span className="ml-1 text-xs text-fg-muted">
                🔒 {progress.visibleWeek + 1}–{weekCount} henüz açılmadı
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-fg-muted">TÜR</span>
            <FilterChip
              active={kindFilter === "all"}
              onClick={() => setKindFilter("all")}
            >
              Tümü
            </FilterChip>
            {NOTE_KIND_LIST.map((kind) => (
              <FilterChip
                key={kind.value}
                active={kindFilter === kind.value}
                onClick={() => setKindFilter(kind.value)}
              >
                <span aria-hidden="true">{kind.icon}</span> {kind.label}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Not ekleme çağrısı ---------------- */}
      {!composer && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setComposer({
                weekNumber:
                  weekFilter !== "all" ? weekFilter : progress.visibleWeek,
              })
            }
          >
            + Not bırak
            {weekFilter !== "all"
              ? ` (${weekFilter}. hafta)`
              : ` (${progress.visibleWeek}. hafta)`}
          </Button>
          <span className="text-xs text-fg-muted">
            Bir hafta seçersen o haftaya yazarsın.
          </span>
        </div>
      )}

      {/* ---------------- Liste ---------------- */}
      {!composer && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<span className="text-3xl">📓</span>}
              title={
                notes.length === 0
                  ? "Bu defter henüz boş"
                  : "Bu filtreye uyan not yok"
              }
              description={
                notes.length === 0
                  ? "İlk notu sen bırakabilirsin. Bu haftada anlamadığın bir terimi araştırdıysan, öğrendiğini buraya yazman senden sonra gelen herkese zaman kazandırır."
                  : "Filtreyi değiştirip tekrar dene."
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  showWeek={weekFilter === "all"}
                  onEdit={(target) =>
                    setComposer({
                      weekNumber: target.weekNumber,
                      existing: target,
                    })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-line-accent bg-subtle text-accent-text"
          : "border-line text-fg-secondary hover:border-line-strong hover:text-fg",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
