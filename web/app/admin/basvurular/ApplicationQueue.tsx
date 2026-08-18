"use client";

/**
 * ============================================================================
 * Başvuru onay kuyruğu
 *
 * Faz 0 şartı, birebir:
 *   "Bu konuda otomasyon, otomatik doğrulama veya kolaylaştırıcı mekanizma
 *    istemiyorum — bana sadece basit bir liste yeter: adres, nick, beyan
 *    edilen hafta, onayla/reddet."
 *
 * Bu yüzden burada toplu onay, otomatik eşleştirme, skorlama veya öneri YOK.
 * Her satır tek tek okunur ve tek tek karar verilir.
 *
 * TEK EKLENTİ: adminin beyan edilen haftayı DÜZELTEBİLMESİ. Katılımcı
 * "5. haftadayım" der ama sen 3 olduğunu biliyorsan, reddedip yeniden
 * başvurmasını beklemek yerine doğru değeri girip onaylarsın.
 * ============================================================================
 */
import {useState} from "react";
import {useRouter} from "next/navigation";

import {AddressChip} from "@/components/ui/Address";
import {Button} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";
import {referralLabel} from "@/lib/participant";
import {t} from "@/lib/i18n";

type Application = {
  id: string;
  address: string;
  declaredWeek: number;
  nickname: string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  camp: {id: number; slug: string; name: string; weekCount: number};
  /** Katılımcının onboarding'de verdiği zincir dışı bilgiler */
  profile: {
    university: string | null;
    referralSource: string | null;
    referralDetail: string | null;
  } | null;
};

export function ApplicationQueue({
  applications,
  counts,
}: {
  applications: Application[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">(
    "PENDING",
  );

  const visible = applications.filter((a) => a.status === filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtre */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["PENDING", t.admin.pending],
            ["APPROVED", t.admin.approved],
            ["REJECTED", t.admin.rejected],
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
              {counts[value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={
            filter === "PENDING"
              ? "Bekleyen başvuru yok"
              : filter === "APPROVED"
                ? "Henüz onaylanmış başvuru yok"
                : "Reddedilmiş başvuru yok"
          }
          description={
            filter === "PENDING"
              ? "Yeni başvurular geldiğinde burada görünecek."
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((application) => (
            <ApplicationRow
              key={application.id}
              application={application}
              onDone={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ApplicationRow({
  application,
  onDone,
}: {
  application: Application;
  onDone: () => void;
}) {
  const [week, setWeek] = useState(application.declaredWeek);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isPending = application.status === "PENDING";
  const corrected = week !== application.declaredWeek;

  async function review(action: "approve" | "reject") {
    setBusy(action);
    setError(null);

    try {
      const response = await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          applicationId: application.id,
          action,
          approvedWeek: action === "approve" ? week : undefined,
          reviewNote: note || undefined,
        }),
      });
      const json = await response.json();

      if (json.ok) {
        setResult(
          action === "approve"
            ? `Onaylandı — 1..${week}. haftalar için ${json.data.completionsCreated} kayıt açıldı.`
            : "Reddedildi.",
        );
        setTimeout(onDone, 1200);
      } else {
        setError(json.error ?? t.errors.unknown);
      }
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* ---- Kimlik ---- */}
        <div className="min-w-0">
          <AddressChip
            address={application.address}
            nickname={application.nickname ?? undefined}
          />
          <p className="mt-1 text-xs text-fg-muted">
            {application.camp.name} ·{" "}
            {new Date(application.createdAt).toLocaleDateString("tr-TR", {
              dateStyle: "medium",
            })}
          </p>
        </div>

        <Pill
          tone={
            application.status === "APPROVED"
              ? "accent"
              : application.status === "REJECTED"
                ? "danger"
                : "muted"
          }
        >
          {application.status === "APPROVED"
            ? t.admin.approved
            : application.status === "REJECTED"
              ? t.admin.rejected
              : t.admin.pending}
        </Pill>
      </div>

      {/* ---- Katılımcı bilgisi (onboarding'de verilen) ---- */}
      <div className="mt-3 grid gap-2 rounded-md border border-line bg-subtle p-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-fg-muted">{t.admin.university}</p>
          <p className="text-sm font-medium">
            {application.profile?.university ?? (
              <span className="text-fg-muted">{t.admin.noProfile}</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-fg-muted">{t.admin.referral}</p>
          <p className="text-sm font-medium">
            {application.profile?.referralSource ? (
              <>
                {referralLabel(application.profile.referralSource)}
                {application.profile.referralDetail && (
                  <span className="text-fg-secondary">
                    {" "}
                    — {application.profile.referralDetail}
                  </span>
                )}
              </>
            ) : (
              <span className="text-fg-muted">{t.admin.noProfile}</span>
            )}
          </p>
        </div>
      </div>

      {/* ---- Beyan ---- */}
      <div className="mt-3 rounded-md border border-line bg-subtle p-3">
        <p className="text-sm">
          <span className="text-fg-muted">{t.admin.declaredWeek}:</span>{" "}
          <strong className="text-lg">{application.declaredWeek}</strong>
          <span className="text-fg-muted"> / {application.camp.weekCount}</span>
        </p>
        {application.note && (
          <p className="mt-2 text-sm text-fg-secondary">
            &ldquo;{application.note}&rdquo;
          </p>
        )}
      </div>

      {application.reviewNote && (
        <p className="mt-2 text-sm text-fg-muted">
          İnceleme notu: {application.reviewNote}
        </p>
      )}

      {/* ---- Karar ---- */}
      {isPending && !result && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <div>
            <span className="mb-1.5 block text-sm font-semibold">
              {t.admin.approvedWeek}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({length: application.camp.weekCount}, (_, i) => i + 1).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setWeek(n)}
                    aria-pressed={week === n}
                    className={[
                      "h-8 w-8 rounded-md border text-xs font-semibold transition-colors",
                      week === n
                        ? "border-line-accent bg-accent text-accent-fg"
                        : n === application.declaredWeek
                          ? "border-line-accent text-accent-text"
                          : "border-line text-fg-secondary hover:border-line-strong",
                    ].join(" ")}
                  >
                    {n}
                  </button>
                ),
              )}
            </div>
            {corrected && (
              <p className="mt-2 text-xs text-warning">
                Beyan {application.declaredWeek} idi, {week} olarak
                onaylayacaksın.
              </p>
            )}
          </div>

          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={`${t.admin.reviewNote} (isteğe bağlı)`}
            maxLength={500}
            className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-line-accent"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              size="sm"
              loading={busy === "approve"}
              disabled={busy !== null}
              onClick={() => review("approve")}
            >
              {t.admin.approve} (1–{week}. hafta)
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === "reject"}
              disabled={busy !== null}
              onClick={() => review("reject")}
            >
              {t.admin.reject}
            </Button>
          </div>

          {/*
            Onayın zincire uzanan etkisi burada hatırlatılıyor.
            Onay tek başına rozet üretmez — sonrasında merkle ağacı üretilip
            kökü zincire yazılmalı.
          */}
          <p className="text-xs text-fg-muted">
            Onay, 1..{week}. haftalar için hak ediş kaydı açar. Rozetlerin
            alınabilmesi için ardından <strong>Merkle</strong> sekmesinden ağaç
            üretip kökü zincire yazman gerekiyor.
          </p>
        </div>
      )}

      {result && (
        <p className="mt-3 rounded-md border border-success bg-subtle p-3 text-sm text-success">
          ✓ {result}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
