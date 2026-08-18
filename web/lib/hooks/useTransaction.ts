"use client";

/**
 * ============================================================================
 * Zincir işlemi kancası — brand.md §7.7
 *
 * Her zincir işlemi DÖRT durumdan geçer ve hiçbiri atlanmaz:
 *
 *   idle              → normal buton
 *   awaiting-signature→ "Cüzdanında onayla…"       (kullanıcı cüzdanda)
 *   pending           → "Zincirde bekliyor…"       (tx hash + BaseScan linki)
 *   success | error   → sonuç
 *
 * "Butona bastım, ne oldu?" anı asla yaşanmamalı.
 *
 * ---------------------------------------------------------------------------
 * HATA MESAJLARI NEDEN ELLE EŞLEŞTİRİLİYOR
 *
 * Zincirden gelen hatalar geliştirici diliyle konuşur:
 *   "execution reverted: AlreadyClaimed(1, 3)"
 *   "insufficient funds for intrinsic transaction cost"
 *
 * Bunları kullanıcıya göstermek hiçbir şey anlatmaz. Aşağıdaki eşleme,
 * kontratın custom error adlarını (Faz 1'de tanımladığımız 48 hata)
 * kullanıcının ne YAPMASI gerektiğini söyleyen Türkçe cümlelere çevirir.
 * ---------------------------------------------------------------------------
 */
import {useCallback, useState} from "react";
import {BaseError, ContractFunctionRevertedError} from "viem";
import {useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {t} from "@/lib/i18n";

export type TxState = "idle" | "awaiting-signature" | "pending" | "success" | "error";

/**
 * Kontrat hatası adı → kullanıcıya gösterilecek Türkçe mesaj.
 * Adlar contracts/src/PruTypes.sol ile birebir aynı olmalı.
 */
const CONTRACT_ERRORS: Record<string, string> = {
  AlreadyClaimed: t.errors.alreadyClaimed,
  InvalidMerkleProof: t.errors.invalidProof,
  MerkleRootNotSet:
    "Bu haftanın listesi henüz zincire yayınlanmadı. Kısa süre içinde alabileceksin.",
  NicknameRequired: t.errors.nicknameRequired,
  NicknameAlreadyTaken: t.errors.nicknameTaken,
  NicknameLengthInvalid: "Nick 3-20 karakter arasında olmalı.",
  NicknameMustStartWithLetter: "Nick bir harfle başlamalı.",
  NicknameCannotEndWithUnderscore: "Nick alt çizgi ile bitemez.",
  NicknameHasConsecutiveUnderscores: "Nickte art arda iki alt çizgi olamaz.",
  NicknameHasInvalidCharacter:
    "Nickte izin verilmeyen bir karakter var. Sadece a-z, A-Z, 0-9 ve _ kullanılabilir.",
  NicknameSameAsCurrent: "Bu zaten mevcut nickin.",
  NicknameCooldownActive:
    "Nickini henüz değiştiremezsin. Değişiklikler 30 günde bir yapılabilir.",
  CampNotActive: t.errors.campNotActive,
  CampNotFound: "Böyle bir kamp bulunamadı.",
  WeekOutOfRange: "Bu hafta numarası kampın aralığında değil.",
  EnforcedPause: t.errors.paused,
  TransfersDisabled:
    "Rozetler devredilemez. Bu bilinçli bir tasarım — rozet sana ait ve öyle kalacak.",
  ApprovalsDisabled: "Rozetler devredilemediği için onay verilemez.",
  OwnableUnauthorizedAccount: t.errors.forbidden,
  EmptyInput: "Alınacak rozet seçilmedi.",
  ArrayLengthMismatch: "İstek bozuk görünüyor. Sayfayı yenileyip tekrar dene.",
};

/** viem/cüzdan hatasını Türkçe, eyleme dönük bir cümleye çevirir */
export function humanizeTxError(error: unknown): string {
  if (!error) return t.errors.unknown;

  if (error instanceof BaseError) {
    /* 1. Kontratın custom error'u var mı? */
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;

    const errorName = reverted?.data?.errorName;
    if (errorName && CONTRACT_ERRORS[errorName]) {
      return CONTRACT_ERRORS[errorName];
    }
    if (errorName) {
      // Bilinmeyen kontrat hatası — adı gösteriyoruz ki bildirilebilsin
      return `İşlem reddedildi (${errorName}). Bu beklenmedik bir durum, kulüp yöneticisine bildir.`;
    }

    /* 2. Cüzdan / ağ seviyesi hatalar */
    const message = error.shortMessage || error.message || "";
    const lower = message.toLowerCase();

    if (lower.includes("user rejected") || lower.includes("user denied")) {
      return t.errors.userRejected;
    }
    if (lower.includes("insufficient funds")) {
      return t.errors.insufficientFunds;
    }
    if (lower.includes("chain") && lower.includes("match")) {
      return t.errors.chainMismatch;
    }
    if (lower.includes("nonce")) {
      return "İşlem sırası bozuldu. Cüzdanını kapatıp açtıktan sonra tekrar dene.";
    }
    if (
      lower.includes("network") ||
      lower.includes("fetch") ||
      lower.includes("timeout")
    ) {
      return t.errors.network;
    }

    return message || t.errors.unknown;
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("user rejected")) {
      return t.errors.userRejected;
    }
    return error.message;
  }

  return t.errors.unknown;
}

