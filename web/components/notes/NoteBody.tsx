/**
 * ============================================================================
 * NOT METNİNİ EKRANA BASMA — güvenli yol
 *
 * ⚠️ Not defteri, sitedeki TEK kullanıcı üretimi içerik alanı. Hafta içeriği
 * Notion'dan gelir ve denetimli bir dönüştürücüden geçer; buradaki metni ise
 * doğrudan bir katılımcı yazdı.
 *
 * BU DOSYADA `dangerouslySetInnerHTML` YOK VE OLMAYACAK.
 *
 * Metin React metin düğümü olarak basılır; React her şeyi kendiliğinden
 * kaçış karakterine çevirir. Kullanıcı `<script>alert(1)</script>` yazarsa
 * ekranda o harfler görünür, tarayıcı bunu etiket olarak yorumlamaz.
 *
 * Bağlantılar da HTML olarak ayrıştırılmaz: metin bir düzenli ifadeyle
 * parçalara bölünür ve URL parçaları için React `<a>` ÖĞESİ üretilir. Yani
 * "HTML metni" hiçbir aşamada oluşmaz.
 *
 * Protokol beyaz listesi (`safeUrl`) burada İKİNCİ KEZ uygulanıyor —
 * ilki kayıt anında, sunucuda. Tek kontrol yeterdi; iki tanesi, birinde
 * yapılacak bir hatanın tek başına açık yaratmaması için.
 * ============================================================================
 */
import {safeUrl} from "@/lib/notes/rules";

/**
 * Metin içindeki URL'leri yakalar.
 *
 * Bilerek dar tutuldu: yalnızca `http://` veya `https://` ile BAŞLAYAN
 * diziler. "www.falan.com" gibi protokolsüz yazımları yakalamıyoruz, çünkü
 * onlara bir protokol uydurmak gerekirdi ve tahmin etmek istemiyoruz.
 * Yakalanmayan bağlantı düz metin olarak görünür — güvenli taraf.
 */
const URL_PATTERN = /(https?:\/\/[^\s<>"')\]]+)/g;

export function NoteBody({text}: {text: string}) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-secondary">
      {linkify(text)}
    </div>
  );
}

/**
 * Düz metni React parçalarına böler; URL'leri `<a>` öğesine çevirir.
 *
 * Dönen değer bir dizi React düğümüdür — HTML dizesi DEĞİL. Bu ayrım
 * bu dosyanın tamamının dayandığı nokta.
 */
function linkify(text: string): React.ReactNode[] {
  const parts = text.split(URL_PATTERN);

  return parts.map((part, index) => {
    /* Tek indeksler yakalanan URL'ler (split, yakalama grubunu araya koyar) */
    if (index % 2 === 1) {
      const href = safeUrl(part);

      /* Protokol beyaz listesini geçemeyen "URL" düz metin olarak basılır */
      if (!href) return <span key={index}>{part}</span>;

      return (
        <a
          key={index}
          href={href}
          target="_blank"
          /*
           * noopener  → açılan sayfa `window.opener` ile bu sekmeyi yönlendiremesin
           * noreferrer→ nereden geldiğimizi sızdırmayalım
           * nofollow  → kullanıcı bağlantısı, sitemizin oyu değil (SEO spam kalkanı)
           */
          rel="noopener noreferrer nofollow"
          className="break-all text-accent-text underline underline-offset-2"
        >
          {part}
        </a>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
