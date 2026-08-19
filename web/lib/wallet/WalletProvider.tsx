"use client";

/**
 * Doğrudan viem tabanlı tarayıcı cüzdanı katmanı.
 *
 * EIP-6963 ile kurulu cüzdanları keşfeder. Birden fazla sağlayıcı varsa
 * bağlantı ve cüzdan değiştirme sırasında kullanıcıya açık seçim gösterir;
 * daha önce doğrulanmış bağlantıyı sayfa açılışında sessizce geri yükleyebilir.
 * Mesaj imzalama ve kontrat yazma işlemleri arada wagmi/RainbowKit olmadan
 * viem Wallet Client üzerinden yürür.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {createStore, type EIP6963ProviderDetail} from "mipd";
import type {Address, EIP1193Provider, Hash} from "viem";

import {activeChain} from "@/lib/chain/config";

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

type WalletSelectionPurpose = "connect" | "change";

type PendingWalletSelection = {
  resolve: (wallet: BrowserWallet) => void;
  reject: (error: Error & {code?: number}) => void;
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

/* Hata ve EIP-1193 değer yardımcıları. */
function walletSelectionRejected(): Error & {code?: number} {
  return Object.assign(new Error("Cüzdan seçimi iptal edildi."), {code: 4001});
}

class WalletAccountMismatchError extends Error {}

function walletAccountMismatch(): WalletAccountMismatchError {
  return new WalletAccountMismatchError(
    "İmzayı seçtiğin hesaptan alamadık. “Cüzdanı Değiştir”e basıp kullanmak istediğin cüzdanı ve hesabı seç, ardından tekrar dene.",
  );
}

function asWalletAddress(value: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error("Cüzdan geçerli bir EVM adresi döndürmedi.");
  }
  return value as Address;
}

function isSameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function chainIdToHex(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}`;
}

/* Cüzdan keşfi ve kullanıcı tercih sırası. */
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

/*
 * EIP-6963 sağlayıcısını mipd bulur; bağlantı, hesap ve ağ okumalarını viem
 * Wallet Client yapar. Böylece tarayıcı cüzdanı JSON-RPC ayrıntıları bileşenlere
 * dağılmaz.
 */
async function createBrowserWalletClient(
  wallet: BrowserWallet,
  account?: Address,
) {
  const {createWalletClient, custom} = await import("viem");
  return createWalletClient({
    ...(account ? {account} : {}),
    chain: activeChain,
    transport: custom(wallet.provider),
  });
}

/*
 * Ağır RPC/viem kodunu ilk sayfa paketine koymuyoruz. Kullanıcı gerçekten bir
 * işlem gönderdiğinde bir kez yüklenir ve sonraki beklemelerde yeniden kullanılır.
 */
async function createTransactionClient() {
  const [{createPublicClient}, {createReadTransport}] = await Promise.all([
    import("viem"),
    import("@/lib/chain/transport"),
  ]);

  return createPublicClient({
    chain: activeChain,
    transport: createReadTransport(),
  });
}

let transactionClientPromise:
  | ReturnType<typeof createTransactionClient>
  | undefined;

function getTransactionClient() {
  transactionClientPromise ??= createTransactionClient();
  return transactionClientPromise;
}

export function WalletProvider({children}: {children: ReactNode}) {
  const [wallets, setWallets] = useState<BrowserWallet[]>([]);
  const [connection, setConnectionState] = useState<Connection | null>(null);
  const [selectionPurpose, setSelectionPurpose] =
    useState<WalletSelectionPurpose | null>(null);
  const [isReady, setIsReady] = useState(false);
  const walletsRef = useRef<BrowserWallet[]>([]);
  const connectionRef = useRef<Connection | null>(null);
  const pendingSelectionRef = useRef<PendingWalletSelection | null>(null);
  const restoreStartedRef = useRef(false);

  const setConnection = useCallback((next: Connection | null) => {
    connectionRef.current = next;
    setConnectionState(next);
  }, []);

  const requestWalletSelection = useCallback(
    async (purpose: WalletSelectionPurpose): Promise<BrowserWallet> => {
      const available = orderWallets(walletsRef.current);
      if (available.length === 0) {
        throw new Error(
          "Tarayıcında EVM cüzdanı bulunamadı. Bir cüzdan eklentisi kurup tekrar deneyebilirsin.",
        );
      }
      if (available.length === 1) return available[0];
      if (pendingSelectionRef.current) {
        throw new Error("Önce açık cüzdan seçimini tamamla.");
      }

      return new Promise<BrowserWallet>((resolve, reject) => {
        pendingSelectionRef.current = {resolve, reject};
        setSelectionPurpose(purpose);
      });
    },
    [],
  );

  const chooseWallet = useCallback((wallet: BrowserWallet) => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    pendingSelectionRef.current = null;
    setSelectionPurpose(null);
    pending.resolve(wallet);
  }, []);

  const cancelWalletSelection = useCallback(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    pendingSelectionRef.current = null;
    setSelectionPurpose(null);
    pending.reject(walletSelectionRejected());
  }, []);

  /*
   * viem ekibinin mipd store'u EIP-6963 cüzdanlarını keşfeder ve tekrarları
   * ayıklar. EIP-6963 desteklemeyen eski eklentiler için window.ethereum yalnızca
   * son çare olarak korunur.
   */
  useEffect(() => {
    const store = createStore();

    function publish(providerDetails: readonly EIP6963ProviderDetail[]) {
      const next = providerDetails.map<BrowserWallet>((detail) => ({
        info: detail.info,
        provider: detail.provider as ProviderWithEvents,
      }));
      walletsRef.current = next;
      setWallets(next);
    }

    const unsubscribe = store.subscribe(publish, {emitImmediately: true});

    const readyTimer = window.setTimeout(() => {
      const injected = (window as Window & {ethereum?: ProviderWithEvents}).ethereum;
      if (store.getProviders().length === 0 && injected) {
        const next = [legacyWallet(injected)];
        walletsRef.current = next;
        setWallets(next);
      }
      setIsReady(true);
    }, 75);

    return () => {
      window.clearTimeout(readyTimer);
      unsubscribe();
      store.destroy();
    };
  }, []);

  useEffect(() => {
    if (!selectionPurpose) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelWalletSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cancelWalletSelection, selectionPurpose]);

  useEffect(
    () => () => {
      pendingSelectionRef.current?.reject(walletSelectionRejected());
      pendingSelectionRef.current = null;
    },
    [],
  );

  /* Daha önce izin verilmiş hesabı sayfa açılırken sessizce geri yükle. */
  useEffect(() => {
    if (!isReady || wallets.length === 0 || restoreStartedRef.current) return;
    restoreStartedRef.current = true;

    if (window.localStorage.getItem(DISCONNECTED_KEY) === "1") return;

    void (async () => {
      for (const wallet of orderWallets(wallets)) {
        try {
          const client = await createBrowserWalletClient(wallet);
          const accounts = await client.getAddresses();
          if (accounts.length === 0) continue;

          const chainId = await client.getChainId();
          setConnection({
            wallet,
            address: asWalletAddress(accounts[0]),
            chainId,
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
      setConnection({...previous, address: asWalletAddress(accounts[0])});
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
      const wallet =
        requestedWallet ?? (await requestWalletSelection("connect"));

      const client = await createBrowserWalletClient(wallet);
      const accounts = await client.requestAddresses();
      if (!accounts[0]) throw new Error("Cüzdandan hesap alınamadı.");

      const next = {
        wallet,
        address: asWalletAddress(accounts[0]),
        chainId: await client.getChainId(),
      };

      window.localStorage.removeItem(DISCONNECTED_KEY);
      window.localStorage.setItem(LAST_WALLET_KEY, wallet.info.uuid);
      setConnection(next);
      return {address: next.address, chainId: next.chainId};
    },
    [requestWalletSelection, setConnection],
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
    const previousWallet = connectionRef.current?.wallet;
    const wallet = await requestWalletSelection("change");
    const client = await createBrowserWalletClient(wallet);

    try {
      await client.request({
        method: "wallet_requestPermissions",
        params: [{eth_accounts: {}}],
      });
    } catch (error) {
      const code = (error as {code?: number}).code;
      if (code === 4001) throw error;
      if (code === 4200 || code === -32601) {
        if (previousWallet?.info.uuid === wallet.info.uuid) {
          throw new Error(
            "Bu cüzdan hesap seçme penceresini desteklemiyor. Hesabı cüzdan eklentisinden değiştirip tekrar deneyebilirsin.",
          );
        }
        // Sağlayıcı değiştiyse `eth_requestAccounts` aşağıda yeni cüzdanın
        // bağlantı penceresini açabilir; desteklenmeyen izin metoduna takılma.
      } else {
        throw error;
      }
    }

    const accounts = await client.requestAddresses();
    if (!accounts[0]) throw new Error("Cüzdandan hesap alınamadı.");

    const next = {
      wallet,
      address: asWalletAddress(accounts[0]),
      chainId: await client.getChainId(),
    };

    window.localStorage.removeItem(DISCONNECTED_KEY);
    window.localStorage.setItem(LAST_WALLET_KEY, wallet.info.uuid);
    setConnection(next);
    return {address: next.address, chainId: next.chainId};
  }, [requestWalletSelection, setConnection]);

  const disconnect = useCallback(() => {
    window.localStorage.setItem(DISCONNECTED_KEY, "1");
    setConnection(null);
  }, [setConnection]);

  const switchToExpectedChain = useCallback(async () => {
    const current = connectionRef.current;
    if (!current) throw new Error("Önce cüzdanını bağlaman gerekiyor.");

    const chainId = chainIdToHex(activeChain.id);
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
    const accountsBefore = (await current.wallet.provider.request({
      method: "eth_accounts",
    })) as string[];
    if (!accountsBefore[0]) {
      throw new Error(
        "Seçili cüzdan kilitli veya siteye hesap izni vermemiş. Cüzdanı açıp tekrar dene.",
      );
    }
    if (!isSameAddress(asWalletAddress(accountsBefore[0]), signingAccount)) {
      throw walletAccountMismatch();
    }

    const client = await createBrowserWalletClient(
      current.wallet,
      signingAccount,
    );
    const signature = await client.signMessage({
      account: signingAccount,
      message,
    });

    const accountsAfter = (await current.wallet.provider.request({
      method: "eth_accounts",
    })) as string[];
    if (
      !accountsAfter[0] ||
      !isSameAddress(asWalletAddress(accountsAfter[0]), signingAccount)
    ) {
      throw walletAccountMismatch();
    }

    return signature;
  }, []);

  async function writeContract(args: WalletWriteArgs) {
    const current = connectionRef.current;
    if (!current) throw new Error("Önce cüzdanını bağlaman gerekiyor.");
    if (current.chainId !== activeChain.id) {
      throw new Error(`Yanlış ağdasın. ${activeChain.name} ağına geçmelisin.`);
    }

    const client = await createBrowserWalletClient(
      current.wallet,
      current.address,
    );

    return client.writeContract({
      ...args,
      account: current.address,
      chain: activeChain,
    } as Parameters<typeof client.writeContract>[0]);
  }

  const waitForTransaction = useCallback(async (hash: Hash) => {
    const publicClient = await getTransactionClient();
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

  return (
    <WalletContext.Provider value={value}>
      {children}
      {selectionPurpose && (
        <WalletSelectionDialog
          purpose={selectionPurpose}
          wallets={orderWallets(wallets)}
          onSelect={chooseWallet}
          onCancel={cancelWalletSelection}
        />
      )}
    </WalletContext.Provider>
  );
}

function WalletSelectionDialog({
  purpose,
  wallets,
  onSelect,
  onCancel,
}: {
  purpose: WalletSelectionPurpose;
  wallets: BrowserWallet[];
  onSelect: (wallet: BrowserWallet) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-selection-title"
        aria-describedby="wallet-selection-description"
        className="w-full max-w-sm rounded-xl border border-line bg-elevated p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="wallet-selection-title" className="text-lg font-bold">
              {purpose === "connect"
                ? "Giriş yöntemini seç"
                : "Hangi cüzdanı kullanacaksın?"}
            </h2>
            <p
              id="wallet-selection-description"
              className="mt-1 text-sm leading-relaxed text-fg-secondary"
            >
              {purpose === "change"
                ? "Cüzdanı seçtikten sonra o cüzdandaki hesabını da değiştirebilirsin."
                : "Kurulu EVM cüzdanların otomatik bulundu. Sosyal giriş seçenekleri de yakında burada olacak."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cüzdan seçimini kapat"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg"
          >
            ×
          </button>
        </div>

        {purpose === "connect" && (
          <div className="mt-5 grid grid-cols-2 gap-2" aria-label="Yakında gelecek giriş yöntemleri">
            <ComingSoonMethod icon={<GoogleIcon />} label="Google" />
            <ComingSoonMethod icon={<MailIcon />} label="E-posta" />
          </div>
        )}

        {purpose === "connect" && (
          <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted">
            <span className="h-px flex-1 bg-line" />
            Kurulu cüzdanlar
            <span className="h-px flex-1 bg-line" />
          </div>
        )}

        <div className={purpose === "connect" ? "flex flex-col gap-2" : "mt-5 flex flex-col gap-2"}>
          {wallets.map((wallet) => (
            <button
              key={wallet.info.uuid}
              type="button"
              onClick={() => onSelect(wallet)}
              className="flex w-full items-center gap-3 rounded-lg border border-line-strong bg-surface p-3 text-left transition-colors hover:border-line-accent hover:bg-subtle"
            >
              {wallet.info.icon?.startsWith("data:image/") ? (
                // EIP-6963 ikonları cüzdan eklentisinin sağladığı data URI'leridir.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wallet.info.icon}
                  alt=""
                  className="h-9 w-9 rounded-lg"
                />
              ) : (
                <span
                  className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-bold text-accent-fg"
                  aria-hidden="true"
                >
                  {wallet.info.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {wallet.info.name}
                </span>
                <span className="block truncate text-xs text-fg-muted">
                  {wallet.info.rdns}
                </span>
              </span>
              <span className="text-accent-text" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-md px-3 py-2 text-sm font-semibold text-fg-secondary hover:bg-subtle hover:text-fg"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}

function ComingSoonMethod({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="relative flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface/60 px-3 py-3 text-fg-secondary"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-subtle text-fg">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-accent-text">
          Yakında
        </span>
      </span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.42h5.52a4.8 4.8 0 0 1-2.05 3.07l-.02.11 2.98 2.3.2.02c1.86-1.71 2.97-4.23 2.97-7.14Z"
      />
      <path
        fill="currentColor"
        opacity=".78"
        d="M12 22c2.68 0 4.92-.88 6.63-2.63l-3.16-2.43c-.84.57-1.97.97-3.47.97a6.02 6.02 0 0 1-5.7-4.17l-.1.01-3.1 2.4-.03.1A10 10 0 0 0 12 22Z"
      />
      <path
        fill="currentColor"
        opacity=".56"
        d="M6.3 13.74A6.17 6.17 0 0 1 5.96 12c0-.6.11-1.2.32-1.74v-.12L3.14 7.7l-.1.05A10.02 10.02 0 0 0 2 12c0 1.53.35 2.97 1.07 4.25l3.23-2.51Z"
      />
      <path
        fill="currentColor"
        opacity=".36"
        d="M12 6.09c1.86 0 3.12.8 3.85 1.47l2.84-2.77A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.75l3.21 2.51A6.04 6.04 0 0 1 12 6.09Z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet, WalletProvider içinde kullanılmalı.");
  return value;
}
