/**
 * /siralama — Leaderboard. HERKESE AÇIK, SEO'ya açık.
 *
 * Faz 0 şartı: "Leaderboard: Herkese açık. Nick + adres + kamp + tamamlanan
 * hafta."
 *
 * MOBİLDE TABLO YOK: brand.md §7.6 gereği tablo, dar ekranlarda kart
 * listesine dönüşür. Yatay kaydırma yok — kullanıcı kendi satırını
 * kaydırmadan görebilmeli.
 */
import type {Metadata} from "next";
import Link from "next/link";

import {AddressChip} from "@/components/ui/Address";
import {Container, EmptyState, Pill} from "@/components/ui/Card";
import {ProgressBoxes} from "@/components/ui/Progress";
import {computeLeaderboard} from "@/lib/leaderboard";
import {fmt, t} from "@/lib/i18n";

/* Zincir okuması pahalı; 60 saniyede bir yenilenmesi yeterli */
export const revalidate = 60;

export const metadata: Metadata = {
  title: t.leaderboard.title,
  description: t.leaderboard.subtitle,
};

export default async function LeaderboardPage() {
  const {rows, updatedAt} = await computeLeaderboard();

  return (
    <Container className="py-12 md:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {t.leaderboard.title}
        </h1>
        <p className="mt-2 text-fg-secondary">{t.leaderboard.subtitle}</p>
        <p className="mt-1 text-xs text-fg-muted">
          {fmt(t.leaderboard.updatedAt, {
            time: new Date(updatedAt).toLocaleString("tr-TR", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title={t.leaderboard.empty}
          description="İlk rozetler alındığında bu tablo dolmaya başlayacak."
        />
      ) : (
        <>
          {/* ---------------- MASAÜSTÜ: tablo ---------------- */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-fg-muted">
                  <th className="w-12 py-3 pr-2 font-semibold">
                    {t.leaderboard.rank}
                  </th>
                  <th className="py-3 pr-4 font-semibold">
                    {t.leaderboard.participant}
                  </th>
                  <th className="py-3 pr-4 font-semibold">
                    {t.leaderboard.camp}
                  </th>
                  <th className="py-3 font-semibold">
                    {t.leaderboard.progress}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.address}-${row.campSlug}`}
                    className="border-b border-line align-middle"
                  >
                    <td className="py-4 pr-2">
                      <Rank index={index} />
                    </td>
                    <td className="py-4 pr-4">
                      {row.nickname ? (
                        <Link href={`/profil/${encodeURIComponent(row.nickname)}`} className="rounded underline-offset-4 hover:underline">
                          <AddressChip address={row.address} nickname={row.nickname} showExplorer={false} />
                        </Link>
                      ) : (
                        <AddressChip address={row.address} showExplorer={false} />
                      )}
                    </td>
                    <td className="py-4 pr-4 text-sm text-fg-secondary">
                      {row.campName}
                    </td>
                    <td className="py-4">
                      <ProgressBoxes progress={row.progress} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------------- MOBİL: kart listesi ---------------- */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((row, index) => (
              <div
                key={`${row.address}-${row.campSlug}`}
                className="rounded-lg border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Rank index={index} />
                    {row.nickname ? (
                      <Link href={`/profil/${encodeURIComponent(row.nickname)}`} className="rounded underline-offset-4 hover:underline">
                        <AddressChip address={row.address} nickname={row.nickname} showExplorer={false} />
                      </Link>
                    ) : (
                      <AddressChip address={row.address} showExplorer={false} />
                    )}
                  </div>
                  <Pill tone="muted">{row.campName.split(" ").pop()}</Pill>
                </div>
                <div className="mt-3">
                  <ProgressBoxes progress={row.progress} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Container>
  );
}

/**
 * Sıra numarası. İlk üç amber renkli — brand.md §2.1'deki
 * "amber yalnızca başarı anlarında" kuralına uygun.
 */
function Rank({index}: {index: number}) {
  const isTop3 = index < 3;
  return (
    <span
      className={[
        "mono inline-block w-8 text-center text-sm font-bold tabular-nums",
        isTop3 ? "text-reward" : "text-fg-muted",
      ].join(" ")}
    >
      {index + 1}
    </span>
  );
}
