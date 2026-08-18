# PRU Blockchain Kulübü — Marka & Tasarım Sistemi

> Bu doküman frontend'in **tek doğruluk kaynağıdır.** `web/` altındaki her component
> buradaki token'lara birebir uyar. Buraya yazılmamış bir renk, boşluk veya font
> ölçüsü koda girmez.
>
> **Durum:** v2 (18 Ağustos 2026) — Palet kulüp logosundan türetildi ve
> `web/app/globals.css` içinde uygulandı.

---

## 1. Marka konsepti

**"Derinlik ve Işık"**

> **v2 — 18 Ağustos 2026:** Palet, kulüp logosu geldikten sonra yeniden
> türetildi. Önceki taslak lacivert + turkuaz üzerineydi; logo mor/menekşe
> olduğu için tüm sistem ona göre değiştirildi.

Kulüp logosu derin mor bir zemin üzerine neon menekşe çizgilerle çizilmiş bir
çapa ve blok zinciri. Denizcilik (çapa) ile blokzincir (küpler, devre yolları)
tek görselde birleşiyor. Tasarım dili bunu izliyor:

- **Derin mor zemin** → logonun kendi zemini; gece, derinlik, ciddiyet
- **Neon menekşe** → logonun parıltısı; aktiflik, doğrulanmışlık, "bu rozet gerçek"
- **Altın amber** → başarı, tamamlanma, ödül anları

Amber neden korundu: logo tek renkli (monokrom mor). Ödül anları için ayırt
edici bir renk gerekiyor ve mor üzerinde en güçlü kontrastı altın sarısı
veriyor. Ayrıca ödül renginin markanın ana renginden farklı olması, "kazandın"
anının gerçekten öne çıkmasını sağlıyor.

**Ton:** Ciddi ama soğuk değil. Akademik ama bürokratik değil. Bu bir öğrenci
kulübü — kurumsal bir bankanın arayüzü gibi durmamalı, ama bir memecoin sitesi
gibi de durmamalı.

**Tasarım gerilimi:** Sayfanın çoğu sakin ve nötr. Renk yalnızca **anlam taşıdığı
yerde** kullanılır: kazanılmış rozet, aktif hafta, doğrulanmış cüzdan. Her yeri
renkli yaparsak hiçbir şey öne çıkmaz.

---

## 2. Renk paleti

Tüm renkler CSS değişkeni olarak tanımlanır. Component'lerde **ham hex yazılmaz**,
her zaman semantik token kullanılır.

### 2.1 Marka ölçekleri (tema-bağımsız ham değerler)

**Mor — "Derinlik" (primary)** · logonun zemini

| Token | Hex | Kullanım |
|---|---|---|
| `--violet-950` | `#0E001F` | Dark tema en derin zemin |
| `--violet-900` | `#180034` | Dark tema sayfa zemini · rozet arka planı |
| `--violet-800` | `#24004C` | **Logonun tam zemin rengi** — dark tema yüzey (kart) |
| `--violet-700` | `#35006F` | Dark tema kenarlık |
| `--violet-600` | `#480096` | Vurgu, hover |
| `--violet-500` | `#5D0BBB` | **Ana marka rengi** — light temada primary buton |
| `--violet-400` | `#7B2FD6` | Dark temada primary buton, link |
| `--violet-300` | `#9C68E0` | Dark temada link |
| `--violet-200` | `#C2A2EC` | Pasif ikon |
| `--violet-100` | `#E1D0F7` | Light temada seçili satır zemini |
| `--violet-50`  | `#F4ECFD` | Light temada bilgi kutusu zemini |

> Ölçek, logonun zemininden **piksel örneklemesiyle** türetildi: `#24004C`
> (H 268°, S %100, L %15). Tüm tonlar aynı renk tonuna (H=268) sabitlenip
> yalnızca aydınlık ekseninde üretildi — hiçbir ton logodan sapmıyor.

**Neon menekşe — "Işık" (accent / doğrulanmış)** · logonun parıltısı

