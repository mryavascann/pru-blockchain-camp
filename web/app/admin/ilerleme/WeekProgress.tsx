"use client";

/**
 * Haftalık ilerleme işaretleme ekranı.
 *
 * Faz 0 şartı burada da geçerli: OTOMASYON YOK. Katılım takibi, otomatik
 * doğrulama, skorlama yok — basit bir liste ve senin kararın.
 *
 * Listedeki her satır üç bilgi gösterir:
 *   • kişi bu haftayı tamamlamış mı (işaretin)
 *   • bu hafta için not bırakmış mı
 *   • geriye dönük not borcu var mı  ← rozetini alamıyor demektir
 */
import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";

import {AddressChip} from "@/components/ui/Address";
import {Button} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";

type Participant = {
  address: string;
  nickname: string | null;
  declaredWeek: number;
  entitledWeek: number;
  markedThisWeek: boolean;
  hasNoteThisWeek: boolean;
  owedWeeks: number[];
};

type CampRef = {id: number; slug: string; name: string; weekCount: number};

export function WeekProgress({
  camps,
  camp,
  weekNumber,
  participants,
}: {
  camps: CampRef[];
  camp: CampRef;
  weekNumber: number;
  participants: Participant[];
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unmarked = useMemo(
    () => participants.filter((p) => !p.markedThisWeek),
    [participants],
  );
  const markedCount = participants.length - unmarked.length;

  function toggle(address: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  }

  async function submit(method: "POST" | "DELETE") {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/completions", {
        method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          campId: camp.id,
          weekNumber,
          addresses: [...selected],
        }),
      });
      const json = await response.json();

      if (json.ok) {
        setMessage(
          method === "POST"
            ? `${json.data.created} kişi işaretlendi` +
                (json.data.skipped > 0
                  ? ` (${json.data.skipped} zaten işaretliydi).`
                  : ".") +
                ` ${json.data.nextStep}`
            : `${json.data.deleted} kayıt geri alındı. ${json.data.warning}`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        setError(json.error ?? "İşlem başarısız.");
      }
    } catch {
      setError("Bağlantı sorunu.");
    } finally {
      setBusy(false);
    }
  }

  function go(nextCamp: string, nextWeek: number) {
    router.push(`/admin/ilerleme?kamp=${nextCamp}&hafta=${nextWeek}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- Kamp ve hafta seçimi ---------------- */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {camps.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => go(option.slug, 1)}
              aria-pressed={option.id === camp.id}
              className={[
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                option.id === camp.id
                  ? "border-line-accent bg-subtle text-accent-text"
                  : "border-line text-fg-secondary hover:text-fg",
              ].join(" ")}
            >
              {option.name}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-sm font-semibold">
            Hangi haftayı işaretliyorsun?
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({length: camp.weekCount}, (_, i) => i + 1).map((week) => (
              <button
                key={week}
                type="button"
                onClick={() => go(camp.slug, week)}
                aria-pressed={week === weekNumber}
                className={[
                  "h-8 w-8 rounded-md border text-xs font-semibold transition-colors",
                  week === weekNumber
                    ? "border-line-accent bg-accent text-accent-fg"
                    : "border-line text-fg-secondary hover:border-line-strong",
                ].join(" ")}
              >
                {week}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ---------------- Ne olacağının açıklaması ---------------- */}
      <div className="rounded-lg border border-line-accent bg-subtle p-4 text-sm leading-relaxed">
        <p className="font-semibold">
          {weekNumber}. haftayı işaretlediğinde ne olur?
        </p>
        <ol className="mt-2 flex list-inside list-decimal flex-col gap-1 text-fg-secondary">
          <li>
            Seçtiğin kişiler için &ldquo;{weekNumber}. haftayı tamamladı&rdquo;
            kaydı açılır.
          </li>
          <li>
            Bu kişiler <strong className="text-fg">{weekNumber}. hafta için
            ortak deftere not bırakana kadar</strong> ne o haftanın rozetini
            alabilir ne de {weekNumber + 1}. haftayı görebilir.
          </li>
          <li>
            Notu bırakınca rozet açılır ve {weekNumber + 1}. hafta görünür
            hâle gelir.
          </li>
          <li>
            Rozetin gerçekten alınabilmesi için ayrıca{" "}
            <strong className="text-fg">Merkle</strong> sekmesinden ağacı
            üretip kökü zincire yazman gerekir.
          </li>
        </ol>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-lg border border-success bg-subtle p-3 text-sm text-success"
        >
          ✓ {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {/* ---------------- Liste ---------------- */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            {camp.name} — {weekNumber}. hafta
          </h2>
          <Pill tone={markedCount > 0 ? "accent" : "muted"}>
            {markedCount} / {participants.length} işaretli
          </Pill>
        </div>

        {participants.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Bu kampta onaylı katılımcı yok"
              description="Önce Başvurular sekmesinden başvuruları onayla."
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelected(new Set(unmarked.map((p) => p.address)))
                }
                disabled={unmarked.length === 0}
              >
                İşaretsizlerin tümünü seç ({unmarked.length})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                Seçimi temizle
              </Button>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {participants.map((participant) => {
                const checked = selected.has(participant.address);

                return (
                  <li key={participant.address}>
                    <label
                      className={[
                        "flex cursor-pointer flex-wrap items-center gap-3 rounded-md border p-3 transition-colors",
                        checked
                          ? "border-line-accent bg-subtle"
                          : "border-line hover:border-line-strong",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(participant.address)}
                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                      />

                      <span className="min-w-0 flex-1">
                        <AddressChip
                          address={participant.address}
                          nickname={participant.nickname ?? undefined}
                        />
                      </span>

                      <span className="flex flex-wrap items-center gap-1.5">
                        {participant.markedThisWeek && (
                          <Pill tone="accent">✓ bu hafta işaretli</Pill>
                        )}
                        {participant.hasNoteThisWeek && (
                          <Pill tone="reward">📓 notu var</Pill>
                        )}
                        {participant.owedWeeks.length > 0 && (
                          <Pill tone="danger">
                            not borcu: {participant.owedWeeks.join(", ")}
                          </Pill>
                        )}
                        <Pill tone="muted">
                          ulaştığı hafta: {participant.entitledWeek}
                        </Pill>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                variant="accent"
                loading={busy}
                disabled={selected.size === 0}
                onClick={() => submit("POST")}
              >
                {selected.size} kişiyi {weekNumber}. haftayı tamamladı olarak
                işaretle
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={busy}
                disabled={selected.size === 0}
                onClick={() => submit("DELETE")}
              >
                Seçilenlerin işaretini kaldır
              </Button>
            </div>

            <p className="mt-2 text-xs text-fg-muted">
              İşareti kaldırmak, zincirde ALINMIŞ bir rozeti silmez — zincir
              geri alınamaz. Yalnızca veritabanındaki hak ediş kaydı ve sonraki
              merkle ağacı etkilenir.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
