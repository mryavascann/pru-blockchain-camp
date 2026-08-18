"use client";

/**
 * ============================================================================
 * TEK SEFERLİK KARŞILAMA — ilk notunu yazacak kişiye
 *
 * ---------------------------------------------------------------------------
 * NEDEN AYRI BİR EKRAN, NEDEN "TEK SEFERLİK" YAZIYOR
 *
 * Yazma rehberi önce formun altında sürekli açık duruyordu: ilk gelen kişi
 * için gerekli, ikinci notunu yazan için gürültü. Sonra bir bağlantının
 * arkasına alındı — bu sefer ilk gelen kişi hiç okumadan boş kutuya bakıyordu.
 *
 * Doğrusu ikisinin ortası: rehber İLK notta bir kez, kendi ekranında,
 * okunmayı hak edecek kadar öne çıkarak gelir; kişi "Okudum, Anladım" der ve
 * BİR DAHA ÇIKMAZ.
 *
 * Üstteki "TEK SEFERLİK" etiketi ve altındaki cümle bilerek var. Bir kullanıcı
 * karşısına çıkan uzun metni "bu her seferinde mi çıkacak?" diye okur; cevabı
 * en baştan verirsek metni okur, cevabı vermezsek kapatmanın yolunu arar.
 * ---------------------------------------------------------------------------
 * NEREDE SAKLANIYOR
 *
 * `localStorage`, kamp başına bir anahtar. Sunucuda bir alan açmadık: burada
 * korunan şey bir hak ya da kural değil, yalnızca "bu metni gördüm" bilgisi.
 * Yanlış tarafa düşerse (tarayıcı temizlendi, başka cihaz) bedeli, bir kez
 * daha görünen bir rehber — kabul edilebilir.
 *
 * `localStorage` erişilemiyorsa GÖSTERMEME tarafına düşüyoruz: her açılışta
 * çıkan bir "tek seferlik" ekran, hiç çıkmayandan daha kötü. Rehber zaten
 * formun altındaki bağlantıdan her zaman açılabiliyor.
 * ============================================================================
 */
import {Button} from "@/components/ui/Button";
import type {NoteKind} from "@/lib/notes/rules";
import {NotesGuide} from "./NotesGuide";

const STORAGE_PREFIX = "pru:notes-guide-seen:";

/** Bu kampta karşılama ekranı daha önce onaylandı mı? */
export function hasSeenNotesGuide(campSlug: string): boolean {
  /* Sunucuda ve localStorage kapalıyken "görüldü" sayıyoruz — bkz. başlık */
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + campSlug) === "1";
  } catch {
    return true;
  }
}

function markSeen(campSlug: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + campSlug, "1");
  } catch {
    /* Yazamadıysak da akış durmasın; en kötü ihtimalle bir kez daha çıkar */
  }
}

export function FirstNoteGuide({
  campSlug,
  weekNumber,
  kind,
  onDone,
  onCancel,
}: {
  campSlug: string;
  /** Onaydan sonra hangi haftaya yazılacağı — beklentiyi baştan söylüyoruz */
  weekNumber: number;
  /** Seçilmiş tür varsa rehber o türün yönergesini öne alır */
  kind?: NoteKind;
  onDone: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="reveal-soft flex flex-col gap-4">
      {/*
        BU BLOK BİLEREK YÜKSEK SESLE KONUŞUYOR.

        Altında uzun bir rehber var; kullanıcı onu okumadan önce "bu her
        seferinde mi çıkacak?" sorusunun cevabını almalı. Cevap sönük bir
        gri satırda dururken göz onu atlıyor ve metin bir engel gibi
        görünüyordu. Dolgu rozet, renkli başlık ve kalın vurgu, o tek
        cümleyi sayfadaki en görünür şey yapıyor.

        Renk: türlerin füşyası (--kind-summary). Dolgu üzerindeki yazı
        `--kind-summary-fg` ile geliyor; iki temada da kontrast ölçülü.
      */}
      <div className="relative overflow-hidden rounded-lg border border-kind-summary bg-subtle py-5 pr-5 pl-6">
        {/* Sol renk şeridi — kenarlık kalınlığını değiştirmeden ağırlık verir */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1.5 bg-kind-summary"
        />

        {/*
          İkon YOK ve bu bilinçli: bu arayüzde ışıltı ikonu "yapay zekâ
          yardımıyla" işaretini taşıyor (bkz. kindVisuals → SparkleIcon).
          Buraya konsaydı iki ayrı anlam aynı simgeye binerdi. Dolgu rozet
          zaten yeterince yüksek sesle konuşuyor.
        */}
        <span className="inline-flex items-center rounded-full bg-kind-summary px-3 py-1 text-xs font-extrabold tracking-[0.14em] text-kind-summary-fg uppercase">
          Tek Seferlik
        </span>

        <h2 className="mt-3 text-2xl leading-tight font-extrabold tracking-tight md:text-3xl">
          İlk Notundan Önce —{" "}
          <span className="text-kind-summary">Kısa Bir Açıklama</span>
        </h2>

        <p className="mt-2.5 text-base leading-relaxed text-fg-secondary">
          Bu ekranı{" "}
          <strong className="font-extrabold text-kind-summary">
            yalnızca bir kez
          </strong>{" "}
          göreceksin. Okuyup onayladıktan sonra{" "}
          <strong className="font-bold text-fg">
            bir daha karşına çıkmayacak
          </strong>
          ; sonraki notlarında formun altındaki{" "}
          <em className="text-accent-text font-semibold not-italic">
            &ldquo;İyi not nasıl olur?&rdquo;
          </em>{" "}
          bağlantısından istediğinde açabilirsin.
        </p>
      </div>

      <NotesGuide variant="write" kind={kind} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="accent"
          onClick={() => {
            markSeen(campSlug);
            onDone();
          }}
        >
          Okudum, Anladım — {weekNumber}. Haftaya Yazmaya Başla
        </Button>

        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Vazgeç
          </Button>
        )}
      </div>
    </div>
  );
}
