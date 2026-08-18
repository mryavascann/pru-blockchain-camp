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
 *
 * ---------------------------------------------------------------------------
 * YAZMA AKIŞI — HAFTA SEÇİCİ İKİ İŞ BİRDEN YAPIYOR
 *
 * Önceden tek bir "+ Not bırak" düğmesi vardı; form açılınca kişinin gördüğü
 * İLK şey dört tür kartıydı, yani forma girer girmez bir karar ekranı. Bir de
 * ayrı bir tür FİLTRESİ vardı — aynı dört seçenek ekranda iki kez.
 *
 * Şimdi tek bir seçici var: HAFTA. Seçilen hafta hem listeyi süzüyor hem de
 * yazılacak haftayı belirliyor; hemen altında o haftaya not bırakma türleri
 * yumuşakça açılıyor. "Hangi haftaya yazıyorum?" diye ayrı bir karar yok.
 *
 * Tür filtresi kaldırıldı: bir haftada zaten birkaç not oluyor, süzmeye değecek
 * bir yığın yok — ama ekranda sürekli bir sıra çip yer kaplıyordu.
 *
 * Yazarken ekran TEK SÜTUNA düşüyor: sağdaki okuma rehberi gizleniyor,
 * seçiciler ve liste zaten kapanıyordu. Yazan kişinin ekranında yalnızca
 * yazma işi kalıyor.
 * ---------------------------------------------------------------------------
 */
import {useMemo, useState, type ReactNode} from "react";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/Button";
import {Card, EmptyState} from "@/components/ui/Card";
import {NoteCard, type NoteView} from "@/components/notes/NoteCard";
import {NoteComposer, type ComposerResult} from "@/components/notes/NoteComposer";
import {NotesGuide} from "@/components/notes/NotesGuide";
import {
  FirstNoteGuide,
  hasSeenNotesGuide,
} from "@/components/notes/FirstNoteGuide";
import {NOTE_KIND_LIST, type NoteKind} from "@/lib/notes/rules";
import {
  KIND_HOVER_BORDER,
  KIND_TEXT,
  LockIcon,
  NoteKindIcon,
} from "@/components/notes/kindVisuals";
import {formatRemaining} from "@/lib/notes/schedule";

type Progress = {
  entitledWeek: number;
  entryWeek: number;
  visibleWeek: number;
  owedWeeks: number[];
  notedWeeks: number[];
  blockingWeek: number | null;
  nextWeekAt: string | null;
};

