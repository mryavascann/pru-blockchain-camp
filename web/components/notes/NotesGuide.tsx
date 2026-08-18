/**
 * ============================================================================
 * NOT DEFTERİ YÖNERGESİ — "ne yazacağım?" sorusunun cevabı
 *
 * BU BİLEŞEN NEDEN VAR:
 * Kulübün Notion'daki ortak not sayfası boş kaldı. Sebeplerinden biri
 * doğrudan buydu — katkı verecek kişi boş bir sayfa görüyor, ne tür bir
 * şeyin beklendiğini bilmiyordu. "Not ekle" demek yetmiyor; NE TÜR bir not
 * beklendiğini somut örnekle göstermek gerekiyor.
 *
 * İki yüzü var:
 *   variant="read"  → not defterini OKUYAN kişiye: bu sayfa ne işine yarar
 *   variant="write" → not YAZAN kişiye: iyi not nasıl olur, ne beklenmiyor
 *
 * ---------------------------------------------------------------------------
 * YAZMA REHBERİ ARTIK VARSAYILAN AÇIK DEĞİL
 *
 * Önceden bu kart formun hemen altında sürekli duruyordu ve içinde dört türü
 * yeniden anlatıyordu — tür seçici, bu kart ve sağdaki okuma kartı aynı
 * bilgiyi üç kez gösteriyordu. Şimdi form içinde bir bağlantının arkasında
 * ("İyi not nasıl olur?") ve yalnızca kişinin İLK notunda kendiliğinden açık
 * geliyor. Silinen bir şey yok; tekrar eden kopyalar kalktı.
 *
 * `kind` verilirse o türün uzun yönergesi en üstte gösterilir — form içinde
 * artık tek cümle duruyor, ayrıntı burada.
 * ---------------------------------------------------------------------------
 */
import {Card} from "@/components/ui/Card";
import {NOTE_KIND_INFO, NOTE_KIND_LIST, type NoteKind} from "@/lib/notes/rules";
import {KIND_TEXT, NoteKindIcon, SparkleIcon} from "./kindVisuals";

export function NotesGuide({
  variant,
  kind,
}: {
  variant: "read" | "write";
  /** Yalnızca variant="write" için — o an seçili tür */
  kind?: NoteKind;
}) {
  return variant === "read" ? <ReadingGuide /> : <WritingGuide kind={kind} />;
}

/* -------------------------------------------------------------------------- */
/*                                  OKUMA                                     */
/* -------------------------------------------------------------------------- */

