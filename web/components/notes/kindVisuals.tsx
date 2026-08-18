/**
 * ============================================================================
 * NOT TÜRLERİNİN GÖRSEL KİMLİĞİ — çizgi ikonlar + tür renkleri
 *
 * ---------------------------------------------------------------------------
 * GERİ ALINABİLİR OLMASI İÇİN AYRI DOSYA
 *
 * `lib/notes/rules.ts` kuralların ve metinlerin tek kaynağı. Oradaki `icon`
 * alanı (emoji) ve `noteKindIcon()` fonksiyonu OLDUĞU GİBİ DURUYOR — hiç
 * dokunulmadı. Buradaki çizgi ikon seti onun üstüne geçirilmiş bir katman.
 *
 * Beğenilmezse geri dönüş tek satırlık: kullanan yerlerde
 *   <NoteKindIcon kind={k} />   yerine   <span>{noteKindIcon(k)}</span>
 * yazmak yeterli. Kural dosyasında silinmiş bir şey olmadığı için emoji'ler
 * aynı anda hâlâ orada.
 * ---------------------------------------------------------------------------
 * NEDEN EMOJİ DEĞİL
 *
 * Emoji her işletim sisteminde farklı boyda, farklı kalınlıkta ve KENDİ
 * renginde çıkar. Bir çip sırasında satır hizasını bozar, seçili duruma
 * geçince rengi değişmez, soluk (dim) duruma da girmez. Çizgi ikon
 * `currentColor` kullanır: türün rengini, hover'ı, seçili/soluk durumu
 * kendiliğinden izler.
 * ---------------------------------------------------------------------------
 * RENKLER — TEK BAŞINA BİLGİ TAŞIMIYOR
 *
 *   Terim / Kavram  → camgöbeği (--kind-term)     "öğrendim"
 *   Haftanın Özeti  → füşya     (--kind-summary)  "haftayı anlattım"
 *   Faydalı Kaynak  → yeşil     (--kind-source)   "işe yarar"
 *   Takıldığım Yer  → amber     (--kind-pitfall)  "dikkat"
 *
 * İLK DENEMEDE İKİSİ MORDU — accent (neon menekşe) ve primary (mor). Sitenin
 * zemini zaten mor olduğu için o iki tür hiç ayrışmıyordu; renk verilmiş ama
 * görünmüyordu. Şimdi dördü de zeminden uzak, birbirinden de uzak hue'lar:
 * camgöbeği 190°, yeşil 145°, amber 40°, füşya 330°.
 *
 * Renkler `globals.css` içinde --kind-* semantik token'ları olarak duruyor;
 * bir türün rengini değiştirmek isteyen oraya bakar, buraya değil.
 *
 * Rengin göründüğü her yerde ikon VE etiket de var (brand.md §3). Renk körü
 * bir okuyucu hiçbir bilgi kaybetmez; renk yalnızca listeyi tararken hızı
 * artırır.
 * ============================================================================
 */
import type {ReactNode} from "react";

import type {NoteKind} from "@/lib/notes/rules";

/* -------------------------------------------------------------------------- */
/*                                  RENKLER                                   */
/* -------------------------------------------------------------------------- */

/*
 * Sınıf adları TAM METİN olarak yazılmalı — Tailwind kaynak dosyaları
 * tarayarak sınıf üretir, `text-${tone}` gibi birleştirmeler derlemeye
 * girmez ve sessizce renksiz kalır.
 */

/** Türün kendi rengi — ikon her durumda bunu taşır */
export const KIND_TEXT: Record<NoteKind, string> = {
  TERIM: "text-kind-term",
  OZET: "text-kind-summary",
  KAYNAK: "text-kind-source",
  TUZAK: "text-kind-pitfall",
};

/** Boştaki çip: nötr kenarlık, hover'da türün rengi */
export const KIND_HOVER_BORDER: Record<NoteKind, string> = {
  TERIM: "hover:border-kind-term",
  OZET: "hover:border-kind-summary",
  KAYNAK: "hover:border-kind-source",
  TUZAK: "hover:border-kind-pitfall",
};

/** Seçili çip: renkli kenarlık + renkli yazı + hafif zemin */
export const KIND_ACTIVE: Record<NoteKind, string> = {
  TERIM: "border-kind-term bg-subtle text-kind-term",
  OZET: "border-kind-summary bg-subtle text-kind-summary",
  KAYNAK: "border-kind-source bg-subtle text-kind-source",
  TUZAK: "border-kind-pitfall bg-subtle text-kind-pitfall",
};

/** Not kartındaki tür etiketi (`Pill` üzerine geçen renk) */
export const KIND_PILL: Record<NoteKind, string> = {
  TERIM: "!border-kind-term !text-kind-term",
  OZET: "!border-kind-summary !text-kind-summary",
  KAYNAK: "!border-kind-source !text-kind-source",
  TUZAK: "!border-kind-pitfall !text-kind-pitfall",
};

/* -------------------------------------------------------------------------- */
/*                                  İKONLAR                                   */
/* -------------------------------------------------------------------------- */

/** Ortak SVG kabuğu — tek yerde: kalınlık, uç biçimi ve erişilebilirlik */
function Glyph({
  children,
  className = "h-4 w-4",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

const KIND_GLYPH: Record<NoteKind, ReactNode> = {
  /* Büyüteç — "araştırdım, öğrendim" */
  TERIM: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),

  /* Satırlı sayfa — "haftayı yazdım" */
  OZET: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),

  /* Zincir halkası — "bağlantı" */
  KAYNAK: (
    <>
      <path d="M10.5 13.5a4.5 4.5 0 0 0 6.36 0l2.4-2.4a4.5 4.5 0 0 0-6.36-6.36l-1.2 1.2" />
      <path d="M13.5 10.5a4.5 4.5 0 0 0-6.36 0l-2.4 2.4a4.5 4.5 0 0 0 6.36 6.36l1.2-1.2" />
    </>
  ),

  /* Ünlem üçgeni — "dikkat, buraya takıldım" */
  TUZAK: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17.2h.01" />
    </>
  ),
};

/** Not türünün çizgi ikonu. Rengi çevresindeki metinden alır. */
export function NoteKindIcon({
  kind,
  className,
}: {
  kind: NoteKind;
  className?: string;
}) {
  return <Glyph className={className}>{KIND_GLYPH[kind]}</Glyph>;
}

/* ------------------------- Not defterinin diğer işaretleri ------------------ */

/** Yapay zekâ işareti — emoji 🤖 yerine */
export function SparkleIcon({className}: {className?: string}) {
  return (
    <Glyph className={className}>
      <path d="M12 3.5 13.5 8 18 9.5 13.5 11 12 15.5 10.5 11 6 9.5 10.5 8 12 3.5Z" />
      <path d="m18.5 15.5.75 2.25L21.5 18.5l-2.25.75L18.5 21.5l-.75-2.25L15.5 18.5l2.25-.75L18.5 15.5Z" />
    </Glyph>
  );
}

/** Kaynak bağlantısı işareti — emoji 🔗 yerine */
export function LinkIcon({className}: {className?: string}) {
  return <Glyph className={className}>{KIND_GLYPH.KAYNAK}</Glyph>;
}

/** Kilitli hafta işareti — emoji 🔒 yerine */
export function LockIcon({className}: {className?: string}) {
  return (
    <Glyph className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Glyph>
  );
}
