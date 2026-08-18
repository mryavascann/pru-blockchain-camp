"use client";

/**
 * ============================================================================
 * Bir kamptaki rozetler ve alma akışı
 *
 * Her hafta üç durumdan birinde (bkz. /api/proofs):
 *
 *   alındı              → amber onay, işlem yok
 *   alınabilir          → "Rozeti Al" aktif
 *   yayın bekliyor      → bilgi metni, buton YOK
 *
 * ÜÇÜNCÜ DURUM NEDEN ÖNEMLİ:
 * Merkle kökü zincire yazılmadan buton gösterseydik, kullanıcı tıklar,
 * cüzdanını onaylar, GAS ÖDER ve işlem `InvalidMerkleProof` ile geri dönerdi.
 * Başarısız bir işlem için para harcatmak kabul edilemez.
 * ============================================================================
 */
import {useQuery} from "@tanstack/react-query";
import {useState} from "react";

import {Button} from "@/components/ui/Button";
import {Card, Pill} from "@/components/ui/Card";
import {ProgressBoxes, SkeletonLines} from "@/components/ui/Progress";
import {TxStatus} from "@/components/wallet/TxStatus";
import {pruCampBadgesAbi} from "@/lib/chain/abi";
import {contractAddress} from "@/lib/chain/config";
import {useTransaction} from "@/lib/hooks/useTransaction";
import {fmt, t} from "@/lib/i18n";

type ProofsResponse = {
  camp: {id: number; slug: string; name: string};
  requiresNickname: boolean;
  weeks: {weekNumber: number; proof: `0x${string}`[]; alreadyClaimed: boolean}[];
  claimableWeekNumbers: number[];
  claimableProofs: `0x${string}`[][];
  pendingPublication: number[];
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
  const [justClaimed, setJustClaimed] = useState<number[]>([]);

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
          const isNew = justClaimed.includes(week);

          return (
            <div
              key={week}
              title={
                isOwned
                  ? `${fmt(t.camp.weekLabel, {n: week})} — ${t.profile.claimed}`
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
                  : isClaimable
                    ? "border-line-accent bg-subtle text-accent-text"
                    : isPending
                      ? "border-dashed border-line-strong text-fg-muted"
                      : "border-line bg-subtle text-fg-muted opacity-50",
              ].join(" ")}
            >
              {isOwned ? "★" : week}
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
