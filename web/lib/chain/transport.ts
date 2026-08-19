/** RPC havuzundan viem okuma taşıyıcısı üretir. */
import {fallback, http, type Transport} from "viem";

import {rpcUrls} from "@/lib/chain/config";

/**
 * Ölü bir RPC'de uzun süre beklemek yerine listedeki sıradaki adrese geçilir.
 * Üç sağlayıcının tamamı çalışmıyorsa istek en geç yaklaşık 18 saniyede biter.
 */
const REQUEST_TIMEOUT = 6_000;

/**
 * @param preferredUrl Özel bir sunucu RPC'si varsa havuzun başına alınır.
 * `retryCount: 0`, aynı ölü adresi tekrarlamak yerine sıradakini dener.
 */
export function createReadTransport(preferredUrl?: string): Transport {
  const urls = preferredUrl
    ? [preferredUrl, ...rpcUrls.filter((url) => url !== preferredUrl)]
    : [...rpcUrls];

  return fallback(
    urls.map((url) => http(url, {timeout: REQUEST_TIMEOUT})),
    {retryCount: 0},
  );
}