/**
 * Kontrat yazma çağrısının parametreleri.
 *
 * wagmi'nin kendi tipi, yapılandırılmış zincire göre türetilen çok derin bir
 * genel tip (ondan gelen hata mesajları 20 satır uzunluğunda). Burada sade ve
 * okunabilir bir arayüz tanımlayıp çağrı anında dönüştürüyoruz.
 *
 * Tip güvenliği kaybolmuyor: fonksiyon adları ve argümanlar `pruCampBadgesAbi`
 * `as const` olduğu için çağrı yerinde zaten denetleniyor.
 */
export type WriteArgs = {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
};

export type UseTransactionResult = {
  state: TxState;
  /** İşlem hash'i — `pending` durumundan itibaren dolu */
  hash: `0x${string}` | undefined;
  /** Kullanıcıya gösterilecek Türkçe hata */
  error: string | null;
  /** İşlemi başlatır */
  send: (args: WriteArgs) => Promise<void>;
  /** Durumu sıfırlar (yeniden dene) */
  reset: () => void;
  isBusy: boolean;
};

/**
 * Bir kontrat yazma işlemini dört durumlu akışla yönetir.
 *
 * @param onConfirmed Zincirde onaylandığında çalışır — genelde veri yenileme
 */
export function useTransaction(onConfirmed?: () => void): UseTransactionResult {
  const [state, setState] = useState<TxState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | undefined>();

  const {writeContractAsync} = useWriteContract();

  /*
   * İşlem zincire gönderildikten sonra ONAYLANMASINI bekliyoruz.
   *
   * Bu adım atlanırsa kullanıcıya "başarılı" denir ama rozet henüz
   * cüzdanında olmaz; sayfa yenilendiğinde "rozetim yok" görür ve sistem
   * bozuk sanır. Onay beklemek bu kafa karışıklığını önler.
   */
  const receipt = useWaitForTransactionReceipt({
    hash,
    query: {enabled: Boolean(hash)},
  });

  /* Onay geldiğinde durumu güncelle */
  if (state === "pending" && receipt.isSuccess) {
    setState("success");
    onConfirmed?.();
  }
  if (state === "pending" && receipt.isError) {
    setState("error");
    setError(
      "İşlem zincirde başarısız oldu. BaseScan'den detayına bakabilirsin.",
    );
  }

  const send = useCallback(
    async (args: WriteArgs) => {
      setError(null);
      setHash(undefined);
      setState("awaiting-signature");

      try {
        const txHash = await writeContractAsync(
          args as Parameters<typeof writeContractAsync>[0],
        );
        setHash(txHash);
        setState("pending");
      } catch (caught) {
        setError(humanizeTxError(caught));
        setState("error");
      }
    },
    [writeContractAsync],
  );

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
    setHash(undefined);
  }, []);

  return {
    state,
    hash,
    error,
    send,
    reset,
    isBusy: state === "awaiting-signature" || state === "pending",
  };
}
