"use client";

/**
 * Doğrudan viem tabanlı tarayıcı cüzdanı katmanı.
 *
 * EIP-6963 ile kurulu cüzdanları keşfeder. Kullanıcı daha önce bir cüzdana
 * izin verdiyse onu, aksi hâlde MetaMask'i veya bulunan ilk cüzdanı seçer.
 * Bağlantı, mesaj imzalama ve kontrat yazma işlemleri arada wagmi/RainbowKit
 * olmadan viem Wallet Client üzerinden yürür.
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  numberToHex,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {activeChain, createReadTransport} from "@/lib/chain/config";

type ProviderWithEvents = EIP1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

export type BrowserWallet = {
  info: {
    uuid: string;
    name: string;
    icon?: string;
    rdns: string;
  };
  provider: ProviderWithEvents;
};

type Connection = {
  wallet: BrowserWallet;
  address: Address;
  chainId: number;
};

export type WalletWriteArgs = {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
};

type WalletContextValue = {
  address: Address | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  isReady: boolean;
  wallets: BrowserWallet[];
  hasWallet: boolean;
  connect: (wallet?: BrowserWallet) => Promise<{address: Address; chainId: number}>;
  selectAccount: () => Promise<{address: Address; chainId: number}>;
  disconnect: () => void;
  switchToExpectedChain: () => Promise<number>;
  signMessage: (message: string, account?: Address) => Promise<Hash>;
  writeContract: (args: WalletWriteArgs) => Promise<Hash>;
  waitForTransaction: (hash: Hash) => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const DISCONNECTED_KEY = "pru-wallet-disconnected";
const LAST_WALLET_KEY = "pru-last-wallet";

/*
 * İşlem onayını bu istemci bekliyor (`waitForTransaction`). Tek bir RPC'ye
 * bağlıyken o adres düştüğünde, işlem zincirde BAŞARIYLA onaylanmış olsa
 * bile kullanıcı ekranda hata görüyordu. Havuz bunu kapatıyor.
 */
const publicClient = createPublicClient({
  chain: activeChain,
  transport: createReadTransport(),
});

function orderWallets(wallets: BrowserWallet[]): BrowserWallet[] {
  const lastUuid = window.localStorage.getItem(LAST_WALLET_KEY);

  return [...wallets].sort((left, right) => {
    const score = (wallet: BrowserWallet) => {
      if (wallet.info.uuid === lastUuid) return 0;
      if (wallet.info.rdns.toLowerCase().includes("metamask")) return 1;
      return 2;
    };
    return score(left) - score(right);
  });
}

function legacyWallet(provider: ProviderWithEvents): BrowserWallet {
  return {
    info: {
      uuid: "legacy-injected",
      name: "Tarayıcı Cüzdanı",
      rdns: "injected.browser",
    },
    provider,
  };
}