| Token | Hex | Kullanım |
|---|---|---|
| `--neon-700` | `#7A2AA8` | Light temada accent metin (beyaz üstünde 7.71:1) |
| `--neon-600` | `#9339C4` | **Accent** — light temada buton zemini (5.80:1) |
| `--neon-500` | `#AC55DE` | Dark temada accent, kazanılmış rozet çerçevesi |
| `--neon-400` | `#C77DEF` | Dark temada accent metin |
| `--neon-300` | `#DEADE7` | **Logodan doğrudan örneklendi** — parıltı, focus halkası |

> Logonun parıltı çizgileri H≈284°, doygunluk ≈%48 — saf mor değil, hafif
> pembeye kaçan yumuşak bir menekşe. Ölçek buna göre kuruldu.

**Amber — "Başarı" (ödül anları)**

| Token | Hex | Kullanım |
|---|---|---|
| `--amber-600` | `#9A6300` | Light temada amber metin (beyaz üstünde 5.05:1) |
| `--amber-500` | `#F0A500` | Rozet mint başarı animasyonu, leaderboard ilk 3 |
| `--amber-400` | `#FFB92E` | Dark temada amber metin |

> **Kullanım disiplini:** Amber **yalnızca** başarı anlarında görünür — rozet
> kazanıldığında, leaderboard'da ilk üçte. Menüde, butonlarda, dekorasyonda amber
> kullanılmaz. Nadir olduğu için değerli.

**Nötr — mor tonlu gri**

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `--gray-0`   | `#FFFFFF` | | `--gray-500` | `#756B83` |
| `--gray-50`  | `#FAF8FC` | | `--gray-600` | `#574E64` |
| `--gray-100` | `#F3EFF7` | | `--gray-700` | `#3F384B` |
| `--gray-200` | `#E6E0EC` | | `--gray-800` | `#292332` |
| `--gray-300` | `#CDC5D8` | | `--gray-900` | `#191320` |
| `--gray-400` | `#A096AE` | | `--gray-950` | `#0D0813` |

**Semantik**

| Anlam | Light | Dark |
|---|---|---|
| Başarılı | `#16A34A` | `#4ADE80` |
| Uyarı | `#B45309` | `#FBBF24` |
| Hata | `#DC2626` | `#F87171` |
| Bilgi | `--violet-500` | `--violet-300` |

### 2.2 Semantik token'lar (component'ler sadece bunları kullanır)

```css
:root {
  /* ---- LIGHT (varsayılan tanım) ---- */
  --bg-base:        var(--gray-50);    /* sayfa zemini */
  --bg-surface:     var(--gray-0);     /* kart, panel */
  --bg-elevated:    var(--gray-0);     /* modal, dropdown */
  --bg-subtle:      var(--gray-100);   /* tablo başlığı, kod bloğu */
  --bg-inverse:     var(--violet-900);   /* koyu şerit, footer */

  --fg-primary:     var(--gray-900);   /* ana metin */
  --fg-secondary:   var(--gray-600);   /* açıklama, meta */
  --fg-muted:       var(--gray-400);   /* placeholder, pasif */
  --fg-inverse:     var(--gray-0);     /* koyu zemin üstü metin */
  --fg-link:        var(--violet-500);

  --border-subtle:  var(--gray-200);   /* kart kenarı */
  --border-strong:  var(--gray-300);   /* input kenarı */
  --border-accent:  var(--neon-500);   /* aktif/seçili */

  --accent:         var(--neon-600);   /* light'ta kontrast için 600 */
  --accent-fg:      var(--gray-0);
  --primary:        var(--violet-500);
  --primary-fg:     var(--gray-0);
  --reward:         var(--amber-600);

  --focus-ring:     var(--neon-500);
}

/* Sistem tercihi karanlıksa VE kullanıcı açıkça light seçmediyse */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* ...dark değerleri... */ }
}

/* Kullanıcı açıkça dark seçtiyse — her iki yönde de kazanır */
:root[data-theme="dark"] {
  --bg-base:        var(--violet-950);
  --bg-surface:     var(--violet-900);
  --bg-elevated:    var(--violet-800);
  --bg-subtle:      var(--violet-800);
  --bg-inverse:     var(--gray-0);

  --fg-primary:     var(--gray-50);
  --fg-secondary:   var(--gray-300);
  --fg-muted:       var(--gray-500);
  --fg-inverse:     var(--gray-900);
  --fg-link:        var(--violet-300);

  --border-subtle:  var(--violet-700);
  --border-strong:  var(--violet-600);
  --border-accent:  var(--neon-400);

  --accent:         var(--neon-500);
  --accent-fg:      var(--violet-950);  /* koyu metin, parlak zemin  → 4.92:1 */
  --primary:        var(--violet-400);
  --primary-fg:     var(--gray-50);     /* AÇIK metin — koyu metin 3.10:1'de kalıyordu */
  --reward:         var(--amber-400);

  --focus-ring:     var(--neon-300);
}
```

