"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState, type FormEvent} from "react";

import {Button, ButtonLink} from "@/components/ui/Button";
import {Card, EmptyState, Pill} from "@/components/ui/Card";

type Camp = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  instructorName: string | null;
  weekCount: number;
  lifecycle: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  chainCampId: number | null;
  coverAssetId: string | null;
  reviewNote: string | null;
  updatedAt: string;
  _count: {applications: number};
};

const STATUS = {
  DRAFT: {label: "Taslak", tone: "muted" as const},
  REVIEW: {label: "İncelemede", tone: "accent" as const},
  PUBLISHED: {label: "Yayında", tone: "reward" as const},
  ARCHIVED: {label: "Arşiv", tone: "neutral" as const},
};

export function InstructorDashboard({camps}: {camps: Camp[]}) {
  const router = useRouter();
  const [creating, setCreating] = useState(camps.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCamp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/instructor/camps", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          name: form.get("name"),
          slug: form.get("slug") || undefined,
          description: form.get("description"),
          instructorName: form.get("instructorName"),
          weekCount: Number(form.get("weekCount")),
          firstWeekRequiresApproval:
            form.get("firstWeekRequiresApproval") === "on",
          startDate: form.get("startDate") || null,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setError(json.error ?? "Kamp oluşturulamadı.");
        return;
      }
      router.push(`/egitmen/kamplar/${json.data.camp.id}`);
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı. Tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Kamplarım</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Her kampın ekibi, içeriği ve öğrenci listesi birbirinden tamamen ayrıdır.
          </p>
        </div>
        <Button variant="accent" onClick={() => setCreating((value) => !value)}>
          {creating ? "Formu kapat" : "+ Yeni kamp"}
        </Button>
      </div>

      {creating && (
        <Card accent>
          <div className="mb-5">
            <h3 className="text-lg font-bold">Yeni kampı başlat</h3>
            <p className="mt-1 text-sm text-fg-secondary">
              Önce iskeleti kuruyoruz; haftaların içeriğini ve görsellerini sonraki ekranda tek tek dolduracaksın.
            </p>
          </div>
          <form onSubmit={createCamp} className="grid gap-4 md:grid-cols-2">
            <Field label="Kamp adı">
              <input name="name" required minLength={3} maxLength={80} placeholder="Web3 Ürün Geliştirme Kampı" className="input" />
            </Field>
            <Field label="Eğitmen / ekip adı">
              <input name="instructorName" required minLength={2} maxLength={80} placeholder="Ayşe Yılmaz" className="input" />
            </Field>
            <Field label="Kısa adres" help="Boş bırakırsan kamp adından üretilir.">
              <input name="slug" minLength={3} maxLength={60} placeholder="web3-urun" className="input" />
            </Field>
            <Field label="Hafta sayısı">
              <input name="weekCount" type="number" required min={1} max={52} defaultValue={6} className="input" />
            </Field>
            <Field label="Başlangıç tarihi" help="İsteğe bağlıdır.">
              <input name="startDate" type="date" className="input" />
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-line bg-subtle p-3 md:col-span-2">
              <input
                name="firstWeekRequiresApproval"
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">
                  1. hafta için eğitmen onayı iste
                </span>
                <span className="mt-1 block text-xs text-fg-muted">
                  Kapalıysa herkes 1. haftaya hemen başlar. İleri hafta istekleri
                  her zaman onaya düşer.
                </span>
              </span>
            </label>
            <div className="md:col-span-2">
              <Field label="Kamp açıklaması" help="Ana sayfadaki kamp kartında görünecek.">
                <textarea name="description" required minLength={20} maxLength={1200} rows={4} placeholder="Katılımcı bu kampın sonunda ne öğrenecek?" className="input resize-y" />
              </Field>
            </div>
            {error && <p role="alert" className="text-sm text-danger md:col-span-2">{error}</p>}
            <div className="md:col-span-2">
              <Button type="submit" variant="accent" loading={busy}>Kamp stüdyosunu oluştur</Button>
            </div>
          </form>
        </Card>
      )}

      {camps.length === 0 && !creating ? (
        <EmptyState title="Henüz kampın yok" description="Yeni kamp düğmesiyle birkaç dakika içinde müfredat iskeletini oluşturabilirsin." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {camps.map((camp) => (
            <Card key={camp.id} interactive className="overflow-hidden !p-0">
              {camp.coverAssetId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${camp.coverAssetId}`} alt="" className="aspect-[16/7] w-full object-cover" />
              ) : (
                <div className="grid aspect-[16/7] place-items-center bg-[radial-gradient(circle_at_30%_20%,var(--color-accent),transparent_55%),linear-gradient(135deg,var(--color-primary),var(--color-surface))] text-4xl" aria-hidden="true">✦</div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{camp.instructorName}</p>
                    <h3 className="mt-1 text-lg font-bold leading-tight">{camp.name}</h3>
                  </div>
                  <Pill tone={STATUS[camp.lifecycle].tone}>{STATUS[camp.lifecycle].label}</Pill>
                </div>
                {camp.reviewNote && <p className="mt-3 rounded-md border border-warning p-2 text-xs text-warning">Revizyon: {camp.reviewNote}</p>}
                <div className="mt-4 flex items-center justify-between text-sm text-fg-secondary">
                  <span>{camp.weekCount} hafta</span>
                  <span>{camp._count.applications} başvuru</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href={`/egitmen/kamplar/${camp.id}`} variant="accent" size="sm">Stüdyoyu aç</ButtonLink>
                  <ButtonLink href={`/egitmen/kamplar/${camp.id}/ogrenciler`} variant="secondary" size="sm">Öğrenciler</ButtonLink>
                  {camp.lifecycle === "PUBLISHED" && (
                    <Link href={`/kamplar/${camp.slug}`} className="self-center text-xs text-fg-secondary underline underline-offset-4">Canlı sayfa ↗</Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({label, help, children}: {label: string; help?: string; children: React.ReactNode}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-fg-muted">{help}</span>}
    </label>
  );
}