export function WalletProvider({children}: {children: ReactNode}) {
  const [wallets, setWallets] = useState<BrowserWallet[]>([]);
  const [connection, setConnectionState] = useState<Connection | null>(null);
  const [isReady, setIsReady] = useState(false);
  const walletsRef = useRef<BrowserWallet[]>([]);
  const connectionRef = useRef<Connection | null>(null);
  const restoreStartedRef = useRef(false);

  const setConnection = useCallback((next: Connection | null) => {
    connectionRef.current = next;
    setConnectionState(next);
  }, []);

  /* EIP-6963 duyurularını topla; yoksa eski window.ethereum'a geri dön. */
  useEffect(() => {
    const discovered = new Map<string, BrowserWallet>();

    function publish() {
      const next = [...discovered.values()];
      walletsRef.current = next;
      setWallets(next);
    }

    function onAnnounce(event: Event) {
      const detail = (event as CustomEvent<BrowserWallet>).detail;
      if (!detail?.info?.uuid || !detail.provider) return;
      discovered.set(detail.info.uuid, {
        info: detail.info,
        provider: detail.provider as ProviderWithEvents,
      });
      publish();
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const readyTimer = window.setTimeout(() => {
      const injected = (window as Window & {ethereum?: ProviderWithEvents}).ethereum;
      if (discovered.size === 0 && injected) {
        discovered.set("legacy-injected", legacyWallet(injected));
        publish();
      }
      setIsReady(true);
    }, 75);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, []);

  /* Daha önce izin verilmiş hesabı sayfa açılırken sessizce geri yükle. */
  useEffect(() => {
    if (!isReady || wallets.length === 0 || restoreStartedRef.current) return;
    restoreStartedRef.current = true;

    if (window.localStorage.getItem(DISCONNECTED_KEY) === "1") return;

    void (async () => {
      for (const wallet of orderWallets(wallets)) {
        try {
          const accounts = (await wallet.provider.request({
            method: "eth_accounts",
          })) as string[];
          if (accounts.length === 0) continue;

          const chainHex = (await wallet.provider.request({
            method: "eth_chainId",
          })) as string;
          setConnection({
            wallet,
            address: getAddress(accounts[0]),
            chainId: Number(chainHex),
          });
          break;
        } catch {
          // Bir sağlayıcı cevap vermediyse sıradakini dene.
        }
      }
    })();
  }, [isReady, setConnection, wallets]);

  /* Aktif cüzdandaki hesap ve ağ değişikliklerini canlı izle. */
  useEffect(() => {
    const current = connection?.wallet.provider;
    if (!current?.on) return;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      if (!accounts?.[0]) {
        setConnection(null);
        return;
      }
      const previous = connectionRef.current;
      if (!previous) return;
      setConnection({...previous, address: getAddress(accounts[0])});
    };

    const onChainChanged = (...args: unknown[]) => {
      const chainHex = args[0] as string | undefined;
      const previous = connectionRef.current;
      if (!previous || !chainHex) return;
      setConnection({...previous, chainId: Number(chainHex)});
    };

    current.on("accountsChanged", onAccountsChanged);
    current.on("chainChanged", onChainChanged);
    return () => {
      current.removeListener?.("accountsChanged", onAccountsChanged);
      current.removeListener?.("chainChanged", onChainChanged);
    };
  }, [connection?.wallet.provider, setConnection]);

  const connect = useCallback(
    async (requestedWallet?: BrowserWallet) => {
      const available = walletsRef.current;
      const wallet = requestedWallet ?? orderWallets(available)[0];
      if (!wallet) {
        throw new Error(
          "Tarayıcında cüzdan bulunamadı. MetaMask kurup tekrar deneyebilirsin.",
        );
      }

      const accounts = (await wallet.provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts[0]) throw new Error("Cüzdandan hesap alınamadı.");

      const chainHex = (await wallet.provider.request({
        method: "eth_chainId",
      })) as string;
      const next = {
        wallet,
        address: getAddress(accounts[0]),
        chainId: Number(chainHex),
      };

      window.localStorage.removeItem(DISCONNECTED_KEY);
      window.localStorage.setItem(LAST_WALLET_KEY, wallet.info.uuid);
      setConnection(next);
      return {address: next.address, chainId: next.chainId};
    },
    [setConnection],
  );

  /**
   * Kullanıcının açıkça "Cüzdanı değiştir" eylemine basmasıyla mevcut
   * sağlayıcının hesap izin penceresini yeniden açar.
   *
   * `eth_requestAccounts` daha önce izin verilmişse seçiciyi göstermeden
   * mevcut hesabı döndürür. EIP-2255 `wallet_requestPermissions` çağrısı ise
   * MetaMask masaüstünde hesap seçimini yeniden açar. Normal `connect` akışı
   * bundan etkilenmez; hızlı tek tık davranışı korunur.
   */
  const selectAccount = useCallback(async () => {
    const wallet =
      connectionRef.current?.wallet ?? orderWallets(walletsRef.current)[0];
    if (!wallet) {
      throw new Error(
        "Tarayıcında cüzdan bulunamadı. MetaMask kurup tekrar deneyebilirsin.",
      );
    }

    try {
      await wallet.provider.request({
        method: "wallet_requestPermissions",
        params: [{eth_accounts: {}}],
      });
    } catch (error) {
      const code = (error as {code?: number}).code;
      if (code === 4001) throw error;
      if (code === 4200 || code === -32601) {
        throw new Error(
          "Bu cüzdan hesap seçme penceresini desteklemiyor. Hesabı cüzdan uygulamasından değiştirip tekrar deneyebilirsin.",
        );
      }
      throw error;
    }

    const accounts = (await wallet.provider.request({
      method: "eth_accounts",
    })) as string[];
    if (!accounts[0]) throw new Error("Cüzdandan hesap alınamadı.");

    const chainHex = (await wallet.provider.request({
      method: "eth_chainId",
    })) as string;
    const next = {
      wallet,
      address: getAddress(accounts[0]),
      chainId: Number(chainHex),
    };

    window.localStorage.removeItem(DISCONNECTED_KEY);
    window.localStorage.setItem(LAST_WALLET_KEY, wallet.info.uuid);
    setConnection(next);
    return {address: next.address, chainId: next.chainId};
  }, [setConnection]);

  const disconnect = useCallback(() => {
    window.localStorage.setItem(DISCONNECTED_KEY, "1");
    setConnection(null);
  }, [setConnection]);

  const switchToExpectedChain = useCallback(async () => {
    const current = connectionRef.current;
    if (!current) throw new Error("Önce cüzdanını bağlaman gerekiyor.");

    const chainId = numberToHex(activeChain.id);
    try {
      await current.wallet.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{chainId}],
      });
    } catch (error) {
      const code = (error as {code?: number}).code;
      if (code !== 4902) throw error;

      await current.wallet.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: activeChain.name,
            nativeCurrency: activeChain.nativeCurrency,
            rpcUrls: activeChain.rpcUrls.default.http,
            blockExplorerUrls: activeChain.blockExplorers
              ? [activeChain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
    }

    const next = {...current, chainId: activeChain.id};
    setConnection(next);
    return next.chainId;
  }, [setConnection]);

  const signMessage = useCallback(async (message: string, account?: Address) => {
    const current = connectionRef.current;
    if (!current) throw new Error("Önce cüzdanını bağlaman gerekiyor.");

    const signingAccount = account ?? current.address;
    const client = createWalletClient({
      account: signingAccount,
      chain: activeChain,
      transport: custom(current.wallet.provider),
    });
    return client.signMessage({account: signingAccount, message});
  }, []);

  async function writeContract(args: WalletWriteArgs) {
    const current = connectionRef.current;
    if (!current) throw new Error("Önce cüzdanını bağlaman gerekiyor.");
    if (current.chainId !== activeChain.id) {
      throw new Error(`Yanlış ağdasın. ${activeChain.name} ağına geçmelisin.`);
    }

    const client = createWalletClient({
      account: current.address,
      chain: activeChain,
      transport: custom(current.wallet.provider),
    });

    return client.writeContract({
      ...args,
      account: current.address,
      chain: activeChain,
    } as Parameters<typeof client.writeContract>[0]);
  }

  const waitForTransaction = useCallback(async (hash: Hash) => {
    const receipt = await publicClient.waitForTransactionReceipt({hash});
    if (receipt.status === "reverted") {
      throw new Error(
        "İşlem zincirde başarısız oldu. BaseScan'den detayına bakabilirsin.",
      );
    }
  }, []);

  const value: WalletContextValue = {
    address: connection?.address,
    chainId: connection?.chainId,
    isConnected: Boolean(connection),
    isReady,
    wallets,
    hasWallet: wallets.length > 0,
    connect,
    selectAccount,
    disconnect,
    switchToExpectedChain,
    signMessage,
    writeContract,
    waitForTransaction,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet, WalletProvider içinde kullanılmalı.");
  return value;
}