**Varsayılan tema: dark.** Gerekçe: web3 kitlesi dark bekliyor, rozet görselleri
koyu zeminde daha iyi duruyor. Ama sistem tercihi her zaman saygı görür ve
header'da manuel geçiş bulunur.

### 2.3 Kontrast kuralı

Her metin/zemin çifti **WCAG AA** karşılamalı: normal metin ≥ 4.5:1, büyük metin
(≥18.66px bold veya ≥24px) ≥ 3:1. Yeni bir renk kombinasyonu eklenmeden önce
kontrast kontrol edilir.

⚠️ **Bilinen tuzak:** `--neon-500` (#A855F7) beyaz zeminde ~3.1:1 — normal boyutlu
**metin olarak kullanılamaz.** Light temada accent metin için `--neon-700`
(#7B2CBF, ~7.5:1) kullan. Açık menekşe tonlarını light temada yalnızca
zemin/kenarlık olarak, üstünde koyu metinle kullan.

⚠️ **İkinci tuzak — Tailwind belirsizliği:** `text-[var(--x)]` yazma.
Tailwind'de `text-*` hem yazı boyutu hem renk olabildiği için CSS değişkeni
verildiğinde **yazı boyutu** sanılır ve renk hiç uygulanmaz; metin gövde
rengini miras alır (koyu temada siyah, açık temada beyaz → görünmez).
Doğrusu: `text-[color:var(--x)]`. Aynısı `border-*` ve `bg-*` için de geçerli.

### Doğrulanmış kontrast oranları

Palet, logodan türetildikten sonra 12 kritik kombinasyon için ölçüldü —
hepsi WCAG AA (≥4.5:1) geçiyor:

| Kombinasyon | Oran |
|---|---|
| Light · ana metin | 17.22:1 |
| Light · ikincil metin | 7.43:1 |
| Light · accent metin | 7.71:1 |
| Light · accent buton | 5.80:1 |
| Light · primary buton | 9.41:1 |
| Light · ödül (amber) | 5.05:1 |
| Dark · ana metin | 19.16:1 |
| Dark · ikincil metin | 11.55:1 |
| Dark · accent metin | 6.99:1 |
| Dark · accent buton | 4.92:1 |
| Dark · primary buton | 6.18:1 |
| Dark · ödül (amber) | 11.24:1 |

İlk ölçümde iki kombinasyon düşük çıktı ve düzeltildi:
`--amber-600` koyulaştırıldı (3.15 → 5.05), dark temadaki primary butonun
metni koyudan açığa çevrildi (3.10 → 6.18).

---

## 3. Tipografi

### 3.1 Font aileleri

| Rol | Font | Fallback |
|---|---|---|
| Başlık | **Plus Jakarta Sans** (600, 700, 800) | `ui-sans-serif, system-ui` |
| Gövde | **Inter** (400, 500, 600) | `ui-sans-serif, system-ui` |
| Mono | **JetBrains Mono** (400, 500) | `ui-monospace, SFMono-Regular, monospace` |

Üçü de Google Fonts'ta ücretsiz ve Latin Extended kapsıyor.

**Mono kullanımı zorunlu olduğu yerler:** cüzdan adresleri, tx hash'leri, merkle
root'lar, contract adresleri, kod blokları. Bunlar asla proportional fontla
yazılmaz — karakter hizası okunabilirliğin kendisi.

> ⚠️ **Kurulum kontrolü:** Font'ları `next/font/google` ile yüklerken
> `subsets: ['latin', 'latin-ext']` **zorunlu**. `latin-ext` olmadan `ğ ş İ ı ç ö ü`
> düşer. Kurulumdan sonra şu dizeyi bir sayfada gözle doğrula:
> **`ĞÜŞİÖÇ ğüşıöç — Piri Reis Üniversitesi Blockchain Kulübü`**
>
> Space Grotesk / Outfit gibi geometrik fontlar **önerilmiyor** — Türkçe glif
> kapsamları eksik veya `ı`/`İ` çizimleri zayıf.

### 3.2 Ölçek

| Token | Boyut | Satır | Harf aralığı | Ağırlık | Kullanım |
|---|---|---|---|---|---|
| `display` | 3.75rem / 60px | 1.05 | -0.03em | 800 | Landing hero |
| `h1` | 3rem / 48px | 1.1 | -0.02em | 700 | Sayfa başlığı |
| `h2` | 2.25rem / 36px | 1.15 | -0.015em | 700 | Bölüm |
| `h3` | 1.75rem / 28px | 1.25 | -0.01em | 600 | Alt bölüm |
| `h4` | 1.375rem / 22px | 1.35 | 0 | 600 | Kart başlığı |
| `body-lg` | 1.125rem / 18px | 1.7 | 0 | 400 | Giriş paragrafı |
| `body` | 1rem / 16px | 1.65 | 0 | 400 | Varsayılan |
| `body-sm` | 0.875rem / 14px | 1.6 | 0 | 400 | Meta, yardım metni |
| `caption` | 0.75rem / 12px | 1.5 | 0.03em | 600 | Etiket (BÜYÜK HARF) |
| `mono` | 0.875rem / 14px | 1.5 | 0 | 500 | Adres, hash |

**Mobilde** `display` → 2.5rem, `h1` → 2rem, `h2` → 1.625rem. `clamp()` ile akıcı
ölçekleme tercih edilir.

### 3.3 Metin kuralları

- Okuma satırı **maksimum 72 karakter** (`max-width: 65ch`). Hafta içeriği bu
  genişlikte akar.
- Paragraf arası `--space-4` (16px). `<br><br>` kullanılmaz.
- Türkçe tırnak: `"…"` (U+201C/U+201D). Düz `"` kullanılmaz.
- Sayılar ve tarihler `tr-TR` locale'ine göre biçimlenir: `17 Ağustos 2026`.

---

## 4. Boşluk sistemi

4px tabanlı ölçek. **Ara değer kullanılmaz** — 14px, 22px gibi sayılar koda girmez.

| Token | px | Kullanım |
|---|---|---|
| `--space-1` | 4 | İkon-metin arası |
| `--space-2` | 8 | Sıkı gruplama |
| `--space-3` | 12 | Buton iç boşluğu (dikey) |
| `--space-4` | 16 | Varsayılan aralık, kart iç boşluğu (mobil) |
| `--space-6` | 24 | Kart iç boşluğu (masaüstü), grid boşluğu |
| `--space-8` | 32 | Bileşen grupları arası |
| `--space-12` | 48 | Bölüm içi ayrım |
| `--space-16` | 64 | Bölümler arası (mobil) |
| `--space-24` | 96 | Bölümler arası (masaüstü) |
| `--space-32` | 128 | Hero üst/alt |

---

## 5. Yuvarlaklık, gölge, kenarlık

**Köşe yarıçapı**

| Token | px | Kullanım |
|---|---|---|
| `--radius-sm` | 6 | Etiket, küçük rozet |
| `--radius-md` | 10 | Buton, input |
| `--radius-lg` | 16 | Kart, panel |
| `--radius-xl` | 24 | Modal, hero kutusu |
| `--radius-full` | 9999 | Avatar, sayaç, pill |

**Gölge** — mavi tonlu, düşük yoğunluklu. Dark temada gölge yerine **kenarlık +
zemin farkı** kullanılır (koyu zeminde gölge görünmez).

```css
--shadow-sm: 0 1px 2px rgba(10, 23, 41, .06);
--shadow-md: 0 4px 12px rgba(10, 23, 41, .08);
--shadow-lg: 0 12px 32px rgba(10, 23, 41, .12);
--shadow-glow: 0 0 0 3px rgba(18, 191, 174, .25);  /* focus + kazanılmış rozet */
```

**Kenarlık:** varsayılan `1px solid var(--border-subtle)`. Vurgulu durumlar için
kalınlık artırılmaz, **renk değişir** (`--border-accent`) — layout kayması olmasın.

---

## 6. Layout

| Kural | Değer |
|---|---|
| Sayfa max genişlik | `1200px` |
| Okuma (prose) max genişlik | `720px` |
| Yatay kenar boşluğu | mobil `--space-4`, ≥768px `--space-8` |
| Grid | 12 kolon, gutter `--space-6` |
| Sticky header yüksekliği | `64px` |

**Kırılma noktaları**

| Ad | px | Not |
|---|---|---|
| `sm` | 480 | Büyük telefon |
| `md` | 768 | Tablet — hafta kartları 2 kolona geçer |
| `lg` | 1024 | Masaüstü — 3 kolon, yan menü açılır |
| `xl` | 1280 | Geniş |

**Mobil öncelikli.** Tüm CSS `min-width` ile yazılır. Öğrencilerin çoğu siteye
telefondan girecek — ve cüzdan bağlantısı mobilde en kırılgan akış. Mobil, "sonra
düzeltiriz" değil, birincil hedef.

---

## 7. Component stilleri

### 7.1 Butonlar

Yükseklik: `md` = 40px, `lg` = 48px, `sm` = 32px. Yatay iç boşluk `--space-4`.
Yarıçap `--radius-md`. Font `body`, ağırlık 600.

| Varyant | Zemin | Metin | Kenarlık | Kullanım |
|---|---|---|---|---|
| `primary` | `--primary` | `--primary-fg` | yok | Sayfada **tek** ana eylem |
| `accent` | `--accent` | `--accent-fg` | yok | Rozeti Al, Cüzdanı Bağla |
| `secondary` | `--bg-surface` | `--fg-primary` | `--border-strong` | İkincil eylem |
| `ghost` | şeffaf | `--fg-secondary` | yok | Üçüncül, tablo içi |
| `danger` | hata rengi | beyaz | yok | Reddet, Burn, Pause |

**Durumlar:**
- `hover` → zemin bir ton koyulaşır, `transform: translateY(-1px)`
- `active` → `translateY(0)`, gölge kalkar
- `focus-visible` → `--shadow-glow` halka (asla `outline: none` bırakılmaz)
- `disabled` → `opacity: .45`, `cursor: not-allowed`
- `loading` → metin yerinde kalır, sola dönen spinner girer, buton **genişliği
  sabit kalır** (layout zıplaması olmaz)

### 7.2 Kartlar

```
Zemin: --bg-surface
Kenarlık: 1px solid --border-subtle
Yarıçap: --radius-lg
İç boşluk: --space-4 (mobil) / --space-6 (masaüstü)
Gölge: --shadow-sm  |  hover: --shadow-md
```

### 7.3 Hafta kartı — üç durum

Müfredat listesindeki her hafta bu üç görünümden birinde:

**① `public` — herkese açık örnek hafta**
```
┌─────────────────────────────────────┐
│  [HAFTA 2]        🌐 Herkese Açık   │  ← turkuaz pill etiket
│  Solidity Temelleri                 │
│  Değişkenler, fonksiyonlar ve …     │  ← Özet
│                                     │
│  Haftayı Görüntüle →                │  ← ghost buton
└─────────────────────────────────────┘
Kenarlık: --border-accent
```

**② `locked` — cüzdan bağlı değil / rozet yok**
Bkz. §8 (ayrı bölüm)

**③ `unlocked` — erişim var**
```
┌─────────────────────────────────────┐
│  [HAFTA 3]              ✓ Rozet     │  ← amber rozet ikonu (varsa)
│  Merkle Ağaçları                    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░  görev 4/6         │
│                                     │
│  Devam Et →                         │
└─────────────────────────────────────┘
```

### 7.4 İlerleme göstergesi

Hafta sayısı kadar kutucuk, yatay dizili. **Sayı asla koda gömülmez** — kamp
verisinden gelir.

```
■ ■ ■ □ □ □ □ □ □ □ □ □ □ □ □      3 / 15
└─ dolu: --accent      └─ boş: --bg-subtle + --border-subtle
```

- Kutucuk: 12×12px, `--radius-sm`, aralık `--space-1`
- 20'den fazla hafta olursa kutucuklar küçülür (8px) — sarmalanmaz
- Her kutucuk `title="Hafta N"` ve ekran okuyucu için gizli metin taşır
- Yanında her zaman sayısal karşılık: `3 / 15`

### 7.5 Adres gösterimi

Her zaman mono font + kısaltma + kopyala butonu:

```
0x1a2b…9f8e  ⧉
```
- Kısaltma: ilk 6 + son 4 karakter
- Nick varsa **nick öndedir**, adres altında `body-sm` + `--fg-muted`
- Tıklanınca BaseScan'e açılır (`target="_blank" rel="noopener"`)
- Kopyalandığında buton 2 saniye ✓ olur

### 7.6 Leaderboard tablosu

| # | Katılımcı | Kamp | İlerleme |
|---|---|---|---|
| 1 | **bugra** `0x1a2b…9f8e` | Developers | ■■■■■■■□□□□□□□□ 7/15 |

- İlk 3 satır `--reward` renkli sıra numarası
- Zebra çizgi **yok** — bunun yerine satır arası `--border-subtle`
- Mobilde tablo kart listesine dönüşür (yatay kaydırma **yok**)
- Sıralama: tamamlanan hafta sayısı ↓, eşitlikte son mint zamanı ↑

### 7.7 İşlem (transaction) durumu

Her zincir işlemi **dört durumdan** geçer. Hiçbiri atlanmaz:

| Durum | Görünüm |
|---|---|
| `idle` | Normal buton |
| `awaiting-signature` | "Cüzdanında onayla…" + spinner + cüzdan ikonu |
| `pending` | "Zincirde bekliyor…" + tx hash + **BaseScan linki** |
| `success` | Yeşil toast + rozet animasyonu + otomatik veri yenileme |
| `error` | Kırmızı kart + **Türkçe insan dili** hata + "Tekrar Dene" |

**Hata mesajı örnekleri** (teknik metin asla kullanıcıya gösterilmez):

| Teknik | Kullanıcıya gösterilen |
|---|---|
| `insufficient funds for gas` | "Cüzdanında işlem ücreti için yeterli ETH yok. Kulüpten ETH talep et." |
| `user rejected the request` | "İşlemi iptal ettin. Hazır olduğunda tekrar deneyebilirsin." |
| `execution reverted: AlreadyClaimed` | "Bu haftanın rozetini zaten almışsın." |
| `execution reverted: InvalidProof` | "Bu hafta için henüz onaylanmamışsın. Başvurun incelemede olabilir." |
| `chain mismatch` | "Yanlış ağdasın." + **[Base Sepolia'ya Geç]** butonu |

### 7.8 Toast

Sağ üst (masaüstü) / alt (mobil). Genişlik max 380px. Süre 5sn, hata için 8sn.
Sol kenarda 3px semantik renk şeridi. `role="status"` / hata için `role="alert"`.

---

## 8. Kilitli içerik ekranı — tasarım ve güvenlik

**Bu bölüm hem tasarım hem güvenlik şartıdır. Uygulaması pazarlığa kapalıdır.**

### 8.1 Temel kural

> **Kilitli karta gerçek içeriğin hiçbir baytı gönderilmez.**

Blur burada bir *estetik*, bir *koruma* değil. CSS `filter: blur()` uygulanmış
metin `Ctrl+U` veya DevTools ile bir saniyede okunur — o yüzden bulanıklaştırılacak
gerçek metin diye bir şey yok.

Kilitli kart üç şeyden oluşur, hepsi zaten public:
1. **Hafta numarası + başlık** — müfredat özetinde zaten görünüyor
2. **Özet (teaser)** — Notion'daki ayrı `Özet` alanı; gerçek içeriğin kesilmiş
   hâli **değil**, kasıtlı yazılmış vitrin metni
3. **İskelet çubukları** — anlamsız gri dikdörtgenler, hiçbir veri taşımıyor

### 8.2 Görünüm

```
┌───────────────────────────────────────────┐
│  [HAFTA 5]                          🔒    │
│  Akıllı Kontrat Güvenliği                 │  ← gerçek başlık, net
│                                           │
│  Reentrancy, erişim kontrolü ve yaygın    │  ← Özet, net, 2-3 satır
│  açıkların üzerinden geçiyoruz.           │
│                                           │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬        │  ← iskelet (aria-hidden)
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬                    │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬               │
│  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬                            │  ← alta doğru fade
│                                           │
│         🔒  Kamp katılımcılarına özel      │
│                                           │
│      ┌──────────────────────┐             │
│      │   Cüzdanını Bağla    │             │  ← accent buton
│      └──────────────────────┘             │
│      Örnek haftayı incele →               │  ← ghost link
└───────────────────────────────────────────┘
```

### 8.3 Uygulama detayı

**İskelet çubukları:**
- Yükseklik 12px, `--radius-sm`, zemin `--bg-subtle`
- Genişlikler değişken (%100, %72, %88, %45) — doğal metin ritmi hissi
- Satır arası `--space-3`
- Hafif nabız animasyonu: `opacity .5 → .8`, 2sn, `ease-in-out`, sonsuz
- **`aria-hidden="true"`** — ekran okuyucu bunları okumaz
- `prefers-reduced-motion` altında animasyon durur

**Fade katmanı:** İskeletin alt %40'ında
`linear-gradient(transparent → var(--bg-surface))` — "okuma burada kesildi" hissi.

**Kilit paneli:** Fade'in üstünde, ortalanmış. Zemin
`var(--bg-surface)` %90 opaklık + `backdrop-filter: blur(2px)`. Bu blur *iskeletin*
üstünde — arkada gizli veri yok, tamamen dekoratif.

**Erişilebilirlik:**
- Kilit mesajı gerçek metin (`<p>`), görsel değil
- CTA gerçek `<button>` / `<a>` — klavyeyle erişilebilir
- Kartın kendisi `aria-label="Hafta 5 — kilitli"`
- İskeletler `aria-hidden`, ekran okuyucu doğrudan kilit mesajına gider

**Sayfa meta:** Kilitli hafta sayfaları `robots: noindex, nofollow` +
`X-Robots-Tag` header'ı. Public hafta ve landing tam tersine indekslenir.

### 8.4 İki kilit sebebi, iki farklı mesaj

| Durum | Mesaj | CTA |
|---|---|---|
| Cüzdan bağlı değil | "Bu haftanın içeriği kamp katılımcılarına özel." | **Cüzdanını Bağla** |
| Bağlı ama nick yok | "Son bir adım: kendine bir nick seç." | **Nick Belirle** |

---

## 9. UI/UX prensipleri

1. **Cüzdan hiçbir zaman kapıda zorlanmaz.** Landing, müfredat özeti, örnek hafta
   ve leaderboard cüzdansız tam gezilir. Bağlantı isteği ancak kullanıcı kilitli
   bir şeye uzandığında çıkar.

2. **Her zincir işlemi dört durumdan geçer** (§7.7). "Butona bastım, ne oldu?"
   anı asla yaşanmaz. `pending` durumunda tx hash ve BaseScan linki **her zaman**
   görünür.

3. **Hata mesajları Türkçe ve insan dilinde.** Ham revert string'i kullanıcıya
   gösterilmez; teknik detay katlanabilir "Detaylar" bölümünde durur.

4. **Yanlış ağ engel değil, tek tık.** Ağ uyuşmazlığında sayfa kilitlenmez —
   üstte bir şerit ve **[Base Sepolia'ya Geç]** butonu çıkar.

5. **Kimlik nick'tir, adres ikincildir.** Leaderboard, profil, her yer önce nick
   gösterir. Adres altta, mono, kısaltılmış.

6. **İlerleme her zaman görsel.** "3. haftadasın" yazmak yetmez — 15 kutucuktan
   3'ü dolu görünür (§7.4).

7. **Jargon anlam taşımadıkça kullanılmaz.** "Mint et" yerine **"Rozeti Al"**.
   "Merkle proof" kullanıcıya hiç gösterilmez. "Soulbound" yerine
   **"Devredilemez"**. Ama "cüzdan", "gas", "tx" öğretilir — bu bir blockchain
   kulübü, kullanıcı bunları öğrenmeye gelmiş.

8. **Boş durumlar öğretir.** "Henüz rozetin yok" değil → "Henüz rozetin yok.
   Kaçıncı haftada olduğunu bildir, onaylandığında rozetlerin hazır olacak."
   + eylem butonu.

9. **Dark mode birinci sınıf**, varsayılan. Ama sistem tercihi saygı görür ve
   header'da manuel geçiş var.

10. **Mobil öncelikli** (§6).

11. **Yükleme durumu = iskelet, spinner değil.** Sayfa iskeleti gerçek layout'un
    şeklini taşır — içerik gelince zıplama olmaz.

12. **Yıkıcı eylem her zaman onay ister.** Admin panelinde burn, pause, root
    değiştirme → modal + eylemin adını yazma (`BURN` yaz onayı).

---

## 10. Hareket (motion)

| Etkileşim | Süre | Easing |
|---|---|---|
| Buton/link hover | 150ms | `ease-out` |
| Kart hover | 200ms | `ease-out` |
| Panel/modal açılış | 250ms | `cubic-bezier(.16,1,.3,1)` |
| Toast giriş | 300ms | `cubic-bezier(.16,1,.3,1)` |
| Rozet kazanma | 600ms | ölçek + parıltı, bir kez |
| İskelet nabız | 2000ms | `ease-in-out`, sonsuz |

**`prefers-reduced-motion: reduce` altında** tüm süreler `0.01ms`'ye iner, nabız
ve rozet animasyonu tamamen kapanır. Bu bir seçenek değil, uygulama şartı.

---

## 11. İkonografi

- Kütüphane: **Lucide** (tutarlı, ücretsiz, tree-shakeable)
- Çizgi kalınlığı `1.75`, boyut 16 / 20 / 24px
- İkon **tek başına anlam taşımaz** — her zaman metin etiketi veya
  `aria-label` eşlik eder
- Sabit ikon eşlemesi: kilit `Lock` · rozet `Award` · cüzdan `Wallet` ·
  doğrulandı `BadgeCheck` · harici link `ExternalLink` · kopyala `Copy`

---

## 12. Doğrulanması gerekenler

Bu doküman v1 taslağı. Aşağıdakiler onaylandığında v2'ye geçilecek:

- [x] **Kulüp logosu alındı** (18 Ağustos 2026) ve palet ona göre yeniden
      türetildi. Üniversitenin ayrı bir kurumsal marka kılavuzu varsa yine de
      kontrol edilmeli.
- [ ] **Logonun SVG hâli** — şu an PNG var (`web/public/logo.png`). SVG,
      her ölçekte net kalır ve dosya boyutu çok daha küçüktür.
- [ ] **Font onayı** — Plus Jakarta Sans + Inter kombinasyonu. Üniversitenin
      zorunlu bir kurumsal fontu varsa değişir.
- [ ] **Varsayılan tema dark olsun mu?**
- [ ] Türkçe glif testi: `ĞÜŞİÖÇ ğüşıöç` (§3.1)
