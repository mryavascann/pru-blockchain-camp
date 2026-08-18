# Eğitmen kamp platformu

Bu geliştirme `feature/hackathon-instructor-platform` dalında yaşar. `hackathon`
ve `main` dallarındaki uygulama kodu değiştirilmez.

## Kullanıcı akışı

1. Eğitmen cüzdanıyla `/egitmen` sayfasına girer ve kamp iskeletini oluşturur.
2. Kamp kapağını; her hafta için başlık, özet, içerik, kaynak ve NFT art yükler.
3. Öğrenci başvurularını `/egitmen/kamplar/:id/ogrenciler` altında inceler ve
   haftalık tamamlamaları toplu işaretler.
4. Bütün haftalar hazır olunca kampı platform incelemesine gönderir.
5. Platform yöneticisi `/admin/egitmen-kamplari` ekranında kendi owner
   cüzdanıyla kampı kontratta oluşturur. İşlem onaylanınca zincir `campId`'si
   otomatik bulunur ve veritabanı kampına bağlanır.
6. Kamp `/kamplar/:slug` altında yayınlanır; haftalık Merkle/rozet akışı mevcut
   yönetim ekranlarından devam eder.

## Yetki sınırı

- `OWNER`: kamp ayarları, içerik ve öğrenciler.
- `EDITOR`: içerik ve öğrenciler.
- `REVIEWER`: yalnızca öğrenci inceleme/ilerleme işlemleri.
- Platform admini bütün kampları inceleyebilir.

Her mutasyon API route'unda `requireCampAccess` ile tekrar doğrulanır. Bir
eğitmenin başka kampın URL'sini tahmin etmesi veri erişimi sağlamaz.

## Zincir ve veritabanı kimlikleri

`Camp.id` artık veritabanı iç kimliğidir. `Camp.chainCampId`, yalnızca kontratta
kamp oluşturulduktan sonra dolar. Merkle yaprakları, tokenId, metadata ve bakiye
okumaları her zaman `chainCampId` kullanır. Eski Developers ve Directors
kamplarında migration mevcut `id` değerlerini `chainCampId` alanına taşır.

Kontrattaki `createCamp` ve `setMerkleRoot` fonksiyonları `onlyOwner` olarak
kalır. Eğitmene bütün kontratı etkileyebilecek geniş yetki verilmez; platform
admini zincir yayınını son kez doğrular.

## Görsel depolama

Hackathon sürümü PNG/JPEG/WebP/GIF dosyalarını, dosya imzasını doğruladıktan
sonra Postgres `bytea` alanında saklar. Dosya başına sınır 5 MB'dir. Bir görsel
yenisiyle değiştirildiğinde eski blob silinir. NFT metadata endpoint'i yüklenen
haftalık görseli doğrudan `/api/media/:id` üzerinden döndürür.

Üretim ölçeğinde `MediaAsset` kimlikleri ve ilişkileri korunup `data` alanı
S3/R2/IPFS nesne anahtarıyla değiştirilebilir.

## Herkese açık portfolyo

- Arama: `/portfolyo`
- Paylaşılabilir profil: `/profil/:nickname`

Nick zincirde `ownerOfNickname` ile adrese çözülür. Dışarı yalnızca maskeli
adres, kamp ilerlemesi, tamamlanan kamp sayısı, rozet ve topluluk notu sayısı
çıkar; üniversite/referral gibi katılımcı alanları portfolyoya gönderilmez.

## Geri alınabilir ana sayfa vitrini

Hackathon ana sayfa eklemesi `web/components/home/HackathonSpotlight.tsx`
bileşeninde izoledir. Beğenilmezse `web/app/page.tsx` içindeki tek import ve
`<HackathonSpotlight />` satırı kaldırılır. Görsel stiller de aynı klasördeki
`HackathonSpotlight.module.css` dosyasında izoledir.
