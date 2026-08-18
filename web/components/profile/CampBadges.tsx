"use client";

/**
 * ============================================================================
 * Bir kamptaki rozetler ve alma akışı
 *
 * Her hafta dört durumdan birinde (bkz. /api/proofs):
 *
 *   alındı              → amber onay, işlem yok
 *   alınabilir          → "Rozeti Al" aktif
 *   NOT BEKLİYOR        → önce ortak deftere not bırakılmalı
 *   yayın bekliyor      → bilgi metni, buton YOK
 *
 * "YAYIN BEKLİYOR" NEDEN ÖNEMLİ:
 * Merkle kökü zincire yazılmadan buton gösterseydik, kullanıcı tıklar,
 * cüzdanını onaylar, GAS ÖDER ve işlem `InvalidMerkleProof` ile geri dönerdi.
 * Başarısız bir işlem için para harcatmak kabul edilemez.
 *
 * "NOT BEKLİYOR" NEREDE UYGULANIYOR:
 * Burada değil — sunucuda. `/api/proofs` not borcu olan haftanın proof'unu
 * yanıta koymaz. Bu ekrandaki form bir kolaylık; şartın kendisi değil.
 * Aşağıdaki `disabled` özniteliğini tarayıcıdan kaldıran biri yine
 * mintleyemez, çünkü elinde proof yoktur.
 * ============================================================================
 */
import {useQuery} from "@tanstack/react-query";
import {useState} from "react";

import Link from "next/link";
import {useRouter} from "next/navigation";

import {Button} from "@/components/ui/Button";
import {Card, Pill} from "@/components/ui/Card";
import {NoteComposer} from "@/components/notes/NoteComposer";
import {NotesGuide} from "@/components/notes/NotesGuide";
import {ProgressBoxes, SkeletonLines} from "@/components/ui/Progress";
import {TxStatus} from "@/components/wallet/TxStatus";
import {pruCampBadgesAbi} from "@/lib/chain/abi";
import {contractAddress} from "@/lib/chain/config";
import {useTransaction} from "@/lib/hooks/useTransaction";
import {fmt, t} from "@/lib/i18n";

type ProofsResponse = {
  camp: {id: number; slug: string; name: string};
  requiresNickname: boolean;
  weeks: {
    weekNumber: number;
    proof: `0x${string}`[];
    alreadyClaimed: boolean;
    needsNote: boolean;
  }[];
  claimableWeekNumbers: number[];
  claimableProofs: `0x${string}`[][];
  pendingPublication: number[];
  /** Rozeti almak için önce not yazılması gereken haftalar */
  needsNote: number[];
  progress: {
    entitledWeek: number;
    entryWeek: number;
    visibleWeek: number;
    owedWeeks: number[];
    blockingWeek: number | null;
  };
};

