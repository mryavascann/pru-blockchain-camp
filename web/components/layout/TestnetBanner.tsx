/**
 * Test ağı uyarı şeridi.
 *
 * NEDEN VAR: Site Base Sepolia'da çalışırken rozetler gerçek değer taşımaz.
 * Bunu söylememek, katılımcının "gerçek bir sertifika aldım" sanmasına yol
 * açar. Faz 0'daki dürüstlük ilkesinin arayüzdeki karşılığı.
 *
 * Mainnet'e geçildiğinde (`NEXT_PUBLIC_CHAIN="base"`) kendiliğinden kaybolur.
 */
import {isTestnet} from "@/lib/chain/config";
import {t} from "@/lib/i18n";

export function TestnetBanner() {
  if (!isTestnet) return null;

  return (
    <div
      role="status"
      className="border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-subtle)] px-4 py-2 text-center text-xs text-[color:var(--fg-secondary)]"
    >
      <span aria-hidden="true">🧪 </span>
      {t.common.testnetWarning}
    </div>
  );
}
