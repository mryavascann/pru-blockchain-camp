/**
 * ============================================================================
 * KİLİTLİ İÇERİK EKRANI — brand.md §8
 *
 * ⚠️ BU BİLEŞENİN EN ÖNEMLİ ÖZELLİĞİ, YAPMADIĞI ŞEY:
 *    Gerçek ders içeriğini HİÇ ALMAZ.
 *
 * Yaygın (ve sahte) yaklaşım: tüm içeriği gönder, üstüne CSS blur uygula.
 * Bu koruma değildir — `Ctrl+U` ile sayfa kaynağına bakan herkes metni okur.
 *
 * Buradaki iskelet çubukları anlamsız gri dikdörtgenlerdir. Altlarında
 * bulanıklaştırılmış bir metin YOK, çünkü sunucu o metni hiç göndermedi
 * (bkz. lib/content/access.ts → PUBLIC_FIELDS).
 *
 * Gösterilen üç şeyin hepsi zaten herkese açık:
 *   1. Hafta numarası ve başlık → müfredat özetinde de görünüyor
 *   2. Özet (teaser)            → Notion'da bilerek yazılmış vitrin metni
 *   3. İskelet çubukları        → hiçbir veri taşımıyor
 * ============================================================================
 */
import Link from "next/link";

import {ButtonLink} from "@/components/ui/Button";
import {Pill} from "@/components/ui/Card";
import type {LockReason, PublicWeek} from "@/lib/content/access";
import {fmt, t} from "@/lib/i18n";

export function LockedPreview({
  week,
  reason,
  campSlug,
  publicWeekNumber,
}: {
  week: PublicWeek;
  reason: LockReason;
  campSlug: string;
  /** Varsa "örnek haftayı incele" bağlantısı gösterilir */
  publicWeekNumber: number | null;
}) {
  /*
   * Her kilit sebebi FARKLI bir çağrı gösterir — brand.md §8.4.
   *
   * Tek bir "erişimin yok" mesajı kullanıcıyı çıkmaza sokardı: cüzdanını
   * bağlaması gerekenle, 3. haftanın notunu yazması gereken kişi bambaşka
   * iki iş yapmalı.
   */
  const copy = lockCopy(reason, campSlug);

  return (
    <article
      aria-label={`${fmt(t.camp.weekLabel, {n: week.weekNumber})} — kilitli`}
      className="overflow-hidden rounded-lg border border-line bg-surface"
    >
      {/* ---- Gerçek, herkese açık kısım ---- */}
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <Pill>{fmt(t.camp.weekLabel, {n: week.weekNumber}).toUpperCase()}</Pill>
          <LockIcon />
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
          {week.title}
        </h1>

        {week.stage && (
          <p className="mt-2 text-sm text-fg-muted">{week.stage}</p>
        )}

        {week.teaser && (
          <p className="mt-4 max-w-prose leading-relaxed text-fg-secondary">
            {week.teaser}
          </p>
        )}
      </div>

      {/* ---- İskelet + kilit paneli ---- */}
      <div className="relative">
        {/*
          İskelet çubukları. `aria-hidden` çünkü hiçbir anlam taşımıyorlar —
          ekran okuyucu bunları okuyup kullanıcıyı yormasın, doğrudan
          aşağıdaki kilit mesajına gitsin.
        */}
        <div className="flex flex-col gap-3 px-6 pb-40 md:px-8" aria-hidden="true">
          {[
            "100%", "72%", "88%", "45%", "94%",
            "66%", "100%", "58%", "82%", "38%",
          ].map((width, index) => (
            <div key={index} className="skeleton-bar" style={{width}} />
          ))}
        </div>

        {/*
          Alta doğru solma — "okuma burada kesildi" hissi.
          brand.md §8.3
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--bg-surface) 65%)",
          }}
        />

        {/* Kilit paneli — gerçek metin, gerçek düğme, klavyeyle erişilebilir */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-line-accent bg-subtle">
            <LockIcon size={22} />
          </div>

          <p className="max-w-sm font-semibold">{copy.message}</p>

          {copy.help && (
            <p className="max-w-sm text-sm text-fg-secondary">{copy.help}</p>
          )}

          <ButtonLink href={copy.href} variant="accent" size="lg">
            {copy.cta}
          </ButtonLink>

          {publicWeekNumber !== null &&
            publicWeekNumber !== week.weekNumber && (
              <Link
                href={`/kamplar/${campSlug}/hafta/${publicWeekNumber}`}
                className="text-sm font-medium text-accent-text underline underline-offset-4"
              >
                {t.locked.sampleLink} →
              </Link>
            )}
        </div>
      </div>
    </article>
  );
}

/**
 * Kilit sebebini ekrandaki üç parçaya çevirir: mesaj, açıklama, düğme.
 *
 * Ayrı bir fonksiyon çünkü aynı eşleme müfredat kartlarında da lazım —
 * kural tek yerde dursun.
 */
function lockCopy(
  reason: LockReason,
  campSlug: string,
): {message: string; help?: string; cta: string; href: string} {
  switch (reason.kind) {
    case "no-session":
      return {
        message: t.locked.noSession.message,
        cta: t.locked.noSession.cta,
        href: "/katil",
      };

    case "no-nickname":
      return {
        message: t.locked.noNickname.message,
        cta: t.locked.noNickname.cta,
        href: "/katil",
      };

    case "not-approved":
      return {
        message: "Bu kampta henüz onaylı bir haftan yok.",
        help:
          "Kaçıncı haftada olduğunu bildir; kulüp yöneticisi onayladığında " +
          "o haftaya kadarki tüm içerik ve ortak notlar açılır.",
        cta: "Kampa Katıl",
        href: "/katil",
      };

    case "not-reached":
      return {
        message: `Bu haftaya henüz gelmedin.`,
        help:
          `Şu an ${reason.entitledWeek}. haftadasın. Kamp ilerledikçe yeni ` +
          "haftalar sırayla açılır — sıradaki hafta, bu haftanın notunu " +
          "bıraktığında açılacak.",
        cta: "Ortak notlara git",
        href: `/kamplar/${campSlug}/notlar`,
      };

    case "note-required":
      return {
        message: `Önce ${reason.blockingWeek}. hafta için notunu bırak.`,
        help:
          `${reason.blockingWeek}. haftayı tamamladın ama ortak deftere henüz ` +
          "not eklemedin. Bir not bıraktığında bu hafta açılır ve " +
          `${reason.blockingWeek}. haftanın rozetini alabilirsin. Öğrendiğin, ` +
          "takıldığın ya da birine anlatmak isteyeceğin ne varsa yeter.",
        cta: `${reason.blockingWeek}. hafta için not bırak`,
        href: `/kamplar/${campSlug}/notlar`,
      };
  }
}

function LockIcon({size = 18}: {size?: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-accent-text"
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
