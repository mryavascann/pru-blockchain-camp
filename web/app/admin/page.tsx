/**
 * /admin — Özet ekranı
 *
 * Tek bakışta "şu an neye bakmam gerekiyor" sorusuna cevap verir:
 * bekleyen başvurular, senkron sağlığı, zincire yazılmayı bekleyen kökler,
 * özeti eksik haftalar.
 *
 * Faz 0'da söz verilen şey burada karşılanıyor:
 * "Notion çökerse site son başarılı içeriği gösterir ama SEN bunu bilirsin."
 */
import Link from "next/link";

import {Card, Pill} from "@/components/ui/Card";
import {db} from "@/lib/db";
import {readAllCamps, readPaused} from "@/lib/chain/client";
import {isAdminViewer} from "@/lib/auth/adminPage";
import {isNotionConfigured} from "@/lib/env";
import {contractAddress, explorerAddressUrl, activeChain} from "@/lib/chain/config";
import {referralLabel} from "@/lib/participant";
import {t} from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  /* ⚠️ VERİ ÇEKMEDEN ÖNCE. Layout'taki kontrol yetmez — bkz. lib/auth/adminPage.ts */
  if (!(await isAdminViewer())) return null;

  const [
    pendingApplications,
    failedWeeks,
    missingTeasers,
    lastSync,
    camps,
    referralGroups,
    universityGroups,
    participantCount,
    noteCount,
    publishedWeeks,
    notedPairs,
  ] = await Promise.all([
    db.application.count({where: {status: "PENDING"}}),
    db.week.count({where: {syncStatus: "FAILED"}}),
    db.week.count({where: {teaser: "", status: "PUBLISHED"}}),
    db.syncRun.findFirst({orderBy: {startedAt: "desc"}}),
    db.camp.findMany({orderBy: {displayOrder: "asc"}}),
    /*
     * "Siteyi nereden duydun" dağılımı.
     *
     * Sabit seçenek listesi kullanmamızın karşılığı burada görülüyor: cevaplar
     * gruplanabiliyor. Serbest metin olsaydı "instagram" / "Instagram" / "insta"
     * ayrı satırlar olur ve bu tablo işe yaramazdı.
     */
    db.participant.groupBy({
      by: ["referralSource"],
      _count: true,
      where: {referralSource: {not: null}},
    }),
    db.participant.groupBy({
      by: ["university"],
      _count: true,
      where: {university: {not: null}},
    }),
    db.participant.count(),
    db.weekNote.count({where: {status: "VISIBLE"}}),
    /*
     * Yayındaki haftalar ve not bırakılmış (kamp, hafta) çiftleri.
     *
     * NEDEN İKİ SORGU + KODDA KARŞILAŞTIRMA:
     * `WeekNote` ile `Week` arasında Prisma ilişkisi YOK — not, (kamp, hafta)
     * çiftine bağlı, `Week` satırına değil. Bu bilinçli: bir hafta Notion'dan
     * yeniden oluşturulsa bile notlar yerinde kalır. Bedeli, "notu olmayan
     * hafta" sayısının burada elle hesaplanması. İki sorgu da küçük
     * (hafta sayısı onlarca).
     */
    db.week.findMany({
      where: {status: "PUBLISHED"},
      select: {campId: true, weekNumber: true},
    }),
    db.weekNote.groupBy({
      by: ["campId", "weekNumber"],
      where: {status: "VISIBLE"},
    }),
  ]);

  const weeksWithNotes = new Set(
    notedPairs.map((row) => `${row.campId}:${row.weekNumber}`),
  );
  const weeksWithoutNotes = publishedWeeks.filter(
    (week) => !weeksWithNotes.has(`${week.campId}:${week.weekNumber}`),
  ).length;

  /* Zincir durumu — RPC düşerse panel yine açılsın */
  const onChain = await readAllCamps().catch(() => null);
  const paused = await readPaused().catch(() => null);

  /* Veritabanı ile zincir ayrışmış mı? */
  const drift: string[] = [];
  if (onChain) {
    for (const camp of camps) {
      const chainCamp = onChain.find((c) => c.campId === camp.id);
      if (!chainCamp) {
        drift.push(`"${camp.name}" veritabanında var ama zincirde yok.`);
        continue;
      }
      if (chainCamp.weekCount !== camp.weekCount) {
        drift.push(
          `"${camp.name}" hafta sayısı ayrışmış: zincir ${chainCamp.weekCount}, ` +
            `veritabanı ${camp.weekCount}. \`npm run db:seed\` çalıştır.`,
        );
      }
      if (chainCamp.name !== camp.name) {
        drift.push(
          `"${camp.name}" adı zincirde farklı: "${chainCamp.name}". ` +
            `\`npm run db:seed\` çalıştır.`,
        );
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Uyarılar ---------------- */}
      {paused === true && (
        <Alert tone="danger">
          <strong>Kontrat duraklatılmış.</strong> Kullanıcılar rozet alamıyor.
          Duraklatmayı kaldırmak için kendi cüzdanınla <code>unpause()</code>{" "}
          çağırman gerekiyor.
        </Alert>
      )}

      {failedWeeks > 0 && (
        <Alert tone="danger">
          <strong>{failedWeeks} haftanın son senkronu başarısız.</strong>{" "}
          {t.admin.syncFailedHelp}{" "}
          <Link href="/admin/icerik" className="underline underline-offset-2">
            Detayları gör →
          </Link>
        </Alert>
      )}

      {!isNotionConfigured() && (
        <Alert tone="warning">
          <strong>Notion yapılandırılmamış.</strong> İçerik senkronu devre dışı;
          site son başarılı içerikle çalışıyor. <code>NOTION_TOKEN</code>{" "}
          tanımlanmalı.
        </Alert>
      )}

      {drift.map((message, index) => (
        <Alert key={index} tone="warning">
          <strong>Zincir ile veritabanı ayrışmış.</strong> {message}
        </Alert>
      ))}

      {/* ---------------- Sayaçlar ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t.admin.pending + " başvuru"}
          value={pendingApplications}
          href="/admin/basvurular"
          highlight={pendingApplications > 0}
        />
        <Stat
          label="Özeti eksik hafta"
          value={missingTeasers}
          href="/admin/icerik"
          highlight={missingTeasers > 0}
        />
        <Stat
          label="Senkron başarısız"
          value={failedWeeks}
          href="/admin/icerik"
          highlight={failedWeeks > 0}
        />
        <Stat label="Kamp" value={camps.length} href="/admin/merkle" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Ortak not" value={noteCount} href="/admin/notlar" />
        <Stat
          label="Hiç notu olmayan hafta"
          value={weeksWithoutNotes}
          href="/admin/notlar"
          highlight={weeksWithoutNotes > 0 && noteCount > 0}
        />
      </div>

      {/* ---------------- Senkron durumu ---------------- */}
      <Card>
        <h2 className="text-lg font-bold tracking-tight">{t.admin.lastSync}</h2>

        {lastSync ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Pill tone={lastSync.success ? "accent" : "danger"}>
              {lastSync.success ? "başarılı" : "başarısız"}
            </Pill>
            <span className="text-fg-secondary">
              {new Date(lastSync.startedAt).toLocaleString("tr-TR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
            <span className="text-fg-muted">·</span>
            <span className="text-fg-secondary">
              tetikleyen: {lastSync.trigger}
            </span>
            <span className="text-fg-muted">·</span>
            <span className="text-fg-secondary">
              {lastSync.updatedCount} güncellendi, {lastSync.unchangedCount}{" "}
              değişmedi
            </span>
            {lastSync.durationMs && (
              <>
                <span className="text-fg-muted">·</span>
                <span className="text-fg-secondary">
                  {(lastSync.durationMs / 1000).toFixed(1)} sn
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-fg-secondary">
            Henüz senkron çalıştırılmadı.
          </p>
        )}

        {lastSync?.error && (
          <p className="mt-3 rounded-md border border-danger p-3 text-sm text-danger">
            {lastSync.error}
          </p>
        )}

        <div className="mt-4">
          <Link
            href="/admin/icerik"
            className="text-sm font-semibold text-accent-text underline underline-offset-2"
          >
            {t.admin.syncNow} →
          </Link>
        </div>
      </Card>

      {/* ---------------- Katılımcı dağılımı ---------------- */}
      {participantCount > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-lg font-bold tracking-tight">
              {t.admin.referralBreakdown}
            </h2>
            <p className="mt-1 text-sm text-fg-secondary">
              {participantCount} katılımcı profil doldurdu
            </p>
            <Breakdown
              rows={referralGroups
                .map((g) => ({
                  label: referralLabel(g.referralSource),
                  count: g._count,
                }))
                .sort((a, b) => b.count - a.count)}
              total={participantCount}
            />
          </Card>

          <Card>
            <h2 className="text-lg font-bold tracking-tight">
              {t.admin.universityBreakdown}
            </h2>
            <p className="mt-1 text-sm text-fg-secondary">
              Katılımcıların geldiği kurumlar
            </p>
            <Breakdown
              rows={universityGroups
                .map((g) => ({label: g.university ?? "—", count: g._count}))
                .sort((a, b) => b.count - a.count)}
              total={participantCount}
            />
          </Card>
        </div>
      )}

      {/* ---------------- Kontrat ---------------- */}
      <Card>
        <h2 className="text-lg font-bold tracking-tight">Kontrat</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">Ağ</dt>
            <dd>{activeChain.name}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">Durum</dt>
            <dd>
              {paused === null
                ? "okunamadı (RPC)"
                : paused
                  ? "⏸ duraklatılmış"
                  : "▶ aktif"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-fg-muted">Adres</dt>
            <dd>
              <a
                href={explorerAddressUrl(contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="mono break-all underline underline-offset-2"
              >
                {contractAddress}
              </a>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

/**
 * Basit dağılım listesi — sayı + oran çubuğu.
 *
 * Grafik kütüphanesi kullanmıyoruz: birkaç satırlık bir dağılım için
 * onlarca kilobaytlık bir bağımlılık taşımak orantısız olurdu. Oran çubuğu
 * tek bir div genişliğiyle çiziliyor.
 */
function Breakdown({
  rows,
  total,
}: {
  rows: {label: string; count: number}[];
  total: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-4 text-sm text-fg-muted">Henüz veri yok.</p>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {rows.map((row) => {
        const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
        return (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums text-fg-secondary">
                {row.count}
                <span className="ml-1 text-xs text-fg-muted">%{percent}</span>
              </span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle"
              role="presentation"
            >
              <div
                className="h-full rounded-full bg-accent"
                style={{width: `${Math.max(percent, 2)}%`}}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card interactive accent={highlight} className="!p-4">
        <p
          className={[
            "text-3xl font-extrabold tabular-nums",
            highlight ? "text-accent-text" : "text-fg",
          ].join(" ")}
        >
          {value}
        </p>
        <p className="mt-1 text-sm text-fg-secondary">{label}</p>
      </Card>
    </Link>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "danger" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={[
        "rounded-lg border bg-subtle p-4 text-sm",
        tone === "danger" ? "border-danger text-danger" : "border-warning text-warning",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
