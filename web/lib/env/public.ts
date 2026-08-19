/**
 * Tarayıcıya açık ortam değişkenleri.
 *
 * Bu dosya özellikle Zod gibi sunucu doğrulama bağımlılıklarını içermez.
 * Global arayüz bileşenleri yalnızca bu küçük modülü yüklediği için kullanıcı
 * cüzdana dokunmadan doğrulama kütüphanesini indirmek zorunda kalmaz.
 */
export type PublicChain = "baseSepolia" | "base";

function requirePublicValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} ortam değişkeni tanımlı değil.`);
  return value;
}

const appUrl = requirePublicValue(
  "NEXT_PUBLIC_APP_URL",
  process.env.NEXT_PUBLIC_APP_URL,
);
const chain = requirePublicValue(
  "NEXT_PUBLIC_CHAIN",
  process.env.NEXT_PUBLIC_CHAIN,
);
const contractAddress = requirePublicValue(
  "NEXT_PUBLIC_CONTRACT_ADDRESS",
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
);

try {
  new URL(appUrl);
} catch {
  throw new Error("NEXT_PUBLIC_APP_URL geçerli bir URL olmalı.");
}

if (chain !== "baseSepolia" && chain !== "base") {
  throw new Error('NEXT_PUBLIC_CHAIN "baseSepolia" veya "base" olmalı.');
}

if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
  throw new Error(
    "NEXT_PUBLIC_CONTRACT_ADDRESS geçerli bir adres olmalı (0x + 40 hex).",
  );
}

export const publicEnv = {
  NEXT_PUBLIC_APP_URL: appUrl,
  NEXT_PUBLIC_CHAIN: chain as PublicChain,
  NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress,
} as const;
