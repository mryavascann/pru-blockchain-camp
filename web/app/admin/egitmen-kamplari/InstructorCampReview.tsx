"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {Button, ButtonLink} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";
import {TxStatus} from "@/components/wallet/TxStatus";
import {pruCampBadgesAbi} from "@/lib/chain/abi";
import {useAuth} from "@/lib/hooks/useAuth";
import {useTransaction} from "@/lib/hooks/useTransaction";

type Camp = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  instructorName: string | null;
  ownerAddress: string | null;
  weekCount: number;
  lifecycle: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  chainCampId: number | null;
  coverAssetId: string | null;
  reviewNote: string | null;
  updatedAt: string;
  weeks: {weekNumber: number; title: string; status: "DRAFT" | "PUBLISHED"; imageAssetId: string | null; editorBody: string | null}[];
  _count: {applications: number};
};

export function InstructorCampReview({camps, contractOwner, contractAddress}: {camps: Camp[]; contractOwner: string | null; contractAddress: `0x${string}`}) {
  const router = useRouter();
  const {session} = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const isContractOwner = Boolean(session?.address && contractOwner && session.address.toLowerCase() === contractOwner);

  async function review(campId: number, action: "publish" | "request-revision" | "archive", chainCampId?: number) {
    setBusyId(campId);
    setError(null);
    setMessage(null);
    const reviewNote = action === "request-revision" ? window.prompt("Eğitmene revizyon notu") ?? "" : undefined;
    if (action === "request-revision" && !reviewNote) {
      setBusyId(null);
      return;
    }
    try {
      const response = await fetch("/api/admin/instructor-camps", {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({campId, action, chainCampId, reviewNote}),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) setError(json.error ?? "İşlem tamamlanamadı.");
      else {
        setMessage(action === "publish" ? "Kamp zincir kimliğiyle eşleştirildi ve yayınlandı." : "Kamp durumu güncellendi.");
        router.refresh();
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Eğitmen kamp incelemeleri</h2>
        <p className="mt-1 text-sm text-fg-secondary">İçeriği gözden geçir, kampı kendi cüzdanınla kontratta oluştur ve zincir kaydını tek tıkla bağla.</p>
      </div>
      {!isContractOwner && (
        <p className="rounded-md border border-warning bg-subtle p-3 text-sm text-warning">Bağlı cüzdan kontrat sahibi değil. İçeriği inceleyebilirsin; zincirde kamp oluşturmak için owner cüzdanına geç.</p>
      )}
      {message && <p className="rounded-md border border-line-accent bg-subtle p-3 text-sm text-accent-text">{message}</p>}
      {error && <p role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>}

      {camps.length === 0 ? (
        <EmptyState title="Henüz eğitmen kampı yok" description="Eğitmenler stüdyodan kamp oluşturduğunda inceleme akışı burada görünecek." />
      ) : camps.map((camp) => (
        <ReviewCard key={camp.id} camp={camp} contractAddress={contractAddress} isContractOwner={isContractOwner} busy={busyId === camp.id} onReview={review} />
      ))}
    </div>
  );
}

function ReviewCard({camp, contractAddress, isContractOwner, busy, onReview}: {camp: Camp; contractAddress: `0x${string}`; isContractOwner: boolean; busy: boolean; onReview: (campId: number, action: "publish" | "request-revision" | "archive", chainCampId?: number) => Promise<void>}) {
  const readyWeeks = camp.weeks.filter((week) => week.status === "PUBLISHED" && week.editorBody).length;
  const artWeeks = camp.weeks.filter((week) => week.imageAssetId).length;
  const tx = useTransaction(() => setTimeout(() => onReview(camp.id, "publish"), 1200));

  function createOnChain() {
    tx.send({
      address: contractAddress,
      abi: pruCampBadgesAbi,
      functionName: "createCamp",
      args: [camp.name, camp.weekCount],
    });
  }

  return (
    <Card accent={camp.lifecycle === "REVIEW"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          {camp.coverAssetId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${camp.coverAssetId}`} alt="" className="hidden h-24 w-36 rounded-md object-cover sm:block" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{camp.name}</h3>
              <Pill tone={camp.lifecycle === "PUBLISHED" ? "reward" : camp.lifecycle === "REVIEW" ? "accent" : "muted"}>{camp.lifecycle.toLocaleLowerCase("tr-TR")}</Pill>
            </div>
            <p className="mt-1 text-sm text-fg-secondary">{camp.instructorName} · {camp.weekCount} hafta · {camp._count.applications} başvuru</p>
            <p className="mt-1 font-mono text-xs text-fg-muted">{camp.ownerAddress}</p>
            <p className="mt-3 text-sm text-fg-secondary">{camp.description}</p>
            <p className="mt-2 text-xs text-fg-muted">İçerik {readyWeeks}/{camp.weekCount} · NFT art {artWeeks}/{camp.weekCount} · zincir id {camp.chainCampId ?? "bekliyor"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/egitmen/kamplar/${camp.id}`} size="sm" variant="secondary">İçeriği aç</ButtonLink>
          <ButtonLink href={`/egitmen/kamplar/${camp.id}/ogrenciler`} size="sm" variant="secondary">Öğrenciler</ButtonLink>
          {camp.lifecycle === "PUBLISHED" && <Link href={`/kamplar/${camp.slug}`} className="self-center text-xs underline underline-offset-4">Canlı sayfa ↗</Link>}
        </div>
      </div>

      {camp.lifecycle === "REVIEW" && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" size="sm" loading={tx.isBusy} disabled={!isContractOwner || busy} onClick={createOnChain}>Zincirde oluştur ve yayınla</Button>
            <Button variant="secondary" size="sm" disabled={busy || tx.isBusy} onClick={() => onReview(camp.id, "publish")}>Mevcut zincir kaydını bul</Button>
            <Button variant="danger" size="sm" disabled={busy || tx.isBusy} onClick={() => onReview(camp.id, "request-revision")}>Revizyon iste</Button>
          </div>
          <TxStatus state={tx.state} hash={tx.hash} error={tx.error} successMessage="Kamp zincirde oluşturuldu; kayıt siteye bağlanıyor…" onRetry={tx.reset} />
        </div>
      )}
    </Card>
  );
}

