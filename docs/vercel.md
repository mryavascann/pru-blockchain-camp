# Vercel Deploy Rehberi

Siteyi `prublockchain.vercel.app` adresinde canlıya alma adımları.

> **Ön koşul:** Proje GitHub'a push edilmiş olmalı. Sırlar `.env.local`'de
> kalır; Vercel'e ayrı ayrı girilir (o dosya repoya girmiyor).

---

## Adım 1 — Projeyi içe aktar

1. [vercel.com/new](https://vercel.com/new) → GitHub deposunu seç
2. **Root Directory** ayarını `web` yap
   > ⚠️ Bu adım kritik. Deponun kökünde `contracts/` de var; Vercel varsayılan
   > olarak kökü Next.js projesi sanır ve derleme başarısız olur.
3. Framework: **Next.js** (otomatik algılanır)
4. **Deploy'a henüz basma** — önce ortam değişkenleri (Adım 2)

---

## Adım 2 — Ortam değişkenleri

Settings → Environment Variables. Her biri **Production**, **Preview** ve
**Development** için işaretlenmeli.

| Değişken | Değer | Not |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** bağlantı dizesi | Sunucusuz ortamda havuzlu bağlantı şart |
| `SESSION_SECRET` | **YENİ** üretilmiş 32+ karakter | Yereldekiyle aynı olmamalı |
| `NEXT_PUBLIC_APP_URL` | `https://prublockchain.vercel.app` | ⚠️ Yanlışsa SIWE tüm girişleri reddeder |
| `NEXT_PUBLIC_CHAIN` | `baseSepolia` | Mainnet'e geçince `base` |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0x298e083aF6B494DD504144dbc7C4edF01D7fB169` | Proxy adresi |
| `RPC_URL` | Alchemy/QuickNode HTTPS uç noktası | Public RPC üretim için yetersiz |
| `ADMIN_ADDRESSES` | Kendi MetaMask adresin | ⚠️ Anvil test adresi **OLMAMALI** |
| `NOTION_TOKEN` | Yenilenmiş token | |
| `NOTION_WEBHOOK_SECRET` | Webhook kurulunca dolacak | Şimdilik boş |
| `CRON_SECRET` | **YENİ** üretilmiş | GitHub Actions ile aynı olmalı |

Yeni sır üretmek için:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -hex 32      # CRON_SECRET
```

> `E2E_KEYSTORE_PASSWORD` **Vercel'e girilmez** — yalnızca yerel test içindir.

---

## Adım 3 — Deploy ve doğrulama

Deploy bitince şu adresleri kontrol et:

```
https://prublockchain.vercel.app/                        → landing
https://prublockchain.vercel.app/kamplar/developers      → 15 hafta
https://prublockchain.vercel.app/api/camps               → JSON
https://prublockchain.vercel.app/api/metadata/65539      → NFT metadata
https://prublockchain.vercel.app/api/metadata/65539/image → SVG rozet
```

**Kritik test:** Gizli sekmede bir hafta sayfası aç, `Ctrl+U` ile kaynağa bak.
Ders içeriğinden hiçbir ifade görünmemeli.

---

## Adım 4 — Kontrattaki metadata adresini güncelle

Kontrat şu an `localhost` değil ama yine de kontrol et:

```bash
cast call $PROXY "uri(uint256)(string)" 0 --rpc-url base_sepolia
```

Adres yanlışsa düzelt (sahip cüzdanıyla):

```bash
cast send $PROXY "setBaseURI(string)" \
  "https://prublockchain.vercel.app/api/metadata/{id}.json" \
  --rpc-url base_sepolia --account pru-testnet

cast send $PROXY "setContractURI(string)" \
  "https://prublockchain.vercel.app/api/collection.json" \
  --rpc-url base_sepolia --account pru-testnet
```

> `{id}` yer tutucusu **olduğu gibi** kalmalı — istemci onu tokenId ile
> değiştirir.

---

## Adım 5 — GitHub Actions (zamanlanmış senkron)

Repo → Settings → Secrets and variables → Actions → **New repository secret**

| Secret | Değer |
|---|---|
| `APP_URL` | `https://prublockchain.vercel.app` |
| `CRON_SECRET` | Vercel'dekiyle **aynı** değer |

Test: Actions sekmesi → **Notion Senkronu** → **Run workflow**

---

## Adım 6 — Notion webhook (senkron gecikmesini saniyelere indirir)

Bu adım isteğe bağlı; cron zaten 6 saatte bir çalışıyor. Webhook, Notion'da
yapılan değişikliğin **saniyeler içinde** siteye yansımasını sağlar.

1. [notion.so/profile/integrations](https://www.notion.so/profile/integrations)
   → `PRU Camp Site` → **Webhooks** sekmesi
2. **Create a subscription**
3. **Endpoint URL:**
   `https://prublockchain.vercel.app/api/webhooks/notion`
4. Notion bu adrese bir doğrulama isteği gönderir. Uç nokta doğrulama
   token'ını **Vercel loglarına** yazar:
   Vercel → Deployments → son deploy → **Runtime Logs**
   ```
   ══════════════════════════════════════════
     NOTION WEBHOOK DOĞRULAMA TOKEN'I
   ══════════════════════════════════════════
     <token buraya yazılır>
   ```
5. Token'ı Notion'daki kutuya yapıştır → doğrulama tamamlanır
6. Aynı token'ı Vercel'de `NOTION_WEBHOOK_SECRET` olarak kaydet
7. **Redeploy** (ortam değişkeni değişince gerekir)
8. Olay tipleri: `page.content_updated` ve `page.properties_updated`

> ⚠️ `NOTION_WEBHOOK_SECRET` boşken uç nokta **tüm istekleri reddeder**
> (503). Bu bilinçli: imzasız istek kabul edilmez.

**Test:** Notion'da bir hafta başlığını değiştir, 10-20 saniye bekle, siteyi
yenile. Değişiklik görünmeli. Görünmezse Vercel loglarında
`[notion-webhook]` satırlarına bak.

---

## Adım 7 — Kendi domainin (isteğe bağlı)

`prublockchain.camp` gibi bir domain aldıysan:

1. Vercel → Settings → Domains → domaini ekle
2. Registrar'da DNS kayıtlarını Vercel'in verdiği değerlere ayarla
3. `NEXT_PUBLIC_APP_URL`'i güncelle → **redeploy**
4. Kontrattaki URI'leri güncelle (Adım 4)

> Vercel domain eklemek için ücret almaz; yalnızca registrar'a ödersin.

---

## Sık karşılaşılan sorunlar

| Belirti | Sebep / çözüm |
|---|---|
| Derleme "No Next.js version detected" | Root Directory `web` yapılmamış (Adım 1) |
| Girişte "İmza doğrulanamadı" | `NEXT_PUBLIC_APP_URL` gerçek adresle birebir aynı değil |
| "too many connections" | Neon'un **pooled** bağlantı dizesi kullanılmalı, direct değil |
| Admin paneli "yetkin yok" diyor | `ADMIN_ADDRESSES`'e adresini ekleyip redeploy et |
| Senkron zaman aşımına uğruyor | 27 hafta ~75 sn sürer; `maxDuration = 300` tanımlı, Hobby planında üst sınır kontrol edilmeli |
| Rozet görselleri kırık | `Week.imageCid` boşsa yer tutucu SVG döner — normal |
