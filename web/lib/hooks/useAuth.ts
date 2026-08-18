"use client";

/**
 * ============================================================================
 * Kimlik doğrulama kancası (hook)
 *
 * İKİ AYRI DURUM VAR VE KARIŞTIRILMAMALI:
 *
 *   1. CÜZDAN BAĞLI  (doğrudan viem)
 *      Tarayıcı cüzdanla konuşabiliyor. Bu tek başına HİÇBİR ŞEY KANITLAMAZ —
 *      adres herkese açık bilgi, sunucu buna güvenemez.
 *
 *   2. OTURUM AÇIK   (sunucu)
 *      Kullanıcı bir mesaj imzaladı, sunucu imzayı doğruladı. Ancak bundan
 *      sonra kilitli içerik açılır.
 *
 * Kullanıcı tek kez "Cüzdanını Bağla"ya basar. Bağlantı tamamlanınca SIWE
 * imzası otomatik istenir; arada ikinci bir site düğmesi gösterilmez.
 * ============================================================================
 */
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useCallback} from "react";
import {createSiweMessage} from "viem/siwe";

import {activeChain} from "@/lib/chain/config";
import {t} from "@/lib/i18n";
import {useWallet} from "@/lib/wallet/WalletProvider";

export type SessionInfo = {
  address: string | null;
  nickname: string;
  hasNickname: boolean;
  isAdmin: boolean;
};

const SESSION_KEY = ["session"] as const;