export function CampBadges({
  campSlug,
  campName,
  campId,
  weekCount,
  progress,
}: {
  campSlug: string;
  campName: string;
  campId: number;
  weekCount: number;
  /** Zincirden okunmuş ilerleme (sunucuda hesaplandı) */
  progress: boolean[];
}) {
  const router = useRouter();
  const [justClaimed, setJustClaimed] = useState<number[]>([]);
  /** Not formu açık mı — hangi hafta için */
  const [writingFor, setWritingFor] = useState<number | null>(null);

  const proofs = useQuery({
    queryKey: ["proofs", campSlug],
    queryFn: async (): Promise<ProofsResponse> => {
      const response = await fetch(`/api/proofs?camp=${campSlug}`, {
        cache: "no-store",
      });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    },
  });

  const tx = useTransaction(() => {
    // Zincirde onaylandı: listeyi tazele ve kazanma animasyonunu tetikle
    setJustClaimed(proofs.data?.claimableWeekNumbers ?? []);
    setTimeout(() => proofs.refetch(), 1500);
  });

  const data = proofs.data;
  const claimable = data?.claimableWeekNumbers ?? [];
  const pending = data?.pendingPublication ?? [];
  const needsNote = data?.needsNote ?? [];
  const owned = progress.filter(Boolean).length;

  function claimAll() {
    if (!data || claimable.length === 0) return;

    tx.send({
      address: contractAddress,
      abi: pruCampBadgesAbi,
      functionName: "claimBatch",
      args: [
        BigInt(campId),
        claimable.map((w) => BigInt(w)),
        data.claimableProofs,
      ],
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{campName}</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            {fmt(t.camp.progressOf, {done: owned, total: weekCount})} {t.camp.weeks}
          </p>
        </div>

        {owned > 0 && (
          <Pill tone="reward">
            {owned} {t.profile.badges.toLowerCase()}
          </Pill>
        )}
      </div>

      <div className="mt-4">
        <ProgressBoxes progress={progress} showCount={false} />
      </div>

      {/* ---- Rozet ızgarası ---- */}
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {Array.from({length: weekCount}, (_, index) => {
          const week = index + 1;
          const isOwned = progress[index];
          const isClaimable = claimable.includes(week);
          const isPending = pending.includes(week);
          const needsNoteForWeek = needsNote.includes(week);
          const isNew = justClaimed.includes(week);

          return (
            <div
              key={week}
              title={
                isOwned
                  ? `${fmt(t.camp.weekLabel, {n: week})} — ${t.profile.claimed}`
                  : needsNoteForWeek
                    ? `${fmt(t.camp.weekLabel, {n: week})} — önce notunu bırak`
                    : isClaimable
                      ? `${fmt(t.camp.weekLabel, {n: week})} — ${t.profile.claimBadge}`
                      : isPending
                        ? `${fmt(t.camp.weekLabel, {n: week})} — ${t.profile.pendingPublication}`
                        : fmt(t.camp.weekLabel, {n: week})
              }
              className={[
                "grid aspect-square place-items-center rounded-lg border text-sm font-bold transition-colors",
                isNew ? "badge-earned" : "",
                isOwned
                  ? "border-reward bg-subtle text-reward"
                  : needsNoteForWeek
                    ? "border-warning bg-subtle text-warning"
                    : isClaimable
                      ? "border-line-accent bg-subtle text-accent-text"
                      : isPending
                        ? "border-dashed border-line-strong text-fg-muted"
                        : "border-line bg-subtle text-fg-muted opacity-50",
              ].join(" ")}
            >
              {isOwned ? "★" : needsNoteForWeek ? "📓" : week}
            </div>
          );
        })}
      </div>

      {/* ---- Eylemler ---- */}
      <div className="mt-6 flex flex-col gap-3">
        {proofs.isLoading && <SkeletonLines count={2} />}

        {data?.requiresNickname && (
          <p className="rounded-lg border border-line-accent bg-subtle p-3 text-sm">
            {t.errors.nicknameRequired}
          </p>
        )}

        {/* ---- NOT KAPISI: rozetten önce gelen adım ---- */}
        {needsNote.length > 0 && (
          <div className="rounded-lg border border-warning bg-subtle p-4">
            <p className="font-bold">
              <span aria-hidden="true">📓</span> {needsNote[0]}. haftanın
              rozetini almadan önce bir not bırak
            </p>

            <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
              Bu haftayı tamamladın. Rozetini alabilmen ve bir sonraki haftanın
              açılması için ortak deftere bir not bırakman gerekiyor.{" "}
              <strong className="text-fg">
                Bu haftada anlamadığın bir terimi araştırıp öğrendiysen,
                öğrendiğini buraya yazman yeterli
              </strong>{" "}
              — senin 3 dakikanı almış bir soru, senden sonra gelen on kişinin
              yarım saatini kurtarır.
            </p>

            {needsNote.length > 1 && (
              <p className="mt-2 text-sm text-fg-secondary">
                Not bekleyen haftalar: {needsNote.join(", ")}. Sırayla
                yazabilirsin.
              </p>
            )}

            {writingFor === null ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  onClick={() => setWritingFor(needsNote[0])}
                >
                  {needsNote[0]}. hafta için not bırak
                </Button>
                <Link
                  href={`/kamplar/${campSlug}/notlar`}
                  className="inline-flex items-center text-sm font-semibold text-accent-text underline underline-offset-4"
                >
                  Başkalarının notlarını oku →
                </Link>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-line bg-surface p-4">
                <NoteComposer
                  campSlug={campSlug}
                  weekNumber={writingFor}
                  onCancel={() => setWritingFor(null)}
                  onSaved={() => {
                    setWritingFor(null);
                    /*
                     * Not kaydedildi: artık bu haftanın proof'u yanıta
                     * girecek. Listeyi tazeleyip "Rozeti Al" butonunu
                     * açıyoruz.
                     */
                    proofs.refetch();
                    router.refresh();
                  }}
                />

                <div className="mt-6">
                  <NotesGuide variant="write" />
                </div>
              </div>
            )}
          </div>
        )}

        {claimable.length > 0 && (
          <Button
            variant="accent"
            size="lg"
            loading={tx.isBusy}
            disabled={data?.requiresNickname}
            onClick={claimAll}
          >
            {tx.isBusy
              ? t.profile.claiming
              : fmt(t.profile.claimAll, {n: claimable.length})}
          </Button>
        )}

        {pending.length > 0 && (
          <div className="rounded-lg border border-dashed border-line-strong p-3">
            <p className="text-sm font-semibold">
              {t.profile.pendingPublication} ({pending.join(", ")}. hafta)
            </p>
            <p className="mt-1 text-xs text-fg-secondary">
              {t.profile.pendingPublicationHelp}
            </p>
          </div>
        )}

        {!proofs.isLoading &&
          claimable.length === 0 &&
          pending.length === 0 &&
          needsNote.length === 0 &&
          owned === 0 && (
            <div className="rounded-lg border border-dashed border-line p-4 text-center">
              <p className="text-sm font-semibold">{t.profile.noBadges}</p>
              <p className="mt-1 text-xs text-fg-secondary">
                {t.profile.noBadgesHelp}
              </p>
            </div>
          )}

        <TxStatus
          state={tx.state}
          hash={tx.hash}
          error={tx.error}
          successMessage={`${claimable.length} rozet cüzdanına eklendi.`}
          onRetry={tx.reset}
        />
      </div>
    </Card>
  );
}
