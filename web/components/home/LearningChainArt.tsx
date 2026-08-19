/**
 * Ana sayfa hero görseli.
 *
 * Dış görsel dosyası veya istemci JavaScript'i kullanmaz. Bileşen ve ona ait
 * CSS modülü tamamen izoledir; görsel yön beğenilmezse HomePage içindeki tek
 * çağrı kaldırılarak geri alınabilir.
 */
import styles from "./LearningChainArt.module.css";

type WeekCardProps = {
  week: string;
  label: string;
  tone: "earned" | "active" | "locked";
  className: string;
};

const TONE_CLASS: Record<WeekCardProps["tone"], string> = {
  earned: styles.earned,
  active: styles.active,
  locked: styles.locked,
};

function WeekCard({week, label, tone, className}: WeekCardProps) {
  return (
    <div className={`${styles.weekCard} ${TONE_CLASS[tone]} ${className}`}>
      <span className={styles.weekNumber}>{week}</span>
      <span className={styles.weekCopy}>
        <strong>HAFTA</strong>
        <small>{label}</small>
      </span>
      <span className={styles.stateMark}>{tone === "earned" ? "✓" : "·"}</span>
    </div>
  );
}

export function LearningChainArt() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.heroField} />
      <div className={styles.leftOrbit}>
        <span />
        <span />
        <span />
      </div>

      <svg
        className={styles.orbit}
        viewBox="0 0 560 560"
        fill="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="learning-path" x1="70" y1="100" x2="500" y2="470">
            <stop stopColor="var(--accent)" />
            <stop offset="0.55" stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--reward)" />
          </linearGradient>
          <radialGradient id="node-glow">
            <stop stopColor="var(--accent-text)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          className={styles.orbitLine}
          cx="280"
          cy="280"
          rx="218"
          ry="174"
          transform="rotate(-13 280 280)"
        />
        <path
          className={styles.pathLine}
          pathLength="100"
          d="M74 192C131 78 328 48 453 122C548 179 532 352 435 430C323 520 120 470 70 342"
        />

        <g className={styles.nodes}>
          <circle cx="76" cy="192" r="18" fill="url(#node-glow)" />
          <circle cx="76" cy="192" r="4" fill="var(--accent-text)" />
          <circle cx="453" cy="122" r="18" fill="url(#node-glow)" />
          <circle cx="453" cy="122" r="4" fill="var(--accent-text)" />
          <circle cx="435" cy="430" r="18" fill="url(#node-glow)" />
          <circle cx="435" cy="430" r="4" fill="var(--reward)" />
          <circle cx="70" cy="342" r="3" fill="var(--primary)" />
        </g>
      </svg>

      <div className={styles.badge}>
        <div className={styles.badgeRing}>
          <div className={styles.badgeCore}>
            <svg viewBox="0 0 48 48" fill="none" focusable="false">
              <path d="M24 4 40 11v12c0 10-6.5 17.4-16 21C14.5 40.4 8 33 8 23V11L24 4Z" />
              <path d="M19.5 27.5 28 19m-9.5-2.5-2 2a5 5 0 0 0 7 7l1.5-1.5m4.5 7.5 2-2a5 5 0 0 0-7-7L23 24" />
            </svg>
            <strong>PRU</strong>
            <span>SOULBOUND ROZET</span>
          </div>
        </div>
      </div>

      <WeekCard
        week="01"
        label="KAZANILDI"
        tone="earned"
        className={styles.cardOne}
      />
      <WeekCard
        week="02"
        label="DEVAM EDİYOR"
        tone="active"
        className={styles.cardTwo}
      />
      <WeekCard
        week="03"
        label="SIRADAKİ"
        tone="locked"
        className={styles.cardThree}
      />

      <div className={styles.chainChip}>
        <span className={styles.chainDot} />
        BASE SEPOLIA
      </div>
      <div className={styles.proofChip}>
        <code>0x7A…91F</code>
        <span>✓ zincirde</span>
      </div>
    </div>
  );
}
