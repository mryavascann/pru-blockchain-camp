/**
 * Tüm iç sayfalardaki boş alanlara derinlik veren dekoratif zincir ağı.
 * İstemci JavaScript'i ve harici görsel kullanmaz; erişilebilir içerikten
 * tamamen ayrıdır ve tek bileşen çağrısıyla geri alınabilir.
 */
import styles from "./SiteBackdrop.module.css";

export function SiteBackdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={`${styles.ring} ${styles.ringRight}`}>
        <span />
        <span />
        <span />
      </div>
      <div className={`${styles.ring} ${styles.ringLeft}`}>
        <span />
        <span />
      </div>

      <svg
        className={styles.network}
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="site-chain-line" x1="80" y1="90" x2="1360" y2="810">
            <stop stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="0.22" stopColor="var(--accent)" stopOpacity="0.72" />
            <stop offset="0.68" stopColor="var(--primary)" stopOpacity="0.52" />
            <stop offset="1" stopColor="var(--reward)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="site-node-glow">
            <stop stopColor="var(--accent-text)" stopOpacity="0.82" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          className={styles.longPath}
          pathLength="100"
          d="M-80 730C160 544 278 694 462 534C646 374 742 466 910 278C1088 80 1244 182 1520-26"
        />
        <path
          className={styles.shortPath}
          d="M-60 188C174 62 304 230 516 118C710 16 820 170 1010 92C1176 24 1300 88 1500 222"
        />

        <g className={styles.nodes}>
          <circle cx="176" cy="631" r="22" fill="url(#site-node-glow)" />
          <circle cx="176" cy="631" r="4" fill="var(--accent-text)" />
          <circle cx="462" cy="534" r="16" fill="url(#site-node-glow)" />
          <circle cx="462" cy="534" r="3" fill="var(--accent)" />
          <circle cx="910" cy="278" r="20" fill="url(#site-node-glow)" />
          <circle cx="910" cy="278" r="4" fill="var(--primary)" />
          <circle cx="1240" cy="134" r="17" fill="url(#site-node-glow)" />
          <circle cx="1240" cy="134" r="3" fill="var(--accent-text)" />
          <circle cx="516" cy="118" r="3" fill="var(--accent)" />
          <circle cx="1010" cy="92" r="3" fill="var(--reward)" />
        </g>
      </svg>

      <span className={`${styles.spark} ${styles.sparkOne}`} />
      <span className={`${styles.spark} ${styles.sparkTwo}`} />
      <span className={`${styles.spark} ${styles.sparkThree}`} />
    </div>
  );
}
