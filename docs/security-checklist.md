# Mainnet Öncesi Güvenlik Kontrol Listesi

> **Bu listeyi tamamlamadan Base mainnet'e deploy etme.**
>
> Testnet'te bir hata düzeltilebilir. Mainnet'te basılmış bir rozet kalıcıdır
> ve yanlış bir kök yazımı geri alınamaz.

**Durum:** Faz 4 — testnet tamamlandı, mainnet bekliyor.
**Son güncelleme:** 18 Ağustos 2026

---

## 🔴 BÖLÜM 0 — Acil: sohbette paylaşılan sırlar

Geliştirme sırasında iki sır sohbet geçmişine düz metin olarak girdi.
Testnet aşamasında pratik bir sorun değildi; **mainnet'e geçmeden önce
ikisi de yenilenmeli.**

- [ ] **Neon veritabanı parolası yenilendi**
      Neon konsolu → Project → Roles → `neondb_owner` → Reset password.
      Yeni bağlantı dizesi `web/.env.local` ve Vercel ortam değişkenlerine.

- [ ] **Notion integration token'ı yenilendi**
      notion.so/profile/integrations → `PRU Camp Site` → token'ı yeniden üret.
      Eski token anında geçersiz olur.

- [ ] **Test admin adresi listeden çıkarıldı**
      `ADMIN_ADDRESSES` içindeki `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
      Anvil'in herkesçe bilinen test hesabıdır. Üretimde **kesinlikle olmamalı** —
      private key'i internette açıkça duruyor.

- [ ] **Testnet deploy cüzdanı mainnet'te KULLANILMAYACAK**
      `0x133aa2E0709a4339FFFCb3ca1FAaBB5Fd26EC4aa` anahtarı bir AI oturumunda
      üretildi. Testnet için sorun yok, mainnet için kabul edilemez.

---

## BÖLÜM 1 — Cüzdan güvenliği

Kontratın sahibi olacak cüzdan, projenin en kritik varlığı. Bu anahtarı ele
geçiren kişi:

- Implementation'ı değiştirebilir (soulbound kısıtını kaldırıp rozetleri çalabilir)
- Sınırsız rozet basabilir
- Basımı süresiz durdurabilir

- [ ] **Mainnet sahip cüzdanı kendi makinende oluşturuldu**
      Hiçbir AI oturumundan, hiçbir paylaşılan ekrandan geçmedi.

- [ ] **Seed phrase kâğıda yazıldı**
      Ekran görüntüsü yok, Drive yok, WhatsApp yok, parola yöneticisinde
      "not" olarak yok.

- [ ] **Donanım cüzdanı değerlendirildi**
      Ledger/Trezor (~2.000-3.000 TL). Zorunlu değil ama upgrade yetkisi
      taşıyan bir anahtar için doğru yatırım.

- [ ] **Bu cüzdan başka hiçbir yerde kullanılmıyor**
      Airdrop toplamak, NFT mint etmek, rastgele sitelere bağlanmak yok.
      Tek amaçlı cüzdan.

- [ ] **Sahiplik devri prosedürü test edildi (testnet'te)**
      `transferOwnership` + `acceptOwnership`. Mezuniyet/devir durumunda
      kulübün kontratı kaybetmemesi için.

---

## BÖLÜM 2 — Kontratlar

- [x] **142 test geçiyor** — `forge test`
- [x] **Kapsam hedefleri tutuyor** — satır %99.62, dal %100, fonksiyon %100
- [x] **Slither çalıştırıldı** — 10 bulgu, hepsi değerlendirildi (Bölüm 6)
- [x] **Kontrat boyutu sınır altında** — 18.599 / 24.576 bayt
- [x] **Base Sepolia'da deploy ve doğrulandı**
- [x] **Uçtan uca zincir testi geçti** — `npm run e2e:full`

Mainnet öncesi:

- [ ] **`forge test` mainnet fork'unda çalıştırıldı**
      ```bash
      forge test --fork-url https://mainnet.base.org
      ```
      Base mainnet'in gerçek durumuna karşı testler.

- [ ] **Upgrade senaryosu testnet'te GERÇEKTEN denendi**
      `test_Upgrade_PreservesAllState` birim testte geçiyor, ama canlı
      zincirde bir kez denenmeli. Mainnet upgrade'i asla ilk deneme olmamalı.

- [ ] **`renounceOwnership` kapalı olduğu doğrulandı**
      ```bash
      cast send $PROXY "renounceOwnership()" --rpc-url base --account …
      # OwnershipRenounceDisabled ile revert etmeli
      ```

- [ ] **Deploy sonrası duman testi yapıldı** (docs/deploy.md Adım 8)

- [ ] **`--verify` ile kaynak kod BaseScan'de doğrulandı**

### Kabul edilen riskler (Faz 0'da kararlaştırıldı)

Bunlar hata değil, bilinçli tercihler. Sitede de açıkça yazılıyor:

| Yetki | Risk | Neden kabul edildi |
|---|---|---|
| `upgradeToAndCall` | Sahip tüm kuralları değiştirebilir | 4 aylık kamp süresinde bug çıkarsa immutable kontratta 40 kişiye "rozetleriniz geçersiz" demek gerekirdi |
| `setMerkleRoot` | Sahip kime rozet verileceğini belirler | Sistemin doğası; kulüp onay merciidir |
| `adminBurn` | 7 gün içinde rozet silinebilir | Yanlış basım düzeltmesi. 8. günden sonra **kimse** silemez (kontratta zorlanıyor) |
| `pause` | Basım süresiz durdurulabilir | Acil durum freni |

> Sistem **"trustless" değildir.** Rozetlerin değeri PRU Blockchain
> Kulübü'nün itibarına dayanır. Bu, bir kulüp sertifikası için makul bir
> modeldir — ama sitede "merkeziyetsiz ve değiştirilemez" diye sunulmuyor.

---

## BÖLÜM 3 — Backend

- [x] **Backend'in private key'i YOK**
      Zincire yazma her zaman insanın cüzdanıyla. Sunucu ele geçirilse bile
      saldırgan kendine rozet yazdıramaz.

- [x] **SIWE oturumu üç şeyi birden doğruluyor**
      imza sahipliği · nonce (replay koruması) · domain (phishing koruması)

- [x] **Nonce kullanıldıktan sonra siliniyor** — başarısız denemede de

- [x] **Oturum çerezi** `httpOnly` + `sameSite=lax` + üretimde `secure`

- [x] **Kilitli içerik sorguya girmiyor**
      `lib/content/access.ts` → `PUBLIC_FIELDS` / `FULL_FIELDS` ayrımı.
      Yetkisiz istekte `contentHtml` veritabanından okunmuyor bile.

- [x] **Admin sayfaları kendilerini koruyor**
      Layout kontrolü yetmiyor (Next.js'te layout ve page paralel render
      edilir; page'in çıktısı RSC yüküne sızıyordu). Her sayfa veri
      çekmeden önce `isAdminViewer()` çağırıyor.

- [x] **Notion webhook imzası HMAC-SHA256 ile, sabit zamanlı karşılaştırma**

- [x] **Cron uç noktası `Bearer CRON_SECRET` ile korumalı**

- [x] **Hata yanıtları yığın izi sızdırmıyor** — `lib/api.ts` → `handle()`

Mainnet öncesi:

- [ ] **Tüm sırlar Vercel ortam değişkenlerine taşındı**
      `.env.local` yalnızca yerel geliştirme için.

- [ ] **`SESSION_SECRET` üretim için YENİDEN üretildi**
      Yerelde kullandığımızla aynı olmamalı.

- [ ] **`NEXT_PUBLIC_APP_URL` üretim domainine ayarlandı**
      Yanlışsa SIWE domain kontrolü tüm girişleri reddeder.

- [ ] **Veritabanı yedeği alınıyor**
      Neon otomatik point-in-time recovery sunuyor; plan sınırları kontrol
      edilmeli.

---

## BÖLÜM 4 — Frontend

- [x] **Kilitli ekranda gerçek içerik yok** — HTML kaynağında doğrulandı
- [x] **Kilitli sayfalar `noindex`**, public örnek hafta indekslenebilir
- [x] **Kullanıcıya başarısız olacak işlem gösterilmiyor**
      Merkle kökü yazılmadan "Rozeti Al" butonu çıkmıyor
- [x] **Tüm renk kombinasyonları WCAG AA** — 12/12 geçti (brand.md §2.3)
- [x] **`prefers-reduced-motion` uygulanıyor**
- [x] **Üretim derlemesi başarılı** — 33 rota

Mainnet öncesi:

- [ ] **Notion içeriğindeki bağlantılar gözden geçirildi**
      Renderer `javascript:`/`data:` URL'lerini reddediyor ve yalnızca
      YouTube'u iframe'e alıyor. Yine de içeriğe eklenen dış bağlantılar
      bir kez göz gezdirilmeli.

- [ ] **Gerçek cihazlarda test edildi**
      En az bir Android + bir iOS telefonda, MetaMask'in kendi tarayıcısıyla.

---

## BÖLÜM 5 — Operasyon

- [ ] **`NEXT_PUBLIC_CHAIN="base"` ve yeni `NEXT_PUBLIC_CONTRACT_ADDRESS`**
- [ ] **Mainnet RPC** (Alchemy/QuickNode — public RPC üretim için yetersiz)
- [ ] **GitHub Actions secrets** — `APP_URL`, `CRON_SECRET`
- [ ] **Notion webhook** üretim adresine kuruldu
- [ ] **Rozet görselleri IPFS'e yüklendi**, `Week.imageCid` dolduruldu
- [ ] **İlk merkle root'u yazmadan önce listeyi iki kez kontrol et**
      Yanlış listeyle yazılan kök geri alınamaz; düzeltmek için yeni bir kök
      yazılır ama yanlış basılmış rozetler 7 günden sonra silinemez.

### Metadata dondurma (kamp bittiğinde)

İki aşamalı planın ikinci aşaması. Acele edilmemeli:

- [ ] Tüm metadata JSON'ları IPFS klasörüne yüklendi
- [ ] `setURI("ipfs://<klasörCID>/{id}.json")` çağrıldı
- [ ] Rastgele birkaç tokenId için metadata doğrulandı
- [ ] `freezeMetadata()` çağrıldı — **GERİ ALINAMAZ**

---

## BÖLÜM 6 — Slither bulguları (10 adet, tümü değerlendirildi)

| Bulgu | Adet | Değerlendirme |
|---|---|---|
| `timestamp` karşılaştırması | 4 | ✅ Kabul. İkisi sentinel kontrolü (`!= 0`, `== 0` — zaman değil "hiç ayarlanmadı"). İkisi gerçek: 30 günlük nick cooldown'ı ve 7 günlük burn penceresi. Doğrulayıcıların ~12 saniyelik oynatma payı bu ölçeklerde anlamsız. |
| `incorrect-equality` | 1 | ✅ Yukarıdaki sentinel'in aynısı, farklı dedektör. |
| `unused-state` (`__gap`) | 1 | ✅ Kasıtlı. `__gap`'in tanımı "kullanılmayan ama ayrılmış slot". |
| `naming-convention` | 4 | ✅ Bilgilendirme seviyesi. |

Yeniden çalıştırmak için:
```bash
cd contracts
slither . --filter-paths "lib/|test/|script/"
```

---

## BÖLÜM 7 — Doğrulama komutları

Mainnet'e geçmeden önce hepsini çalıştır, hepsi yeşil olmalı:

```bash
# Kontratlar
cd contracts
forge test                                    # 142 test
forge coverage --no-match-coverage "(script|test)"   # satır ≥%95, dal ≥%90
forge build --sizes                           # < 24.576 bayt
slither . --filter-paths "lib/|test/|script/"

# Backend + frontend
cd ../web
npm run typecheck                             # hata yok
npm run build                                 # derleme başarılı
npm run verify:merkle                         # TS ↔ Solidity uyumu
npm run e2e                                   # backend akışı
npm run e2e:full                              # zincirin ucuna kadar
npm run notion:probe                          # Notion erişimi
```

---

## BÖLÜM 8 — Bilinen küçük notlar

- **`sslmode=require`** — `pg` sürücüsünün gelecek sürümlerinde farklı
  yorumlanacak. Şu an sorun yok; sürücü güncellenirken
  `sslmode=verify-full` olarak netleştirilmeli.

- **Vercel Hobby planı** ticari olmayan kullanım içindir. Üniversite kulübü
  sitesi buna uyuyor.

- **RPC gecikmesi** — Public RPC'ler birden çok düğüm arkasında; bir işlem
  yazıldıktan hemen sonra yapılan okuma eski durumu görebilir. Uçtan uca
  testte bu iki kez yaşandı ve yoklama (polling) ile çözüldü. Frontend'de
  `useWaitForTransactionReceipt` aynı işi yapıyor.

- **`web/lib/generated/`** repoda yok; klonlayan kişi `npx prisma generate`
  çalıştırmalı.