export function NotesBoard({
  campSlug,
  weekCount,
  initialNotes,
  initialWeekFilter,
  progress,
  guide,
}: {
  campSlug: string;
  weekCount: number;
  initialNotes: NoteView[];
  /** `?hafta=3` ile gelindiyse o hafta seçili açılır */
  initialWeekFilter?: number;
  progress: Progress;
  /** Sağ sütundaki okuma rehberi — yazarken gizlenir */
  guide?: ReactNode;
}) {
  const router = useRouter();

  const [notes, setNotes] = useState(initialNotes);
  const [weekFilter, setWeekFilter] = useState<number | "all">(
    initialWeekFilter ?? "all",
  );

  /** Yazma paneli: hangi hafta, hangi tür, düzenlenen not var mı */
  const [composer, setComposer] = useState<
    null | {weekNumber: number; kind?: NoteKind; existing?: NoteView}
  >(null);

  /** Formun altındaki uzun rehber — her zaman kapalı başlar, isteyen açar */
  const [showWriteGuide, setShowWriteGuide] = useState(false);

  /**
   * Tek seferlik karşılama ekranı onaylandı mı?
   *
   * `localStorage` okuması burada güvenli: yazma paneli yalnızca bir tıklamayla
   * açılıyor, yani bu bileşen sunucuda render edilirken karşılama ekranı
   * ağaçta hiç yok — hidrasyon uyuşmazlığı çıkaracak bir çıktı üretmiyor.
   */
  const [guideSeen, setGuideSeen] = useState(() => hasSeenNotesGuide(campSlug));

  /*
   * Karşılama ekranı üç şart birden tutunca çıkar: yeni bir not yazılıyor
   * (düzenleme değil), kişinin bu kampta hiç notu yok ve ekran daha önce
   * onaylanmamış.
   */
  const showIntro = Boolean(
    composer &&
      !composer.existing &&
      progress.notedWeeks.length === 0 &&
      !guideSeen,
  );

  const [flash, setFlash] = useState<string | null>(null);
  const [nextWeekAt, setNextWeekAt] = useState(progress.nextWeekAt);

  const visibleWeeks = Array.from(
    {length: progress.visibleWeek},
    (_, index) => index + 1,
  );

  const filtered = useMemo(() => {
    if (weekFilter === "all") return notes;
    return notes.filter((note) => note.weekNumber === weekFilter);
  }, [notes, weekFilter]);

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
    const nextOpening = result.unlocked?.nextWeekAt ?? null;
    setNextWeekAt(nextOpening);
    const remaining = nextOpening
      ? formatRemaining(new Date(nextOpening))
      : null;
    setFlash(
      opened
        ? `Notun kaydedildi. ${opened}. hafta açıldı ve ${saved.weekNumber}. haftanın rozeti artık alınabilir.`
        : result.unlocked
          ? `Notun kaydedildi. ${saved.weekNumber}. haftanın rozeti artık alınabilir.${
              remaining
                ? ` Sonraki haftanın kişisel açılışına yaklaşık ${remaining} var.`
                : ""
            }`
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
    <div
      className={
        composer
          ? "flex flex-col"
          : "grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"
      }
    >
      <div className="flex flex-col gap-5">
        {/* ---------------- Not borcu uyarısı ---------------- */}
        {progress.owedWeeks.length > 0 && !composer && (
          <Card accent>
            <p className="font-bold">
              {progress.owedWeeks[0]}. Hafta İçin Notunu Bekliyoruz
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
                {progress.owedWeeks[0]}. Hafta İçin Not Bırak
              </Button>
            </div>
          </Card>
        )}

        {progress.owedWeeks.length === 0 &&
          progress.entitledWeek < weekCount &&
          nextWeekAt &&
          !composer && (
            <Card>
              <p className="font-bold">
                ✓ {progress.entitledWeek}. Hafta Notun Tamamlandı
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
                {formatRemaining(new Date(nextWeekAt)) ? (
                  <>
                    {progress.entitledWeek + 1}. haftanın planlanan açılışına
                    yaklaşık{" "}
                    <strong className="text-fg">
                      {formatRemaining(new Date(nextWeekAt))}
                    </strong>{" "}
                    var.
                  </>
                ) : (
                  <>
                    Süre doldu; sayfayı yenilediğinde{" "}
                    {progress.entitledWeek + 1}. hafta açılacak.
                  </>
                )}{" "}
                Yeni bir not eklemen gerekmiyor. Bu sayaç yalnızca bu cüzdanın
                bu kamptaki ilerlemesine aittir; diğer katılımcıları etkilemez.
              </p>
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
        {composer && showIntro && (
          <Card accent>
            <FirstNoteGuide
              campSlug={campSlug}
              weekNumber={composer.weekNumber}
              kind={composer.kind}
              onDone={() => setGuideSeen(true)}
              onCancel={() => setComposer(null)}
            />
          </Card>
        )}

        {composer && !showIntro && (
          <Card accent>
            <h2 className="text-lg font-bold tracking-tight">
              {composer.existing ? "Notunu Düzenle" : "Yeni Not"} —{" "}
              {composer.weekNumber}. Hafta
            </h2>

            <div className="mt-4">
              <NoteComposer
                campSlug={campSlug}
                weekNumber={composer.weekNumber}
                initialKind={composer.kind}
                existing={composer.existing}
                firstNote={progress.notedWeeks.length === 0}
                onKindChange={(kind) =>
                  setComposer((current) =>
                    current ? {...current, kind} : current,
                  )
                }
                onSaved={handleSaved}
                onCancel={() => setComposer(null)}
              />
            </div>

            {/* Uzun yazma rehberi — bağlantının arkasında */}
            {!composer.existing && (
              <div className="mt-5 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowWriteGuide((v) => !v)}
                  className="text-sm font-semibold text-accent-text underline underline-offset-2"
                >
                  {showWriteGuide
                    ? "Rehberi gizle"
                    : "İyi not nasıl olur? Örnekler ve beklentiler →"}
                </button>

                {showWriteGuide && (
                  <div className="mt-3">
                    <NotesGuide variant="write" kind={composer.kind} />
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* -------- Hafta seçici — hem filtre HEM yazma hedefi -------- */}
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
                {notes.length > 0 && (
                  <span className="ml-1 tabular-nums opacity-60">
                    · {notes.length} Not
                  </span>
                )}
              </FilterChip>

              {visibleWeeks.map((week) => {
                const count = countsByWeek.get(week) ?? 0;
                return (
                  <FilterChip
                    key={week}
                    active={weekFilter === week}
                    /* Boş hafta soluk durur: hangi haftada malzeme var,
                       tek bakışta görünsün */
                    dim={count === 0}
                    onClick={() => setWeekFilter(week)}
                  >
                    {week}. Hafta
                    {count > 0 && (
                      <span className="ml-1 tabular-nums opacity-60">
                        · {count} Not
                      </span>
                    )}
                  </FilterChip>
                );
              })}

              {progress.visibleWeek < weekCount && (
                <span className="ml-1 inline-flex items-center gap-1 text-xs text-fg-muted">
                  <LockIcon className="h-3.5 w-3.5" />
                  {progress.visibleWeek + 1}–{weekCount} henüz açılmadı
                </span>
              )}
            </div>

            {/*
              Not bırakma, hafta seçicinin DEVAMI olarak açılıyor.
              Ayrı bir "hangi haftaya yazıyorum?" kararı yok: yukarıda
              seçtiğin hafta neyse, ona yazıyorsun.

              `key={weekFilter}` bilerek: başka bir haftaya geçince blok
              yeniden bağlanır ve açılış animasyonu tekrar oynar — "hedef
              değişti" bilgisini metin okumadan verir.
            */}
            {weekFilter === "all" ? (
              <p className="text-sm text-fg-muted">
                Not bırakmak için yukarıdan bir hafta seç.
              </p>
            ) : (
              <div
                key={weekFilter}
                className="reveal-soft rounded-lg border border-line-accent bg-subtle p-4"
              >
                <p className="text-sm font-semibold">
                  {weekFilter}. Hafta Not Eklemesi
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {NOTE_KIND_LIST.map((kind) => (
                    <button
                      key={kind.value}
                      type="button"
                      onClick={() =>
                        setComposer({
                          weekNumber: weekFilter,
                          kind: kind.value,
                        })
                      }
                      className={[
                        "inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg-secondary",
                        "transition-[transform,border-color,color] duration-150 ease-out",
                        "hover:-translate-y-px hover:text-fg",
                        KIND_HOVER_BORDER[kind.value],
                      ].join(" ")}
                    >
                      <NoteKindIcon
                        kind={kind.value}
                        className={`h-4 w-4 ${KIND_TEXT[kind.value]}`}
                      />
                      {kind.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                    ? "Bu Defter Henüz Boş"
                    : `${weekFilter}. Hafta Henüz Boş`
                }
                description={
                  notes.length === 0
                    ? "İlk notu sen bırakabilirsin. Bu haftada anlamadığın bir terimi araştırdıysan, öğrendiğini buraya yazman senden sonra gelen herkese zaman kazandırır."
                    : "İlk notu sen bırak — yukarıdaki türlerden birini seçmen yeterli."
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

      {/* Okuma rehberi — yazarken ekranda yeri yok */}
      {!composer && guide && (
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {guide}
        </aside>
      )}
    </div>
  );
}

function FilterChip({
  active,
  dim = false,
  onClick,
  children,
}: {
  active: boolean;
  /** İçi boş hafta — seçilebilir ama göze daha az girer */
  dim?: boolean;
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
          : dim
            ? "border-line text-fg-muted hover:border-line-strong hover:text-fg-secondary"
            : "border-line text-fg-secondary hover:border-line-strong hover:text-fg",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
