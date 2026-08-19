"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useMemo, useState, type ChangeEvent, type FormEvent} from "react";

import {Button, ButtonLink} from "@/components/ui/Button";
import {Card, Pill} from "@/components/ui/Card";

type Resource = {title: string; url: string};
type Week = {
  weekNumber: number;
  title: string;
  stage: string | null;
  teaser: string;
  editorBody: string | null;
  resources: Resource[];
  status: "DRAFT" | "PUBLISHED";
  publishDate: string | null;
  imageAssetId: string | null;
};
type Camp = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  instructorName: string | null;
  weekCount: number;
  firstWeekRequiresApproval: boolean;
  publicWeekNumber: number | null;
  lifecycle: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  chainCampId: number | null;
  startDate: string | null;
  coverAssetId: string | null;
  reviewNote: string | null;
  weeks: Week[];
  _count: {applications: number};
};

const STATUS_LABEL = {
  DRAFT: "Taslak",
  REVIEW: "Platform incelemesinde",
  PUBLISHED: "Yayında",
  ARCHIVED: "Arşivlendi",
};

export function CampStudio({camp}: {camp: Camp}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  const completion = useMemo(() => {
    const ready = camp.weeks.filter(
      (week) =>
        week.status === "PUBLISHED" &&
        Boolean(week.editorBody?.trim()) &&
        Boolean(week.teaser.trim()),
    ).length;
    const art = camp.weeks.filter((week) => week.imageAssetId).length;
    return {ready, art};
  }, [camp.weeks]);

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await patchCamp({
      name: form.get("name"),
      slug: form.get("slug"),
      instructorName: form.get("instructorName"),
      description: form.get("description"),
      startDate: form.get("startDate") || null,
      weekCount: Number(form.get("weekCount")),
      firstWeekRequiresApproval:
        form.get("firstWeekRequiresApproval") === "on",
      publicWeekNumber:
        form.get("publicWeekNumber") === ""
          ? null
          : Number(form.get("publicWeekNumber")),
    });
  }

  async function patchCamp(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/instructor/camps/${camp.id}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setError(json.error ?? "Değişiklik kaydedilemedi.");
        return;
      }
      const missingArt: number[] = json.data.missingArt ?? [];
      setMessage(
        missingArt.length
          ? `İncelemeye gönderildi. ${missingArt.join(", ")}. hafta için görsel henüz yok; yayın öncesi tamamlayabilirsin.`
          : "Değişiklik kaydedildi.",
      );
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "CAMP_COVER");
    try {
      const response = await fetch(`/api/instructor/camps/${camp.id}/media`, {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!response.ok || !json.ok) setError(json.error ?? "Kapak yüklenemedi.");
      else {
        setMessage("Kamp kapağı yüklendi.");
        router.refresh();
      }
    } catch {
      setError("Kapak yüklenemedi.");
    } finally {
      setCoverBusy(false);
      event.target.value = "";
    }
  }

  const lockedForReview = camp.lifecycle === "REVIEW";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/egitmen" className="text-sm text-fg-secondary underline underline-offset-4">← Kamplarım</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight">{camp.name}</h2>
            <Pill tone={camp.lifecycle === "PUBLISHED" ? "reward" : camp.lifecycle === "REVIEW" ? "accent" : "muted"}>
              {STATUS_LABEL[camp.lifecycle]}
            </Pill>
          </div>
          <p className="mt-1 text-sm text-fg-secondary">/{camp.slug} · {camp.weekCount} hafta · {camp._count.applications} başvuru</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/egitmen/kamplar/${camp.id}/ogrenciler`} variant="secondary">Öğrenci portalı</ButtonLink>
          {camp.lifecycle === "PUBLISHED" && <ButtonLink href={`/kamplar/${camp.slug}`} variant="accent">Canlı kamp ↗</ButtonLink>}
        </div>
      </div>

      {camp.reviewNote && (
        <div className="rounded-lg border border-warning bg-subtle p-4 text-sm">
          <strong className="text-warning">Platform revizyon notu:</strong>{" "}{camp.reviewNote}
        </div>
      )}
      {lockedForReview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-accent bg-subtle p-4">
          <p className="text-sm text-fg-secondary">İnceleme sırasında içerik sabit tutulur. Değişiklik gerekirse taslağa geri alabilirsin.</p>
          <Button size="sm" disabled={busy} onClick={() => patchCamp({action: "reopen-draft"})}>Taslağa geri al</Button>
        </div>
      )}
      {message && <p className="rounded-md border border-line-accent bg-subtle p-3 text-sm text-accent-text">{message}</p>}
      {error && <p role="alert" className="rounded-md border border-danger p-3 text-sm text-danger">{error}</p>}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <h3 className="text-lg font-bold">Kamp vitrini</h3>
          <p className="mt-1 text-sm text-fg-secondary">Kamp kartındaki metin ve temel program bilgileri.</p>
          <form onSubmit={saveGeneral} className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Kamp adı"><input className="input" name="name" defaultValue={camp.name} required minLength={3} maxLength={80} disabled={lockedForReview} /></Field>
            <Field label="Kısa adres"><input className="input" name="slug" defaultValue={camp.slug} required minLength={3} maxLength={60} disabled={lockedForReview} /></Field>
            <Field label="Eğitmen / ekip"><input className="input" name="instructorName" defaultValue={camp.instructorName ?? ""} required minLength={2} maxLength={80} disabled={lockedForReview} /></Field>
            <Field label="Hafta sayısı" help="Azaltılamaz."><input className="input" name="weekCount" type="number" defaultValue={camp.weekCount} min={camp.weekCount} max={52} disabled={lockedForReview} /></Field>
            <Field label="Başlangıç"><input className="input" name="startDate" type="date" defaultValue={camp.startDate ?? ""} disabled={lockedForReview} /></Field>
            <Field label="Herkese açık örnek hafta" help="Cüzdansız okunabilecek vitrin içeriği.">
              <select className="input" name="publicWeekNumber" defaultValue={camp.publicWeekNumber ?? ""} disabled={lockedForReview}>
                <option value="">Yok</option>
                {camp.weeks.map((week) => (
                  <option key={week.weekNumber} value={week.weekNumber} disabled={week.status !== "PUBLISHED"}>
                    {week.weekNumber}. hafta{week.status !== "PUBLISHED" ? " (önce hazırla)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-start gap-3 rounded-lg border border-line bg-subtle p-3 md:col-span-2">
              <input
                name="firstWeekRequiresApproval"
                type="checkbox"
                defaultChecked={camp.firstWeekRequiresApproval}
                disabled={lockedForReview}
                className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">
                  1. hafta için eğitmen onayı iste
                </span>
                <span className="mt-1 block text-xs text-fg-muted">
                  Kapalıysa herkes 1. haftaya hemen başlar. İleri hafta istekleri
                  her zaman öğrenci portalındaki onay kuyruğuna düşer.
                </span>
              </span>
            </label>
            <div className="md:col-span-2"><Field label="Açıklama"><textarea className="input resize-y" name="description" defaultValue={camp.description ?? ""} required minLength={20} maxLength={1200} rows={4} disabled={lockedForReview} /></Field></div>
            <div className="md:col-span-2"><Button type="submit" variant="accent" loading={busy} disabled={lockedForReview}>Kamp bilgilerini kaydet</Button></div>
          </form>
        </Card>

        <Card>
          <h3 className="font-bold">Kapak görseli</h3>
          <div className="mt-3 overflow-hidden rounded-lg border border-line bg-subtle">
            {camp.coverAssetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/${camp.coverAssetId}`} alt={`${camp.name} kapağı`} className="aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="grid aspect-[16/9] place-items-center text-sm text-fg-muted">Henüz kapak yok</div>
            )}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Kapak yükle</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadCover} disabled={coverBusy || lockedForReview} className="block w-full text-xs text-fg-secondary file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-fg" />
          </label>
          <p className="mt-2 text-xs text-fg-muted">PNG, JPEG, WebP veya GIF · en çok 5 MB · önerilen 1600×900.</p>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Haftalık içerikler ve NFT art</h3>
            <p className="mt-1 text-sm text-fg-secondary">Başlık, açıklama, kaynaklar ve görsel aynı karttan yönetilir.</p>
          </div>
          <div className="text-right text-sm text-fg-secondary">
            <p><strong className="text-fg">{completion.ready}/{camp.weekCount}</strong> içerik hazır</p>
            <p><strong className="text-fg">{completion.art}/{camp.weekCount}</strong> NFT görseli yüklü</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {camp.weeks.map((week) => (
            <WeekEditor key={week.weekNumber} campId={camp.id} week={week} disabled={lockedForReview} onDone={() => router.refresh()} />
          ))}
        </div>
      </section>

      {camp.lifecycle === "DRAFT" && (
        <Card accent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">Yayına hazır mı?</h3>
            <p className="mt-1 max-w-2xl text-sm text-fg-secondary">Bütün haftalar yayına hazır olduğunda platform incelemesine gönder. Platform yöneticisi kontrattaki kampı doğrulayıp zincir kimliğini bağlayacak.</p>
          </div>
          <Button variant="accent" loading={busy} disabled={completion.ready !== camp.weekCount} onClick={() => patchCamp({action: "submit-review"})}>İncelemeye gönder</Button>
        </Card>
      )}
    </div>
  );
}

