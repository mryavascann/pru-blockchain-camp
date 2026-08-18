"use client";

/**
 * ============================================================================
 * İstemci sağlayıcıları
 *
 * `"use client"` bu dosyanın tarayıcıda çalıştığını söyler. Sağlayıcılar
 * React context kullandığı için sunucu bileşeni olamazlar.
 *
 * ÖNEMLİ: Bu sarmalayıcı yalnızca CÜZDAN DURUMUNU taşır. Sayfa içeriği
 * hâlâ sunucu bileşenlerinde üretilir — kilitli içeriğin tarayıcıya hiç
 * gitmemesi bu ayrıma bağlı. `providers.tsx`'in altına içerik koymak
 * o güvenceyi bozardı.
 * ============================================================================
 */
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState, type ReactNode} from "react";

import {WalletProvider} from "@/lib/wallet/WalletProvider";

export function Providers({children}: {children: ReactNode}) {
  /*
   * QueryClient `useState` içinde oluşturuluyor — modül seviyesinde
   * oluşturulsaydı sunucuda tüm kullanıcılar aynı önbelleği paylaşırdı
   * ve bir kullanıcının verisi başkasına gösterilebilirdi.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Zincir verisi hızlı değişmez; gereksiz yeniden sorgu yapma
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WalletProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WalletProvider>
  );
}
