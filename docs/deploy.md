# Kontrat Kurulum ve Deploy Rehberi

Bu rehber `contracts/` klasörünü sıfırdan çalışır hâle getirir ve Base
Sepolia'ya deploy eder. Adımları sırayla takip et; her adımın sonunda ne
görmen gerektiği yazıyor.

---

## Adım 1 — Foundry kurulumu

Windows'ta **Git Bash** aç (PowerShell değil) ve şunu çalıştır:

```bash
curl -L https://foundry.paradigm.xyz | bash
```

Terminali kapat, yeniden aç, sonra:

```bash
foundryup
```

Doğrula:

```bash
forge --version
cast --version
```

İkisi de bir sürüm numarası basmalı. Basmıyorsa PATH ayarlanmamış demektir;
terminali yeniden başlat.

📖 [Foundry Book — Installation](https://book.getfoundry.sh/getting-started/installation)

---

## Adım 2 — Git deposu

`forge install` bağımlılıkları git submodule olarak indirir, bu yüzden proje
bir git deposu olmalı. Proje kökünde:

```bash
git init
git add .
git commit -m "Faz 1: kontratlar ve testler"
```

> `.gitignore` zaten hazır. `.env` dosyası **asla** commit edilmez.

---

## Adım 3 — Bağımlılıklar

`contracts/` klasörüne gir ve üç kütüphaneyi kur:

```bash
cd contracts

forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable
```

Neden üçü de gerekli:

| Kütüphane | Ne için |
|---|---|
| `forge-std` | Test altyapısı (`Test`, `vm`, `console`) |
| `openzeppelin-contracts` | `MerkleProof` ve `ERC1967Proxy` — proxy'nin kendisi yükseltilebilir olmadığı için standart pakette bulunur |
| `openzeppelin-contracts-upgradeable` | `ERC1155Upgradeable`, `Ownable2StepUpgradeable`, `PausableUpgradeable`, `UUPSUpgradeable` |

---

## Adım 4 — Derleme ve testler

```bash
forge build
forge test -vv
```

**Her test yeşil olmadan bir sonraki adıma geçme.**

Kapsam raporu:

```bash
forge coverage
```

Hedef: satır kapsamı **≥ %95**, dal kapsamı **≥ %90**.

Gas raporu — mainnet bütçesini bu sayılardan hesaplayacağız:

```bash
forge test --gas-report
```

Kontrat boyutunu kontrol et (24 KB sınırı):

```bash
forge build --sizes
```

> `PruCampBadges` 24576 bayta yaklaşırsa `foundry.toml` içinde
> `optimizer_runs` değerini 200'den 50'ye düşür veya `via_ir = true` yap.

---

## Adım 5 — Ortam değişkenleri ve cüzdan

### 5.1 `.env` dosyası

```bash
cp .env.example .env
```

Doldurulacak alanlar:

| Değişken | Nereden |
|---|---|
| `OWNER_ADDRESS` | Kontratın sahibi olacak cüzdanın adresi |
| `BASE_SEPOLIA_RPC_URL` | [Alchemy](https://www.alchemy.com/) → Base Sepolia app → HTTPS URL |
| `BASESCAN_API_KEY` | [basescan.org/myapikey](https://basescan.org/myapikey) |
| `BASE_URI` | `https://prublockchain.vercel.app/api/metadata/{id}.json` |
| `CONTRACT_URI` | `https://prublockchain.vercel.app/api/collection.json` |

> `{id}` yer tutucusunu **olduğu gibi bırak**. ERC-1155 standardı gereği bunu
> istemci (OpenSea, cüzdan) tokenId ile değiştirir.

### 5.2 Cüzdanı şifreli olarak kaydet

Private key'i `.env` dosyasında düz metin tutmak yerine Foundry'nin şifreli
keystore'unu kullan:

```bash
cast wallet import pru-deployer --interactive
```

Private key'i ve bir parola girmeni ister. Key şifrelenmiş olarak
`~/.foundry/keystores/pru-deployer` altına yazılır ve her kullanımda parola
sorulur. Böylece key ne dosyada ne kabuk geçmişinde düz metin durur.

Adresi doğrula:

```bash
cast wallet address --account pru-deployer
```

### 5.3 Test ETH

Deploy için Base Sepolia ETH gerekli (~0.02 ETH fazlasıyla yeter):

- [Coinbase Faucet](https://portal.cdp.coinbase.com/products/faucet)
- [Alchemy Base Sepolia Faucet](https://www.alchemy.com/faucets/base-sepolia)

Bakiyeni kontrol et:

```bash
cast balance $(cast wallet address --account pru-deployer) \
  --rpc-url base_sepolia --ether
```

---

## Adım 6 — Deploy

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --account pru-deployer \
  --broadcast \
  --verify \
  -vvvv
```

Çıktıda iki adres göreceksin:

```
PROXY (bunu kaydet): 0x...
Implementation     : 0x...
```

> **PROXY adresi kaydedilecek olan.** Kullanıcılar, frontend, OpenSea — hepsi
> bu adresle konuşur. Implementation adresi yalnızca upgrade'lerde referanstır
> ve her upgrade'de değişir.

`.env` dosyasına yaz:

```
PROXY_ADDRESS=0x...
```

`--verify` başarısız olursa (bazen indeksleme gecikir) daha sonra elle:

```bash
forge verify-contract <IMPLEMENTATION_ADRESI> \
  src/PruCampBadges.sol:PruCampBadges \
  --chain base-sepolia \
  --watch
```

---

## Adım 7 — Kampları oluştur

Deploy sonrası kamplar henüz yok. İkisini de oluştur:

```bash
# PRU Blockchain Developers — 15 hafta
cast send $PROXY_ADDRESS \
  "createCamp(string,uint16)" "PRU Blockchain Developers" 15 \
  --rpc-url base_sepolia --account pru-deployer

# PRU Blockchain Directors — 12 hafta
cast send $PROXY_ADDRESS \
  "createCamp(string,uint16)" "PRU Blockchain Directors" 12 \
  --rpc-url base_sepolia --account pru-deployer
```

Doğrula:

```bash
cast call $PROXY_ADDRESS "campCount()(uint256)" --rpc-url base_sepolia
# 2 dönmeli

cast call $PROXY_ADDRESS "getCamp(uint256)((string,uint16,bool,bool))" 1 \
  --rpc-url base_sepolia
```

> Bu iki komut "yeni kamp açmak kod değişikliği gerektirmez" şartının pratik
> karşılığıdır. 3. ve 4. kamp da tam olarak böyle açılacak.

---

## Adım 8 — Duman testi (smoke test)

Deploy'un gerçekten çalıştığını zincir üzerinde doğrula.

```bash
# Sahip doğru mu?
cast call $PROXY_ADDRESS "owner()(address)" --rpc-url base_sepolia

# Sürüm
cast call $PROXY_ADDRESS "version()(string)" --rpc-url base_sepolia

# Metadata şablonu
cast call $PROXY_ADDRESS "uri(uint256)(string)" 0 --rpc-url base_sepolia

# tokenId kodlaması: Kamp 1 Hafta 3 → 65539 dönmeli
cast call $PROXY_ADDRESS "encodeTokenId(uint256,uint256)(uint256)" 1 3 \
  --rpc-url base_sepolia

# Devredilemezlik sinyali → true dönmeli
cast call $PROXY_ADDRESS "locked(uint256)(bool)" 65539 --rpc-url base_sepolia
```

---

## Adım 9 — Haftalık merkle root yazma

Faz 2'de backend root üretmeye başlayınca her hafta bu çalışacak:

```bash
CAMP_ID=1 WEEK=4 MERKLE_ROOT=0xabc... \
forge script script/SetMerkleRoot.s.sol:SetMerkleRoot \
  --rpc-url base_sepolia \
  --account pru-deployer \
  --broadcast
```

---

## Mainnet'e geçiş

Base mainnet deploy'u **Faz 4'e kadar yapılmayacak.** Hazır olunduğunda tek
fark `--rpc-url base_sepolia` yerine `--rpc-url base` yazmaktır; kontratlarda
hiçbir değişiklik gerekmez.

Mainnet öncesi zorunlu kontrol listesi Faz 4'te
`docs/security-checklist.md` olarak verilecek. Özet başlıklar:

- [ ] Tüm testler yeşil, kapsam hedefleri tutuyor
- [ ] Slither statik analizi çalıştırıldı, bulgular değerlendirildi
- [ ] Testnet'te en az bir upgrade denendi ve durum korundu
- [ ] Sahip cüzdanı donanım cüzdanı veya ayrılmış güvenli cüzdan
- [ ] Metadata backend'i canlı ve `{id}` çözümlemesi doğru çalışıyor
- [ ] Uçtan uca test: nick → başvuru → onay → root → mint → leaderboard

---

## Statik analiz (Slither)

Python gerektirir:

```bash
pip install slither-analyzer
cd contracts
slither . --config-file slither.config.json
```

Yapılandırma dosyası Faz 4'te eklenecek. Şimdilik varsayılanlarla
çalıştırabilirsin; `lib/` altındaki OpenZeppelin bulgularını filtrelemek için:

```bash
slither . --filter-paths "lib/"
```

📖 [Slither](https://github.com/crytic/slither)

---

## Sık karşılaşılan sorunlar

| Belirti | Sebep / çözüm |
|---|---|
| `forge install` "not a git repository" hatası | Adım 2 atlanmış — `git init` çalıştır |
| `Source not found: forge-std/Test.sol` | Bağımlılıklar kurulmamış — Adım 3 |
| `--verify` başarısız | BaseScan indeksleme gecikmesi; birkaç dakika sonra `forge verify-contract` ile elle dene |
| `insufficient funds` | Faucet'ten test ETH al (Adım 5.3) |
| `EvmError: Revert` (deploy sırasında) | `.env` içinde `OWNER_ADDRESS` veya `BASE_URI` boş |
| Kontrat 24 KB'ı aştı | `optimizer_runs` düşür veya `via_ir = true` |