function WeekEditor({campId, week, disabled, onDone}: {campId: number; week: Week; disabled: boolean; onDone: () => void}) {
  const [open, setOpen] = useState(week.status === "DRAFT");
  const [busy, setBusy] = useState(false);
  const [artBusy, setArtBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const resources = parseResourceLines(String(form.get("resources") ?? ""));
    try {
      const response = await fetch(`/api/instructor/camps/${campId}/weeks/${week.weekNumber}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          title: form.get("title"),
          stage: form.get("stage") || null,
          teaser: form.get("teaser"),
          body: form.get("body"),
          resources,
          publishDate: form.get("publishDate") || null,
          status: form.get("status"),
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) setError(json.error ?? "Hafta kaydedilemedi.");
      else {
        setSaved(true);
        onDone();
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadArt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setArtBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "WEEK_ART");
    form.set("weekNumber", String(week.weekNumber));
    try {
      const response = await fetch(`/api/instructor/camps/${campId}/media`, {method: "POST", body: form});
      const json = await response.json();
      if (!response.ok || !json.ok) setError(json.error ?? "Görsel yüklenemedi.");
      else onDone();
    } catch {
      setError("Görsel yüklenemedi.");
    } finally {
      setArtBusy(false);
      event.target.value = "";
    }
  }

  return (
    <Card className="!p-0">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left md:px-5" aria-expanded={open}>
        <span className="flex min-w-0 items-center gap-3">
          <span className="mono shrink-0 text-sm text-fg-muted">H{String(week.weekNumber).padStart(2, "0")}</span>
          <span className="truncate font-semibold">{week.title}</span>
        </span>
        <span className="flex items-center gap-2">
          {week.imageAssetId ? <Pill tone="reward">art ✓</Pill> : <Pill tone="muted">art yok</Pill>}
          <Pill tone={week.status === "PUBLISHED" ? "accent" : "muted"}>{week.status === "PUBLISHED" ? "hazır" : "taslak"}</Pill>
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <form onSubmit={save} className="grid gap-4 border-t border-line p-4 md:grid-cols-[minmax(0,1fr)_240px] md:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Hafta başlığı"><input className="input" name="title" defaultValue={week.title} required minLength={3} maxLength={120} disabled={disabled} /></Field>
            <Field label="Aşama / modül" help="İsteğe bağlı gruplama."><input className="input" name="stage" defaultValue={week.stage ?? ""} maxLength={100} disabled={disabled} /></Field>
            <div className="md:col-span-2"><Field label="Kart özeti" help="Kilitli müfredat kartında görünür; en az 10 karakter."><textarea className="input resize-y" name="teaser" defaultValue={week.teaser} minLength={10} maxLength={500} rows={3} required disabled={disabled} /></Field></div>
            <div className="md:col-span-2"><Field label="Ders içeriği" help={'Düz metin güvenli biçimde yayınlanır. Başlık için “##”, liste için “-” kullanabilirsin.'}><textarea className="input min-h-56 resize-y" name="body" defaultValue={week.editorBody ?? ""} minLength={20} maxLength={30000} required disabled={disabled} /></Field></div>
            <div className="md:col-span-2"><Field label="Kaynaklar" help="Her satır: Kaynak başlığı | https://adres"><textarea className="input resize-y font-mono text-xs" name="resources" defaultValue={week.resources.map((item) => `${item.title} | ${item.url}`).join("\n")} rows={4} disabled={disabled} /></Field></div>
            <Field label="Planlanan tarih"><input className="input" name="publishDate" type="date" defaultValue={week.publishDate ?? ""} disabled={disabled} /></Field>
            <Field label="Durum"><select className="input" name="status" defaultValue={week.status} disabled={disabled}><option value="DRAFT">Taslak</option><option value="PUBLISHED">Yayına hazır</option></select></Field>
            {error && <p role="alert" className="text-sm text-danger md:col-span-2">{error}</p>}
            <div className="flex items-center gap-3 md:col-span-2"><Button type="submit" variant="accent" size="sm" loading={busy} disabled={disabled}>Haftayı kaydet</Button>{saved && <span className="text-sm text-accent-text">Kaydedildi ✓</span>}</div>
          </div>
          <aside>
            <p className="text-sm font-semibold">Haftalık NFT art</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-line bg-subtle">
              {week.imageAssetId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${week.imageAssetId}`} alt={`${week.title} NFT görseli`} className="aspect-square w-full object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center px-6 text-center text-xs text-fg-muted">Bu haftaya özel görsel yükle</div>
              )}
            </div>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadArt} disabled={disabled || artBusy} className="mt-3 block w-full text-xs text-fg-secondary file:mb-2 file:mr-2 file:rounded-md file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:font-semibold file:text-fg" />
            <p className="mt-1 text-xs text-fg-muted">Kare, 1600×1600 önerilir · en çok 5 MB.</p>
          </aside>
        </form>
      )}
    </Card>
  );
}

function parseResourceLines(value: string): Resource[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("|");
    if (separator === -1) return {title: line, url: ""};
    return {title: line.slice(0, separator).trim(), url: line.slice(separator + 1).trim()};
  });
}

function Field({label, help, children}: {label: string; help?: string; children: React.ReactNode}) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold">{label}</span>{children}{help && <span className="mt-1 block text-xs text-fg-muted">{help}</span>}</label>;
}
