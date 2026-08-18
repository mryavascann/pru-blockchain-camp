"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useMemo, useState} from "react";

import {Button} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";

type Student = {
  id: string;
  address: string;
  nickname: string | null;
  declaredWeek: number;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  university: string | null;
  referralSource: string | null;
  completedWeeks: number[];
  noteCount: number;
};

type Camp = {
  id: number;
  name: string;
  slug: string;
  weekCount: number;
  lifecycle: string;
  chainCampId: number | null;
};

export function StudentPortal({camp, students}: {camp: Camp; students: Student[]}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"ALL" | Student["status"]>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [weekNumber, setWeekNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      ALL: students.length,
      PENDING: students.filter((student) => student.status === "PENDING").length,
      APPROVED: students.filter((student) => student.status === "APPROVED").length,
      REJECTED: students.filter((student) => student.status === "REJECTED").length,
    }),
    [students],
  );
  const visible = filter === "ALL" ? students : students.filter((student) => student.status === filter);

  async function review(student: Student, action: "approve" | "reject") {
    const approvedWeek = action === "approve"
      ? Number(window.prompt("Kaçıncı haftaya kadar onaylansın?", String(student.declaredWeek)))
      : undefined;
    if (action === "approve" && (!Number.isInteger(approvedWeek) || approvedWeek! < 1 || approvedWeek! > camp.weekCount)) return;
    const reviewNote = window.prompt(action === "approve" ? "İnceleme notu (isteğe bağlı)" : "Red nedeni (isteğe bağlı)") ?? undefined;
    await mutate(`/api/instructor/camps/${camp.id}/applications`, "PATCH", {
      applicationId: student.id,
      action,
      approvedWeek,
      reviewNote,
    });
  }

  async function markCompleted() {
    if (selected.size === 0) return;
    await mutate(`/api/instructor/camps/${camp.id}/completions`, "POST", {
      weekNumber,
      addresses: [...selected],
    });
    setSelected(new Set());
  }

  async function mutate(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) setError(json.error ?? "İşlem tamamlanamadı.");
      else {
        setMessage("İşlem kaydedildi.");
        router.refresh();
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(address: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/egitmen/kamplar/${camp.id}`} className="text-sm text-fg-secondary underline underline-offset-4">← Kamp stüdyosu</Link>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{camp.name} · Öğrenciler</h2>
        <p className="mt-1 text-sm text-fg-secondary">Başvuruları incele, haftalık ilerlemeyi toplu işaretle ve not katkılarını gör.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
          <button key={status} type="button" onClick={() => setFilter(status)} className={`rounded-lg border p-4 text-left ${filter === status ? "border-line-accent bg-subtle" : "border-line bg-surface"}`}>
            <span className="block text-2xl font-extrabold">{counts[status]}</span>
            <span className="text-xs text-fg-secondary">{status === "ALL" ? "Toplam" : status === "PENDING" ? "Bekleyen" : status === "APPROVED" ? "Onaylı" : "Reddedilen"}</span>
          </button>
        ))}
      </div>

      {counts.APPROVED > 0 && (
        <Card accent className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Tamamlanan hafta</span>
            <select className="input min-w-36" value={weekNumber} onChange={(event) => setWeekNumber(Number(event.target.value))}>
              {Array.from({length: camp.weekCount}, (_, index) => index + 1).map((week) => <option key={week} value={week}>{week}. hafta</option>)}
            </select>
          </label>
          <Button variant="accent" loading={busy} disabled={selected.size === 0} onClick={markCompleted}>{selected.size} öğrenciyi işaretle</Button>
          <p className="text-xs text-fg-muted">Yalnızca onaylı öğrenciler seçilebilir. Aynı kayıt ikinci kez oluşturulmaz.</p>
        </Card>
      )}

      {message && <p className="rounded-md border border-line-accent bg-subtle p-3 text-sm text-accent-text">{message}</p>}
      {error && <p role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>}

      {visible.length === 0 ? (
        <EmptyState title="Bu filtrede öğrenci yok" description="Yeni başvurular geldiğinde burada kampına özel olarak görünecek." />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((student) => {
            const latest = student.completedWeeks.at(-1) ?? 0;
            return (
              <Card key={student.id} className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {student.status === "APPROVED" && (
                      <input type="checkbox" checked={selected.has(student.address)} onChange={() => toggle(student.address)} aria-label={`${student.nickname || student.address} seç`} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{student.nickname || `${student.address.slice(0, 6)}…${student.address.slice(-4)}`}</h3>
                        <Pill tone={student.status === "APPROVED" ? "reward" : student.status === "PENDING" ? "accent" : "danger"}>{student.status === "APPROVED" ? "onaylı" : student.status === "PENDING" ? "bekliyor" : "reddedildi"}</Pill>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-fg-muted">{student.address}</p>
                      <p className="mt-2 text-sm text-fg-secondary">Beyan: {student.declaredWeek}. hafta · İlerleme: {latest}/{camp.weekCount} · {student.noteCount} ortak not</p>
                      {(student.university || student.referralSource) && <p className="mt-1 text-xs text-fg-muted">{student.university || "Üniversite belirtilmedi"}{student.referralSource ? ` · Kaynak: ${student.referralSource}` : ""}</p>}
                      {student.note && <p className="mt-2 rounded-md bg-subtle p-2 text-xs text-fg-secondary">“{student.note}”</p>}
                    </div>
                  </div>
                  {student.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="accent" loading={busy} onClick={() => review(student, "approve")}>Onayla</Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => review(student, "reject")}>Reddet</Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

