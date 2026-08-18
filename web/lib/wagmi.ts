/**
 * ============================================================================
 * Cüzdan bağlantısı yapılandırması (wagmi v2)
 *
 * ---------------------------------------------------------------------------
 * FAZ 0'DAN SAPMA: RainbowKit YERİNE ÖZEL ARAYÜZ
 *
 * Faz 0'da RainbowKit önermiştim. Uygulamaya geçerken üç sebeple vazgeçtim:
 *
 *   1. MARKA UYUMU — `docs/brand.md` renk, tipografi ve buton davranışlarını
 *      ayrıntısıyla tanımlıyor. RainbowKit'in kendi modal'ı bu sisteme ancak
 *      yaklaşabilir; "birebir uyacak" sözünü tutamazdı.
 *
 *   2. FAZLADAN BİR ANAHTAR GEREKTİRİYOR — RainbowKit'in varsayılan
 *      yapılandırması WalletConnect `projectId` ister. Bu, senden alınacak
 *      bir hesap ve anahtar daha demek. Kulüp projesinde her ek bağımlılık
 *      bir sürtünme noktası.
 *
 *   3. GERÇEK KULLANIM ŞEKLİ — Öğrenciler ya masaüstünde MetaMask eklentisi
 *      ya da telefonda MetaMask'in kendi tarayıcısı üzerinden girecek.
 *      İkisi de `injected` bağlayıcısıyla çalışır; WalletConnect'e gerek yok.
 *
 * WalletConnect ileride gerekirse (örneğin Trust Wallet kullanan biri çıkarsa)
 * tek satırla eklenebilir — `walletConnect({projectId})` bağlayıcısını
 * aşağıdaki listeye koymak yeterli.
 * ---------------------------------------------------------------------------
 */
import {createConfig, http, cookieStorage, createStorage} from "wagmi";
import {base, baseSepolia} from "wagmi/chains";
import {coinbaseWallet, injected} from "wagmi/connectors";

import {publicEnv} from "@/lib/env";

const chain = publicEnv.NEXT_PUBLIC_CHAIN === "base" ? base : baseSepolia;

export const wagmiConfig = createConfig({
  chains: [chain],

  connectors: [
    /*
     * `injected`: MetaMask, Rabby, Brave Wallet ve mobil cüzdanların
     * kendi tarayıcıları. Kullanıcıların büyük çoğunluğu buradan gelecek.
     *
     * `shimDisconnect`: Kullanıcı siteden çıkış yaptığında MetaMask
     * bağlantıyı gerçekten unutmaz (eklenti seviyesinde bağlı kalır).
     * Bu ayar, uygulama içinde "çıkış yaptım" hissini doğru verir.
     */
    injected({shimDisconnect: true}),

    /*
     * Coinbase Wallet: Base ağının kendi ekosistem cüzdanı. Base üzerinde
     * çalışan bir proje için makul bir ikinci seçenek.
     */
    coinbaseWallet({
      appName: "PRU Blockchain Kulübü",
      preference: "all",
    }),
  ],

  /*
   * Her iki zincir için de taşıyıcı tanımlanıyor.
   *
   * `chains` yalnızca aktif zinciri içeriyor, ama `chain` değişkeninin tipi
   * `base | baseSepolia` birleşimi olduğu için TypeScript ikisini birden
   * bekliyor. İkisini de tanımlamak zararsız — kullanılmayan taşıyıcı hiç
   * çağrılmaz — ve mainnet'e geçişte tek satır bile değişmemesini sağlıyor.
   */
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },

  /*
   * SSR açık: Next.js sunucuda render ederken cüzdan durumu bilinmez.
   * `cookieStorage` ile bağlantı durumu çerezde taşınır, böylece sayfa
   * yenilendiğinde "bağlı değil" görünüp sonra aniden "bağlı" olmaz
   * (hydration uyuşmazlığı ve ekran titremesi).
   */
  ssr: true,
  storage: createStorage({storage: cookieStorage}),
});

/** Uygulamanın beklediği zincir — ağ uyuşmazlığı kontrolü için */
export const expectedChain = chain;

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
