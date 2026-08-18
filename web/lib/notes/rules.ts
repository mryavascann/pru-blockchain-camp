/**
 * ============================================================================
 * NOT DEFTERİ — KURALLAR VE YÖNERGE METİNLERİ
 *
 * Bu dosya iki işi birden yapar ve bu bilinçli:
 *   1. Doğrulama kuralları (sunucu tarafı zorunluluklar)
 *   2. Kullanıcıya gösterilen yönerge metinleri
 *
 * NEDEN AYNI DOSYADA: Kural ile açıklaması ayrı dosyalarda dursaydı, biri
 * değişip diğeri eskiyebilirdi — kullanıcıya "en az 80 karakter" yazarken
 * sunucunun 120 istediği bir durum. Burada tek kaynak var; `lib/participant.ts`
 * ile aynı desen.
 *
 * ---------------------------------------------------------------------------
 * BU ÖZELLİK NEDEN VAR — VE ÖNCEKİ DENEME NEDEN BAŞARISIZ OLDU
 *
 * Kulübün Notion'da bir "Kamp Wiki & Ortak Ders Notları" sayfası vardı.
 * İçinde her kamp/hafta için bir satır açılmıştı ve HEPSİ BOŞTU. Sebep tek
 * bir şey değil, iki şey:
 *
 *   a) Katkı vermek isteyen kişi BOŞ BİR SAYFAYLA karşılaşıyordu. "Ne
 *      yazacağım?" sorusunun cevabı hiçbir yerde yoktu.
 *   b) Not yazmak hiçbir şeyi açmıyordu — yazmamanın bir bedeli yoktu.
 *
 * Buradaki tasarım ikisini de hedefliyor:
 *   (a) için → boş kutu YOK. Önce tür seçilir; her türün kendi yönergesi,
 *              kendi örneği ve kendi yer tutucu metni vardır.
 *   (b) için → not, haftanın rozetini ve BİR SONRAKİ HAFTANIN İÇERİĞİNİ açar.
 *              (bkz. lib/notes/progress.ts)
 * ---------------------------------------------------------------------------
 */

