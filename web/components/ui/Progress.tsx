/**
 * İlerleme göstergesi — brand.md §7.4
 *
 *   ■ ■ ■ □ □ □ □ □ □ □ □ □ □ □ □      3 / 15
 *
 * KUTUCUK SAYISI HİÇBİR YERDE SABİT DEĞİL. `progress` dizisinin uzunluğu
 * kampın hafta sayısından gelir; kamp 15'ten 18 haftaya çıktığında bu
 * bileşen kendiliğinden 18 kutucuk çizer. Projenin genişletilebilirlik
 * şartının arayüzdeki karşılığı budur.
 */
import {fmt, t} from "@/lib/i18n";

export function ProgressBoxes({
  progress,
  showCount = true,
  className = "",
}: {
  /** `[i] === true` ise (i+1). hafta alınmış */
  progress: boolean[];
  showCount?: boolean;
  className?: string;
}) {
  const total = progress.length;
  const done = progress.filter(Boolean).length;

  // 20'den fazla hafta olursa kutucuklar küçülür — sarmalanmaz (brand.md §7.4)
  const boxSize = total > 20 ? "h-2 w-2" : "h-3 w-3";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="flex flex-wrap gap-1"
        role="img"
        aria-label={fmt(t.camp.progressOf, {done, total})}
      >
        {progress.map((filled, index) => (
          <span
            key={index}
            title={fmt(t.camp.weekLabel, {n: index + 1})}
            aria-hidden="true"
            className={[
              boxSize,
              "rounded-[var(--radius-sm)] border transition-colors duration-150",
              filled
                ? "border-[var(--accent)] bg-[var(--accent)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-subtle)]",
            ].join(" ")}
          />
        ))}
      </div>

      {/* Görsel gösterge her zaman sayısal karşılığıyla birlikte (brand.md §9.6) */}
      {showCount && (
        <span className="mono shrink-0 text-sm tabular-nums text-[var(--fg-secondary)]">
          {done} / {total}
        </span>
      )}
    </div>
  );
}

/**
 * Yükleme iskeleti.
 *
 * brand.md §9.11: yükleme durumu spinner değil İSKELET olmalı — iskelet
 * gerçek düzenin şeklini taşır, içerik gelince sayfa zıplamaz.
 */
export function SkeletonLines({
  count = 4,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  // Değişken genişlikler doğal metin ritmi hissi verir
  const widths = ["100%", "72%", "88%", "45%", "94%", "63%"];

  return (
    <div className={`flex flex-col gap-3 ${className}`} aria-hidden="true">
      {Array.from({length: count}, (_, index) => (
        <div
          key={index}
          className="skeleton-bar"
          style={{width: widths[index % widths.length]}}
        />
      ))}
    </div>
  );
}
