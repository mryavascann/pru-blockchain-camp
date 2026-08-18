"use client";

/**
 * ============================================================================
 * Merkle ağacı yönetimi
 *
 * AKIŞ:
 *   1. Başvuru onayı        → WeeklyCompletion kayıtları (Başvurular sekmesi)
 *   2. Ağaç üretimi         → burada, sunucuda (zincire yazmaz)
 *   3. Kökü zincire yazma   → burada, ama SENİN CÜZDANINLA
 *
 * ---------------------------------------------------------------------------
 * 3. ADIM NEDEN SUNUCUDA OTOMATİK DEĞİL
 *
 * Backend'in private key'i YOK ve olmayacak. Sunucu ele geçirilirse
 * saldırgan kendine sınırsız rozet yazdırabilirdi. İmza yetkisini insanda
 * tutmak bu riski tamamen ortadan kaldırıyor.
 *
 * Bağlı cüzdan kontratın sahibiyse doğrudan buradan yazabilirsin. Değilse
 * (örneğin sahip donanım cüzdanındaysa) hazır `cast` komutu veriliyor.
 * ---------------------------------------------------------------------------
 */
import {useState} from "react";
import {useRouter} from "next/navigation";
import {useAccount} from "wagmi";

import {Button} from "@/components/ui/Button";
import {Card, Pill} from "@/components/ui/Card";
import {TxStatus} from "@/components/wallet/TxStatus";
import {pruCampBadgesAbi} from "@/lib/chain/abi";
import {contractAddress} from "@/lib/chain/config";
import {useTransaction} from "@/lib/hooks/useTransaction";
import {t} from "@/lib/i18n";

type WeekStatus = {
  weekNumber: number;
  eligibleCount: number;
  treeRoot: string | null;
  treeEntryCount: number;
  onChainRoot: string | null;
  published: boolean;
  needsPublishing: boolean;
};

type Camp = {id: number; slug: string; name: string; weekCount: number};

