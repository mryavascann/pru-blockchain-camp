# PRU Blockchain Kulübü — Kamp Rozetleri

Piri Reis Üniversitesi Blockchain Kulübü'nün kamp programlarını web3'e taşıyan
uygulama. Katılımcılar tamamladıkları her hafta için **devredilemez (soulbound)**
bir NFT rozeti alır; rozetler Base ağında saklanır ve satılamaz, devredilemez.

| | |
|---|---|
| **Ağ** | Base Sepolia (testnet) → Base mainnet |
| **Kontrat** | [`0x298e083aF6B494DD504144dbc7C4edF01D7fB169`](https://base-sepolia.blockscout.com/address/0x298e083aF6B494DD504144dbc7C4edF01D7fB169) |
| **Kamplar** | PRU Blockchain Developers (15 hafta) · PRU Blockchain Directors (12 hafta) |

---

## Ne yapıyor

- **Haftalık rozetler** — Her (kamp, hafta) bir ERC-1155 tokenId. Devredilemez.
- **Geri doldurma** — Kampın ortasında katılan biri 1. haftadan itibaren tüm
  rozetlerini **tek işlemde** alır.
- **Notion'dan içerik** — Kamp içeriği Notion'da yazılır, siteye otomatik akar.
- **Kademeli erişim** — Landing ve müfredat herkese açık; bir örnek hafta
  vitrin olarak açık; diğer haftalar cüzdan doğrulamasıyla açılır.
- **Herkese açık sıralama** — Kimin kaçıncı haftada olduğu zincirden okunur.

---

## Mimari

```
Notion ──(webhook | cron | manuel)──► Postgres ──► Next.js ──► Tarayıcı
                                                      │
                                                      ▼
                                              Base (ERC-1155)
```

**Üç ilke, kodun her yerinde:**

1. **Kilitli içerik sunucudan hiç çıkmaz.** Blur bir estetik, koruma değil.
   Yetkisiz istekte ders içeriği veritabanı sorgusuna bile girmez
   ([`lib/content/access.ts`](web/lib/content/access.ts)).

2. **Backend'in private key'i yok.** Zincire yazma her zaman insanın
   cüzdanıyla. Sunucu ele geçirilse bile saldırgan kendine rozet yazdıramaz.

3. **Notion asla canlı kaynak değil.** Site her zaman Postgres'ten okur.
   Notion çökerse ziyaretçi hiçbir şey fark etmez; son başarılı içerik durur.

---

## Klasörler

```
contracts/   Foundry — kontratlar, 142 test, deploy script'leri
web/         Next.js — frontend + backend (API rotaları aynı projede)
docs/        brand.md · deploy.md · security-checklist.md
art/         Rozet görselleri (spesifikasyon: docs/brand.md §7)
```

---

## Kurulum

Ayrıntılı adımlar: [`docs/deploy.md`](docs/deploy.md)

```bash
# Kontratlar
cd contracts
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable
forge test

# Web
cd ../web
npm install
cp .env.example .env.local     # değerleri doldur
npx prisma generate
npx prisma db push
npm run db:seed                # kampları ZİNCİRDEN okur
npm run notion:sync            # içerikleri çeker (~75 sn)
npm run dev                    # http://localhost:3100
```

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu (port 3100) |
| `npm run build` | Üretim derlemesi |
| `npm run typecheck` | TypeScript denetimi |
| `npm run db:seed` | Kampları zincirden okuyup veritabanına yazar |
| `npm run notion:sync` | Notion içeriğini çeker |
| `npm run notion:probe` | Notion token'ının neye eriştiğini gösterir |
| `npm run sync:abi` | ABI'yi `forge build` çıktısından üretir |
| `npm run verify:merkle` | TypeScript ↔ Solidity merkle uyumunu **canlı kontrata** doğrular |
| `npm run e2e` | Backend akışı uçtan uca |
| `npm run e2e:full` | Zincirin ucuna kadar (gerçek işlem gönderir) |

Kontratlar:

```bash
forge test                                            # 142 test
forge coverage --no-match-coverage "(script|test)"    # satır %99.62, dal %100
slither . --filter-paths "lib/|test/|script/"
```

---

## Teknik kararlar

Gerekçeleriyle birlikte kodda ve `docs/` altında yazılı. Özet:

| Karar | Neden |
|---|---|
| **ERC-1155**, ERC-721 değil | Toplu basım yerleşik (geri doldurma tek işlem), tek URI şablonu, `balanceOfBatch` ile 15 haftalık ilerleme tek RPC çağrısında |
| **Tek kontrat**, kamp başına değil | Yeni kamp = tek işlem, deploy yok. Nick sistemi tek kaynak. |
| **UUPS proxy** | 4 aylık kampta bug çıkarsa immutable kontratta 40 kişiye "rozetleriniz geçersiz" demek gerekirdi |
| **Ownable2Step** | Yanlış adrese devir = kalıcı kilitlenme; iki adımlı devir bunu imkânsız kılar |
| **Nick'te Türkçe karakter yok** | `İ/i/I/ı` dönüşümü locale'e bağlı; zincirde deterministik yapılamaz ve taklit açığı doğurur |
| **Next.js**, ayrı backend değil | Kilitli içeriğin sunucudan çıkmaması Server Components ile *mimari olarak* garanti ediliyor |
| **wagmi + özel arayüz**, RainbowKit değil | `docs/brand.md`'ye birebir uyum ve WalletConnect anahtarı gerektirmemesi |

---

## Dürüstlük notu

Bu sistem **"trustless" değildir.** Kulüp yöneticisi kimin hangi haftayı
tamamladığını belirler, kontratı yükseltebilir ve son 7 gün içinde basılmış
bir rozeti yakabilir. Rozetlerin değeri PRU Blockchain Kulübü'nün kurumsal
itibarına dayanır.

Bu, bir kulüp sertifikası için makul bir modeldir — ama sitede
"merkeziyetsiz ve değiştirilemez" diye sunulmuyor. Tüm yönetim işlemleri
zincirde olay (event) olarak görülebilir.

Kabul edilen risklerin tam listesi:
[`docs/security-checklist.md`](docs/security-checklist.md) → Bölüm 2.

---

## Lisans

Henüz belirlenmedi. Kulüp kararı bekliyor.