async function fetchSession(): Promise<SessionInfo> {
  const response = await fetch("/api/auth/session", {cache: "no-store"});
  const json = await response.json();
  if (!json.ok) throw new Error(json.error ?? t.errors.unknown);
  return json.data as SessionInfo;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const {
    address,
    isConnected,
    chainId,
    isReady: isWalletReady,
    hasWallet,
    connect,
    selectAccount,
    disconnect,
    switchToExpectedChain,
    signMessage,
  } = useWallet();

  const sessionQuery = useQuery({
    queryKey: SESSION_KEY,
    queryFn: fetchSession,
    staleTime: 15_000,
  });

  const session = sessionQuery.data;

  /*
   * Cüzdan bağlı ama sunucu oturumu YOK veya BAŞKA bir adrese ait.
   *
   * İkinci durum önemli: kullanıcı MetaMask'ten hesap değiştirdiğinde
   * eski oturum hâlâ geçerlidir ama artık yanlış kişiyi temsil eder.
   * Bunu yakalayıp yeniden imza istiyoruz.
   */
  const addressMismatch = Boolean(
    isConnected &&
      address &&
      session?.address &&
      session.address.toLowerCase() !== address.toLowerCase(),
  );

  const needsSignIn = Boolean(
    isConnected && address && (!session?.address || addressMismatch),
  );

  const wrongNetwork = Boolean(isConnected && chainId !== activeChain.id);

  /*
   * TEK KULLANICI EYLEMİ:
   *   bağlantı → doğru ağ → SIWE imzası → sunucu oturumu
   *
   * Cüzdan her güvenlik adımı için kendi onay penceresini gösterebilir, fakat
   * kullanıcı sitede ikinci kez bir düğmeye basmaz.
   */
  const authenticate = useMutation({
    mutationFn: async (
      selected?: {address: `0x${string}`; chainId: number},
    ) => {
      try {
        let signingAddress = selected?.address ?? address;
        let connectedChainId = selected?.chainId ?? chainId;

        if (!signingAddress) {
          const connected = await connect();
          signingAddress = connected.address;
          connectedChainId = connected.chainId;
        }

        if (connectedChainId !== activeChain.id) {
          await switchToExpectedChain();
        }

        const currentSession =
          queryClient.getQueryData<SessionInfo>(SESSION_KEY) ?? session;
        if (
          currentSession?.address?.toLowerCase() === signingAddress.toLowerCase()
        ) {
          return currentSession;
        }

        /* 1. Sunucudan tek kullanımlık nonce al */
        const nonceResponse = await fetch("/api/auth/nonce", {cache: "no-store"});
        const nonceJson = await nonceResponse.json();
        if (!nonceJson.ok) {
          throw new Error(nonceJson.error ?? t.auth.signInFailed);
        }

        /* 2. EIP-4361 mesajını kur — cüzdanda görünen açıklama İngilizce. */
        const message = createSiweMessage({
          address: signingAddress,
          chainId: activeChain.id,
          domain: window.location.host,
          nonce: nonceJson.data.nonce,
          uri: window.location.origin,
          version: "1",
          statement:
            "Sign in to PRU Blockchain Club. This signature is free and does not send a transaction or cost gas.",
          issuedAt: new Date(),
        });

        /* 3. Cüzdana imzalat (gas yok, zincire gitmez) */
        const signature = await signMessage(message, signingAddress);

        /* 4. Sunucuda doğrulat */
        const verifyResponse = await fetch("/api/auth/verify", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({message, signature}),
        });
        const verifyJson = await verifyResponse.json();
        if (!verifyJson.ok) {
          throw new Error(verifyJson.error ?? t.auth.signInFailed);
        }

        /* isAdmin dahil tam oturum biçimini tek kaynaktan al. */
        return await fetchSession();
      } catch (error) {
        const code = (error as {code?: number}).code;
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (code === 4001 || message.includes("user rejected")) {
          throw new Error(t.auth.signInRejected);
        }
        throw error;
      }
    },

    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_KEY, data);
      // Oturum değişti: içeriğe bağlı her şey yeniden çekilsin
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== SESSION_KEY[0],
      });
    },
  });

  /*
   * Ayrı ve bilinçli hesap değiştirme akışı:
   * hesap seçici → eski sunucu oturumunu kapat → yeni hesapla SIWE imzası.
   * Kullanıcı aynı hesabı seçerse gereksiz logout ve imza yapılmaz.
   */
  const changeAccount = useMutation({
    mutationFn: async () => {
      try {
        const selected = await selectAccount();
        const currentSession =
          queryClient.getQueryData<SessionInfo>(SESSION_KEY) ?? session;

        if (
          currentSession?.address?.toLowerCase() ===
          selected.address.toLowerCase()
        ) {
          return currentSession;
        }

        const logoutResponse = await fetch("/api/auth/logout", {method: "POST"});
        if (!logoutResponse.ok) throw new Error(t.auth.signInFailed);

        queryClient.setQueryData(SESSION_KEY, {
          address: null,
          nickname: "",
          hasNickname: false,
          isAdmin: false,
        } satisfies SessionInfo);

        return await authenticate.mutateAsync(selected);
      } catch (error) {
        const code = (error as {code?: number}).code;
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (code === 4001 || message.includes("user rejected")) {
          throw new Error(t.auth.changeWalletRejected);
        }
        throw error;
      }
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", {method: "POST"});
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, {
        address: null,
        nickname: "",
        hasNickname: false,
        isAdmin: false,
      } satisfies SessionInfo);
      queryClient.invalidateQueries();
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({queryKey: SESSION_KEY});
  }, [queryClient]);

  return {
    /** Tarayıcı cüzdanı bağlı mı */
    isConnected,
    /** Cüzdandaki adres (henüz kanıtlanmamış) */
    walletAddress: address,
    /** Sunucuda doğrulanmış oturum */
    session,
    isLoadingSession: sessionQuery.isLoading,
    isWalletReady,
    hasWallet,
    /** İmza atması gerekiyor mu */
    needsSignIn,
    /** Cüzdan başka bir hesaba geçmiş */
    addressMismatch,
    /** Yanlış ağda mı */
    wrongNetwork,
    authenticate,
    changeAccount,
    disconnect,
    signOut,
    refresh,
  };
}