export function MerkleManager({
  camps,
  contractOwner,
}: {
  camps: Camp[];
  /** Kontratın zincirdeki sahibi — bağlı cüzdanla karşılaştırılır */
  contractOwner: string | null;
}) {
  const router = useRouter();
  const {address} = useAccount();
  const [activeSlug, setActiveSlug] = useState(camps[0]?.slug ?? "");
  const [weeks, setWeeks] = useState<WeekStatus[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const camp = camps.find((c) => c.slug === activeSlug);

  const isOwner =
    Boolean(address) &&
    Boolean(contractOwner) &&
    address!.toLowerCase() === contractOwner!.toLowerCase();

  async function load(slug: string) {
    setLoading(true);
    setWeeks(null);
    try {
      const response = await fetch(`/api/admin/merkle?camp=${slug}`);
      const json = await response.json();
      if (json.ok) setWeeks(json.data.weeks);
      else setMessage(json.error);
    } catch {
      setMessage(t.errors.network);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!camp) return;
    setGenerating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/merkle", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({campSlug: camp.slug}),
      });
      const json = await response.json();
      if (json.ok) {
        setMessage(
          `${json.data.trees.length} hafta için ağaç üretildi. ` +
            `${json.data.needsPublishing} tanesinin kökü zincire yazılmalı.`,
        );
        await load(camp.slug);
        router.refresh();
      } else {
        setMessage(json.error ?? t.errors.unknown);
      }
    } catch {
      setMessage(t.errors.network);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Kamp seçimi ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {camps.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                setActiveSlug(c.slug);
                setWeeks(null);
                setMessage(null);
              }}
              aria-pressed={c.slug === activeSlug}
              className={[
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                c.slug === activeSlug
                  ? "border-line-accent bg-subtle text-accent-text"
                  : "border-line text-fg-secondary hover:text-fg",
              ].join(" ")}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => camp && load(camp.slug)}
          >
            Durumu Yükle
          </Button>
          <Button
            variant="accent"
            size="sm"
            loading={generating}
            onClick={generate}
          >
            {t.admin.generateTrees}
          </Button>
        </div>
      </div>

      {message && (
        <p className="rounded-md border border-line-accent bg-subtle p-3 text-sm">
          {message}
        </p>
      )}

      {/* ---- Sahiplik durumu ---- */}
      <Card className="!p-4">
        <p className="text-sm">
          <strong>Zincire yazma yetkisi:</strong>{" "}
          {contractOwner === null ? (
            <span className="text-fg-muted">okunamadı (RPC)</span>
          ) : isOwner ? (
            <span className="text-success">
              ✓ bağlı cüzdan kontratın sahibi — buradan yazabilirsin
            </span>
          ) : (
            <span className="text-warning">
              bağlı cüzdan sahip değil — aşağıdaki komutu kullan
            </span>
          )}
        </p>
        {contractOwner && !isOwner && (
          <p className="mono mt-1 text-xs text-fg-muted">
            sahip: {contractOwner}
          </p>
        )}
        <p className="mt-2 text-xs text-fg-muted">{t.admin.warning}</p>
      </Card>

      {/* ---- Hafta tablosu ---- */}
      {weeks === null ? (
        <p className="text-sm text-fg-secondary">
          Durumu görmek için &ldquo;Durumu Yükle&rdquo;ye bas. Her hafta için
          zincirdeki kök ayrı ayrı okunur, bu birkaç saniye sürebilir.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {weeks
            .filter((w) => w.eligibleCount > 0 || w.treeRoot)
            .map((week) => (
              <WeekRow
                key={week.weekNumber}
                campId={camp!.id}
                week={week}
                isOwner={isOwner}
                onPublished={() => camp && load(camp.slug)}
              />
            ))}

          {weeks.every((w) => w.eligibleCount === 0 && !w.treeRoot) && (
            <p className="rounded-md border border-dashed border-line p-4 text-center text-sm text-fg-secondary">
              Bu kampta henüz hak ediş kaydı yok. Önce{" "}
              <strong>Başvurular</strong> sekmesinden onay ver.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function WeekRow({
  campId,
  week,
  isOwner,
  onPublished,
}: {
  campId: number;
  week: WeekStatus;
  isOwner: boolean;
  onPublished: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const tx = useTransaction(() => setTimeout(onPublished, 1500));

  const command =
    `cast send ${contractAddress} \\\n` +
    `  "setMerkleRoot(uint256,uint256,bytes32)" \\\n` +
    `  ${campId} ${week.weekNumber} ${week.treeRoot} \\\n` +
    `  --rpc-url https://sepolia.base.org --account pru-testnet`;

  function publish() {
    if (!week.treeRoot) return;
    tx.send({
      address: contractAddress,
      abi: pruCampBadgesAbi,
      functionName: "setMerkleRoot",
      args: [BigInt(campId), BigInt(week.weekNumber), week.treeRoot as `0x${string}`],
    });
  }

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="mono text-sm text-fg-muted">
            H{String(week.weekNumber).padStart(2, "0")}
          </span>
          <span className="text-sm">
            <strong className="tabular-nums">{week.eligibleCount}</strong> kişi
            hak ediyor
          </span>
        </div>

        {week.published ? (
          <Pill tone="accent">✓ zincirde</Pill>
        ) : week.needsPublishing ? (
          <Pill tone="danger">yazılmalı</Pill>
        ) : (
          <Pill tone="muted">ağaç yok</Pill>
        )}
      </div>

      {week.treeRoot && (
        <p className="mono mt-2 truncate text-xs text-fg-muted">
          kök: {week.treeRoot}
        </p>
      )}

      {week.needsPublishing && (
        <div className="mt-3 border-t border-line pt-3">
          {isOwner ? (
            <>
              <Button
                variant="accent"
                size="sm"
                loading={tx.isBusy}
                onClick={publish}
              >
                Zincire Yaz
              </Button>
              <TxStatus
                state={tx.state}
                hash={tx.hash}
                error={tx.error}
                successMessage={`${week.weekNumber}. haftanın kökü zincire yazıldı.`}
                onRetry={tx.reset}
              />
            </>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold text-fg-secondary">
                {t.admin.publishCommand}
              </p>
              <pre className="overflow-x-auto rounded-md border border-line bg-subtle p-3 text-xs">
                <code>{command}</code>
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(command);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="mt-2 text-xs font-semibold text-accent-text underline underline-offset-2"
              >
                {copied ? t.wallet.copied : t.common.copy}
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