/** Veritabanındaki `NoteKind` enum'ıyla birebir aynı olmalı */
export const NOTE_KINDS = ["TERIM", "OZET", "KAYNAK", "TUZAK"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NOTE_STATUSES = ["VISIBLE", "HIDDEN"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*                              UZUNLUK SINIRLARI                             */
/* -------------------------------------------------------------------------- */

export const TITLE_MIN = 5;
export const TITLE_MAX = 120;

/**
 * Gövde için alt sınır.
 *
 * NEDEN VAR: Not zorunlu olduğu için "asd" yazıp geçme dürtüsü doğar.
 * Bir alt sınır bunu zorlaştırır.
 *
 * NEDEN 20 (önce 80'di): 80 karakter, kısa ama gerçek bir katkıyı da
 * engelliyordu — "Nonce, işlem sayacı. Her işlemde bir artar." işe yarar
 * bir nottur ve 80'in altındadır. Sınırı yükseltmek insanları anlamsız
 * metinle boşluk doldurmaya iter; amaç uzun not değil, işe yarar not.
 * 20 karakter yalnızca "asd" türü geçiştirmeyi keser.
 */
export const BODY_MIN = 20;
export const BODY_MAX = 4000;

/* -------------------------------------------------------------------------- */
/*                          TÜRLER VE YÖNERGELERİ                             */
/* -------------------------------------------------------------------------- */

export type NoteKindInfo = {
  value: NoteKind;
  /** Seçim düğmesinde görünen ad */
  label: string;
  /** Tek cümlelik tanım */
  summary: string;
  /** Emoji — türleri listede hızlı ayırt etmek için */
  icon: string;
  /** Formda ne yazılacağını anlatan yönerge */
  guidance: string;
  /** Gövde alanının yer tutucusu */
  placeholder: string;
  /** Somut, iyi bir örnek */
  example: {title: string; body: string};
  /** Bu tür için kaynak bağlantısı zorunlu mu? */
  requiresSource: boolean;
};

export const NOTE_KIND_INFO: Record<NoteKind, NoteKindInfo> = {
  TERIM: {
    value: "TERIM",
    label: "Terim / kavram",
    icon: "🔍",
    summary: "Anlamadığın bir kelimeyi öğrendin — öğrendiğini buraya bırak.",
    guidance:
      "Bu hafta anlamını bilmediğin bir terime denk geldin ve araştırdın " +
      "(hocaya sordun, yapay zekâya sordun, doküman okudun). Öğrendiğin " +
      "açıklamayı buraya yaz. Senin takıldığın yerde başkası da takılacak; " +
      "onun aynı yolu baştan yürümesine gerek kalmasın.",
    placeholder:
      "Terimin ne anlama geldiğini, kendi anladığın hâliyle yaz.\n" +
      "Yapay zekâya sorduysan cevabını buraya yapıştırabilirsin — " +
      "aşağıdaki kutucuğu işaretlemeyi unutma.",
    example: {
      title: "\"Idempotent\" ne demek?",
      body:
        "Bir işlemi bir kez de yapsan on kez de yapsan sonucun değişmemesi " +
        "demek. Örnek: \"bu kullanıcının rolünü admin yap\" idempotenttir, " +
        "on kez çalıştırsan da rol admin kalır. \"Bakiyeye 10 ekle\" değildir, " +
        "on kez çalışırsa 100 eklenir. Derste API'lerin neden idempotent " +
        "tasarlandığını konuşurken geçmişti.",
    },
    requiresSource: false,
  },

  OZET: {
    value: "OZET",
    label: "Hafta özeti",
    icon: "📝",
    summary: "Haftayı kendi cümlelerinle anlat.",
    guidance:
      "Bu hafta aslında neyi öğretti? Slaytları kopyalama — kendi " +
      "cümlelerinle, \"bu haftanın asıl meselesi şuydu\" diyerek yaz. " +
      "Haftayı kaçıran ya da tekrar edecek biri için en değerli not budur.",
    placeholder:
      "Bu haftanın asıl konusu neydi? Sonunda ne yapabilir hâle geldin?\n" +
      "Bir sonraki haftaya geçerken aklında tutulması gereken ne var?",
    example: {
      title: "Hafta 3 — asıl mesele durumu (state) yönetmekmiş",
      body:
        "Hafta boyunca farklı örnekler yaptık ama hepsinin altındaki soru " +
        "aynıydı: veri nerede duracak ve değiştiğinde kim haberdar olacak. " +
        "Başta konuyu \"buton nasıl çalışır\" sanmıştım, öyle değilmiş. " +
        "Sonunda küçük bir sayaç uygulamasını sıfırdan yazabilir hâle geldim. " +
        "4. haftaya geçerken bu ayrımı netleştirmiş olmak gerekiyor.",
    },
    requiresSource: false,
  },

  KAYNAK: {
    value: "KAYNAK",
    label: "Faydalı kaynak",
    icon: "🔗",
    summary: "İşine yarayan bir bağlantı — ve neden yaradığı.",
    guidance:
      "Bu haftayı anlamana yardım eden bir video, yazı veya dokümantasyon " +
      "buldun. Bağlantıyı ekle ve MUTLAKA neden faydalı olduğunu yaz. " +
      "Açıklamasız bir bağlantı işe yaramaz: kimse 40 dakikalık bir videoyu " +
      "\"acaba içinde var mı\" diye açmaz.",
    placeholder:
      "Bu kaynak tam olarak neyi açıklıyor ve hangi kısmı işine yaradı?\n" +
      "Video ise hangi dakikası? Uzunsa hangi bölümü okumak yeterli?",
    example: {
      title: "Merkle ağacını görselleştiren interaktif sayfa",
      body:
        "Derste merkle proof'un neden sadece log(n) hash gerektirdiğini " +
        "anlamamıştım. Bu sayfada yaprakları tıklayınca hangi kardeş " +
        "hash'lerin kullanıldığını canlı gösteriyor, 5 dakikada oturdu. " +
        "Sadece üstteki interaktif kısma bak, aşağısındaki kod örnekleri " +
        "bizim kullandığımız kütüphaneye ait değil.",
    },
    requiresSource: true,
  },

  TUZAK: {
    value: "TUZAK",
    label: "Takıldığım yer",
    icon: "⚠️",
    summary: "Seni saatlerce uğraştıran şey — ve çözümü.",
    guidance:
      "Bir yerde takıldın, uğraştın, sonunda çözdün. İşte o. Hatanın ne " +
      "olduğunu ve nasıl çıktığını yaz. Bu, not defterinin en çok zaman " +
      "kazandıran türü: aynı tuzağa düşen kişi saatler yerine dakikalar " +
      "harcar.",
    placeholder:
      "Ne yapmaya çalışıyordun, ne oldu, hata mesajı neydi?\n" +
      "Sonunda çözümü ne oldu ve sorunun asıl sebebi neymiş?",
    example: {
      title: "Cüzdan bağlanıyor ama işlem \"nonce too low\" diyor",
      body:
        "Arka arkaya iki işlem gönderince ikincisi hep hata verdi. Sebebi " +
        "şuymuş: ilk işlem daha zincire yazılmadan ikincisini gönderiyordum " +
        "ve ikisi de aynı nonce'u alıyordu. Çözüm, ilk işlemin onayını " +
        "bekleyip öyle göndermek. MetaMask'ta \"Ayarlar > Gelişmiş > Hesabı " +
        "sıfırla\" ile takılan işlemleri temizleyebiliyorsun.",
    },
    requiresSource: false,
  },
};

/** Sıralı liste — formdaki tür seçici bu sırayı kullanır */
export const NOTE_KIND_LIST: NoteKindInfo[] = NOTE_KINDS.map(
  (kind) => NOTE_KIND_INFO[kind],
);

export function noteKindLabel(kind: string): string {
  return NOTE_KIND_INFO[kind as NoteKind]?.label ?? kind;
}

export function noteKindIcon(kind: string): string {
  return NOTE_KIND_INFO[kind as NoteKind]?.icon ?? "•";
}

export function isNoteKind(value: unknown): value is NoteKind {
  return (
    typeof value === "string" && (NOTE_KINDS as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/*                              BAĞLANTI GÜVENLİĞİ                            */
/* -------------------------------------------------------------------------- */

/**
 * Bir kaynak bağlantısını doğrular.
 *
 * ⚠️ YALNIZCA http VE https. Bu kontrol kozmetik değil:
 * `javascript:alert(1)` bir bağlantının `href`'ine konursa, tıklayan
 * kullanıcının oturumunda kod çalışır. `data:text/html,...` da aynı kapıyı
 * açar. Bu yüzden protokol beyaz listesi hem SUNUCUDA (kayıt anında) hem
 * de EKRANDA (render anında) uygulanır — biri atlanırsa diğeri tutar.
 *
 * @returns Normalize edilmiş URL, ya da geçersizse `null`
 */
export function safeUrl(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  return url.toString();
}

/* -------------------------------------------------------------------------- */
/*                                DOĞRULAMA                                   */
/* -------------------------------------------------------------------------- */

export type NoteDraft = {
  kind: string;
  title: string;
  body: string;
  sourceUrl?: string | null;
  aiAssisted?: boolean;
};

export type NoteValidation =
  | {ok: true; value: {
      kind: NoteKind;
      title: string;
      body: string;
      sourceUrl: string | null;
      aiAssisted: boolean;
    }}
  | {ok: false; error: string};

/**
 * Bir not taslağını doğrular.
 *
 * Aynı fonksiyon HEM formda (anında geri bildirim) HEM sunucuda (asıl karar)
 * çalışır. Formdaki kontrol bir kolaylıktır; kural sunucuda uygulanır —
 * kimse tarayıcı konsolundan istek atarak 3 harflik not bırakamasın.
 */
export function validateNote(draft: NoteDraft): NoteValidation {
  if (!isNoteKind(draft.kind)) {
    return {ok: false, error: "Not türü seçilmedi."};
  }

  const title = draft.title.trim().replace(/\s+/g, " ");
  if (title.length < TITLE_MIN) {
    return {
      ok: false,
      error: `Başlık en az ${TITLE_MIN} karakter olmalı — okuyan kişi listede neye baktığını anlasın.`,
    };
  }
  if (title.length > TITLE_MAX) {
    return {ok: false, error: `Başlık en fazla ${TITLE_MAX} karakter olabilir.`};
  }

  /* Satır sonlarını koru, ama satır başı/sonu boşluklarını temizle */
  const body = draft.body
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  if (body.length < BODY_MIN) {
    return {
      ok: false,
      error:
        `Not en az ${BODY_MIN} karakter olmalı (şu an ${body.length}). ` +
        "Bu not senden sonra gelen birine gerçekten yardım etmeli.",
    };
  }
  if (body.length > BODY_MAX) {
    return {
      ok: false,
      error: `Not en fazla ${BODY_MAX} karakter olabilir. Uzunsa ikiye böl.`,
    };
  }

  const info = NOTE_KIND_INFO[draft.kind];
  const sourceUrl = safeUrl(draft.sourceUrl);

  if (draft.sourceUrl && draft.sourceUrl.trim() && !sourceUrl) {
    return {
      ok: false,
      error: "Bağlantı geçerli değil. http:// veya https:// ile başlamalı.",
    };
  }

  if (info.requiresSource && !sourceUrl) {
    return {
      ok: false,
      error: "\"Faydalı kaynak\" notunda bağlantı zorunlu — kaynağın kendisi eksik olmasın.",
    };
  }

  return {
    ok: true,
    value: {
      kind: draft.kind,
      title,
      body,
      sourceUrl,
      aiAssisted: Boolean(draft.aiAssisted),
    },
  };
}