function ReadingGuide() {
  return (
    <Card>
      <h2 className="text-xl font-bold tracking-tight">
        Bu defter tam olarak ne?
      </h2>

      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-fg-secondary">
        <p>
          Burada gördüğün her not, bu kampı senden önce ya da seninle birlikte
          yürüyen bir katılımcı tarafından yazıldı. Kimse ödev olsun diye
          yazmadı: <strong className="text-fg">herkes kendi takıldığı yeri
          yazdı</strong>. Bir terimin anlamını sorup öğrenen kişi öğrendiğini
          buraya bıraktı, saatlerce uğraşıp bir hatayı çözen kişi çözümünü
          buraya bıraktı.
        </p>

        <p>
          Amaç basit: <strong className="text-fg">aynı duvara iki kişi
          çarpmasın.</strong> Sen bir yerde tıkandığında, büyük ihtimalle
          senden önce biri aynı yerde tıkanmış ve nasıl çıktığını yazmış.
        </p>

        <div className="rounded-lg border border-line-accent bg-subtle p-4">
          <p className="font-semibold text-fg">Nasıl kullanılır</p>
          <p className="mt-1.5">
            Haftanın dersini çalışırken bu sayfayı{" "}
            <strong className="text-fg">yan sekmede açık tut</strong>. Bir yere
            takıldığında önce buraya bak — cevabı bulursan zaman kazanırsın,
            bulamazsan çözdüğünde <em>sen</em> yazarsın. Defter böyle büyüyor.
          </p>
        </div>

        <div className="rounded-lg border border-warning bg-subtle p-4">
          <p className="inline-flex items-center gap-1.5 font-semibold text-warning">
            <SparkleIcon className="h-4 w-4" />
            işaretli notlara dikkat
          </p>
          <p className="mt-1.5">
            Bu işaret, açıklamanın bir yapay zekâya sorularak alındığını
            gösterir. Böyle notlar çok faydalı — ama{" "}
            <strong className="text-fg">yapay zekâ yanılabilir</strong>. Kritik
            bir şeyde emin olman gerekiyorsa hocaya ya da resmî dokümana
            doğrulat. Bu yüzden ayrı bir işaret koyuyoruz: bir insanın
            deneyimiyle bir modelin açıklaması aynı şey değil.
          </p>
        </div>

        <p className="text-fg-muted">
          İleri haftaların notlarını göremezsin; sen o haftaya geldiğinde
          açılırlar. Sebebi ikili: hem sürprizi bozmamak, hem de not defterinin
          &ldquo;dersi atlayıp cevapları okuma&rdquo; aracına dönüşmemesi.
        </p>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  YAZMA                                     */
/* -------------------------------------------------------------------------- */

function WritingGuide({kind}: {kind?: NoteKind}) {
  const selected = kind ? NOTE_KIND_INFO[kind] : null;

  return (
    <Card>
      <h2 className="text-xl font-bold tracking-tight">
        Nasıl bir not bekliyoruz?
      </h2>

      <div className="mt-3 flex flex-col gap-4 text-sm leading-relaxed text-fg-secondary">
        {/* Seçili türün uzun yönergesi — formda yalnızca özeti duruyor */}
        {selected && (
          <div className="rounded-lg border border-line-accent bg-subtle p-4">
            <p className="inline-flex items-center gap-1.5 font-semibold text-fg">
              <NoteKindIcon
                kind={selected.value}
                className={`h-4 w-4 ${KIND_TEXT[selected.value]}`}
              />
              {selected.label}
            </p>
            <p className="mt-1.5">{selected.guidance}</p>
          </div>
        )}

        <p>
          Tek bir soruyla özetlenebilir:{" "}
          <strong className="text-fg">
            &ldquo;Bu haftaya yeniden başlasaydım, hangi bilgi bana zaman
            kazandırırdı?&rdquo;
          </strong>{" "}
          Cevabın ne ise, onu yaz.
        </p>

        <div className="rounded-lg border border-line-accent bg-subtle p-4">
          <p className="font-semibold text-fg">En sık karşılaşılan durum</p>
          <p className="mt-1.5">
            Ders sırasında bilmediğin bir kelime geçti. Yapay zekâya sordun,
            güzel bir açıklama aldın, anladın ve devam ettin.{" "}
            <strong className="text-fg">
              İşte tam o açıklamayı buraya yapıştır.
            </strong>{" "}
            Senin 3 dakikanı almış bir soru, senden sonra gelen on kişinin
            30 dakikasını kurtarır — ve onlar aramak zorunda bile kalmaz,
            dersi çalışırken defteri yan tarafta açık tutup takip ederler.
          </p>
          <p className="mt-2">
            Böyle bir notta{" "}
            <strong className="text-fg">
              &ldquo;yapay zekâya sordum&rdquo; kutucuğunu işaretle
            </strong>
            . Notun değerini düşürmez; okuyan kişinin doğru gözle bakmasını
            sağlar.
          </p>
        </div>

        {/* ---- Dört tür ---- */}
        <div>
          <p className="font-semibold text-fg">Dört tür not var</p>
          <ul className="mt-2 flex flex-col gap-2">
            {NOTE_KIND_LIST.map((item) => (
              <li
                key={item.value}
                className={[
                  "flex gap-2.5 rounded-md border p-3",
                  item.value === kind ? "border-line-accent bg-subtle" : "border-line",
                ].join(" ")}
              >
                <NoteKindIcon
                  kind={item.value}
                  className={`mt-0.5 h-4 w-4 ${KIND_TEXT[item.value]}`}
                />
                <span>
                  <strong className="text-fg">{item.label}</strong> —{" "}
                  {item.summary}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- İyi / kötü ---- */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-success p-4">
            <p className="font-semibold text-success">✓ İşe yarar</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li>Ne anlamadığını ve sonunda ne anladığını yazan not</li>
              <li>Hata mesajını ve çözümünü birlikte veren not</li>
              <li>
                Bir kaynağın <em>hangi kısmının</em> işe yaradığını söyleyen not
              </li>
              <li>Kendi cümlelerinle yazılmış, kısa ama net bir açıklama</li>
            </ul>
          </div>

          <div className="rounded-lg border border-danger p-4">
            <p className="font-semibold text-danger">✗ İşe yaramaz</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li>&ldquo;Güzel haftaydı, çok şey öğrendim&rdquo;</li>
              <li>Slaytlardan olduğu gibi kopyalanmış metin</li>
              <li>Açıklamasız yapıştırılmış bağlantı</li>
              <li>Sırf zorunlu diye doldurulmuş anlamsız satırlar</li>
            </ul>
          </div>
        </div>

        <div className="rounded-lg border border-line-strong bg-subtle p-4">
          <p className="font-semibold text-fg">Neden zorunlu?</p>
          <p className="mt-1.5">
            Kulüpte bu defterin bir öncekini Notion&apos;da açtık ve{" "}
            <strong className="text-fg">kimse tek satır yazmadı</strong> —
            herkes iyi bir fikir olduğunu söyledi, kimsenin sırası gelmedi.
            Zorunlu olmasının tek sebebi bu. Haftanın rozetini alırken bir not
            bırakıyorsun, o not bir sonraki haftayı da açıyor. Kimseden
            kompozisyon beklenmiyor; birkaç dürüst cümle yeterli.
          </p>
        </div>
      </div>
    </Card>
  );
}
