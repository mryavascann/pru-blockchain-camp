"use client";

/**
 * ============================================================================
 * Kampa katılım akışı — üç adım
 *
 *   1. Cüzdanı bağla ve imzala   (ücretsiz, zincire gitmez)
 *   2. Nick belirle              (zincir işlemi, gas gerekir)
 *   3. Haftanı bildir            (zincir dışı, admin onayına gider)
 *
 * brand.md §9.1: cüzdan kapıda zorlanmaz. Kullanıcı buraya kendi isteğiyle
 * geliyor, o yüzden burada bağlantı istemek doğru.
 *
 * Adımlar KİLİTLİ değil, SIRALI: tamamlanan adım yeşil onayla kapanır,
 * sıradaki açılır. Kullanıcı hangi aşamada olduğunu her an görür.
 * ============================================================================
 */
import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {useAccount} from "wagmi";

import {Button} from "@/components/ui/Button";
import {Card, Pill} from "@/components/ui/Card";
import {ConnectButton} from "@/components/wallet/ConnectButton";
import {TxStatus} from "@/components/wallet/TxStatus";
import {pruCampBadgesAbi} from "@/lib/chain/abi";
import {contractAddress} from "@/lib/chain/config";
import {useAuth} from "@/lib/hooks/useAuth";
import {useTransaction} from "@/lib/hooks/useTransaction";
import {checkNickname} from "@/lib/nickname";
import {
  REFERRAL_OPTIONS,
  UNIVERSITY_OPTIONS,
  PRIMARY_UNIVERSITY,
  isProfileComplete,
  type ParticipantProfile,
} from "@/lib/participant";
import {t} from "@/lib/i18n";

type Camp = {
  id: number;
  slug: string;
  name: string;
  weekCount: number;
  active: boolean;
};

export function JoinFlow({camps}: {camps: Camp[]}) {
  const {isConnected} = useAccount();
  const {session, needsSignIn, wrongNetwork, refresh} = useAuth();

  const signedIn = Boolean(session?.address) && !needsSignIn;
  const hasNickname = Boolean(session?.hasNickname);

  /*
   * Profil (üniversite + siteyi nereden duydu) zincir dışı, KİŞİ BAZLI bir
   * kayıt. Oturum açılmadan istek bile atılmıyor.
   */
  const profileQuery = useQuery({
    queryKey: ["participant"],
    queryFn: async (): Promise<ParticipantProfile> => {
      const response = await fetch("/api/participant", {cache: "no-store"});
      const json = await response.json();
      if (!json.ok) throw new Error(json.error);
      return json.data.profile;
    },
    enabled: signedIn,
  });

  const profileDone = isProfileComplete(profileQuery.data ?? null);

  return (
    <div className="flex flex-col gap-4">
      <Step
        index={1}
        title={t.onboarding.step1}
        done={signedIn && !wrongNetwork}
        active={!signedIn || wrongNetwork}
      >
        <p className="mb-4 text-sm text-fg-secondary">
          {t.wallet.signInHint}
        </p>
        <ConnectButton />
      </Step>

      <Step
        index={2}
        title={t.onboarding.step2}
        done={hasNickname}
        active={signedIn && !wrongNetwork && !hasNickname}
      >
        {hasNickname ? (
          <p className="text-sm">
            {t.nickname.current}:{" "}
            <strong className="text-accent-text">{session?.nickname}</strong>
          </p>
        ) : (
          <NicknameStep onDone={refresh} />
        )}
      </Step>

      <Step
        index={3}
        title={t.onboarding.step2b}
        done={profileDone}
        active={signedIn && hasNickname && !profileDone}
      >
        <ProfileStep
          initial={profileQuery.data ?? null}
          onDone={() => void profileQuery.refetch()}
        />
      </Step>

      <Step
        index={4}
        title={t.onboarding.step3}
        done={false}
        active={signedIn && hasNickname && profileDone}
      >
        <ApplicationStep camps={camps} />
      </Step>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  ADIM KABI                                 */
/* -------------------------------------------------------------------------- */

function Step({
  index,
  title,
  done,
  active,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card accent={active} className={done ? "opacity-70" : undefined}>
      <div className="mb-4 flex items-center gap-3">
        <span
          className={[
            "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold",
            done
              ? "bg-success text-white"
              : active
                ? "bg-accent text-accent-fg"
                : "bg-subtle text-fg-muted",
          ].join(" ")}
          aria-hidden="true"
        >
          {done ? "✓" : index}
        </span>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      </div>

      {/* Tamamlanmış adımların içeriği kalabalık yapmasın diye küçültülür,
          ama gizlenmez — kullanıcı ne yaptığını görebilmeli. */}
      <div className={active || done ? "" : "pointer-events-none opacity-40"}>
        {children}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                              2. ADIM — NICK                                */
/* -------------------------------------------------------------------------- */

function NicknameStep({onDone}: {onDone: () => void}) {
  const [value, setValue] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const tx = useTransaction(() => {
    // Zincirde onaylandı — oturumdaki nick bilgisini tazele
    setTimeout(onDone, 500);
  });

  const check = checkNickname(value);
  const formatValid = value.length > 0 && check.valid;

  /** Zincirde bu nick alınmış mı? */
  async function checkAvailability() {
    if (!formatValid) return;
    setChecking(true);
    setAvailable(null);
    try {
      const response = await fetch(
        `/api/nickname/check?value=${encodeURIComponent(value)}`,
      );
      const json = await response.json();
      setAvailable(json.ok ? json.data.available : null);
    } catch {
      setAvailable(null);
    } finally {
      setChecking(false);
    }
  }

  function submit() {
    tx.send({
      address: contractAddress,
      abi: pruCampBadgesAbi,
      functionName: "registerNickname",
      args: [value.trim()],
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          {t.onboarding.nicknameLabel}
        </span>
        <input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setAvailable(null);
          }}
          onBlur={checkAvailability}
          placeholder={t.onboarding.nicknamePlaceholder}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          disabled={tx.isBusy}
          className="mono w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-fg outline-none focus:border-line-accent disabled:opacity-50"
        />
      </label>

      {/* Anında geri bildirim — kullanıcı gas ödemeden önce hatasını görsün */}
      {value.length > 0 && !check.valid && (
        <p className="text-sm text-danger">{check.reason}</p>
      )}
      {formatValid && checking && (
        <p className="text-sm text-fg-muted">{t.onboarding.nicknameChecking}</p>
      )}
      {formatValid && available === true && (
        <p className="text-sm text-success">✓ {t.onboarding.nicknameAvailable}</p>
      )}
      {formatValid && available === false && (
        <p className="text-sm text-danger">✕ {t.onboarding.nicknameTaken}</p>
      )}

      <p className="text-xs text-fg-muted">{t.onboarding.nicknameRules}</p>

      <Button
        variant="accent"
        loading={tx.isBusy}
        disabled={!formatValid || available === false}
        onClick={submit}
      >
        {tx.isBusy ? t.nickname.registering : t.nickname.register}
      </Button>

      <p className="text-xs text-fg-muted">
        Bu bir zincir işlemidir; cüzdanında az miktarda ETH bulunmalı.
      </p>

      <TxStatus
        state={tx.state}
        hash={tx.hash}
        error={tx.error}
        successMessage="Nickin zincire kaydedildi."
        onRetry={tx.reset}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        3. ADIM — KENDİNİ TANIT                             */
/* -------------------------------------------------------------------------- */

/**
 * Üniversite ve "bu siteyi nereden duydun" bilgisi.
 *
 * ZİNCİR DIŞI ve KİŞİ BAZLI: adrese bağlı tek bir kayıt. Kullanıcı ikinci bir
 * kampa başvurduğunda bu adım zaten tamamlanmış görünür ve tekrar sorulmaz.
 *
 * Bu bilgiler sıralamada veya profilde GÖRÜNMEZ — yalnızca kulüp yönetimi
 * görür. Kullanıcıya da bu açıkça söyleniyor; ne toplandığını bilmeden veri
 * vermek istemez.
 */
function ProfileStep({
  initial,
  onDone,
}: {
  initial: ParticipantProfile | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();

  /* Kayıtlı üniversite listede yoksa "Diğer" seçilmiş demektir */
  const savedIsOther =
    Boolean(initial?.university) && initial!.university !== PRIMARY_UNIVERSITY;

  const [universityChoice, setUniversityChoice] = useState(
    savedIsOther ? "Diğer" : (initial?.university ?? ""),
  );
  const [universityOther, setUniversityOther] = useState(
    savedIsOther ? (initial!.university ?? "") : "",
  );
  const [referral, setReferral] = useState(initial?.referralSource ?? "");
  const [referralDetail, setReferralDetail] = useState(
    initial?.referralDetail ?? "",
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isOtherUniversity = universityChoice === "Diğer";
  const isOtherReferral = referral === "other";

  const university = isOtherUniversity ? universityOther.trim() : universityChoice;
  const valid =
    university.length > 0 &&
    referral.length > 0 &&
    (!isOtherReferral || referralDetail.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/participant", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          university,
          referralSource: referral,
          referralDetail: isOtherReferral ? referralDetail.trim() : undefined,
        }),
      });
      const json = await response.json();

      if (json.ok) {
        setSaved(true);
        queryClient.setQueryData(["participant"], json.data.profile);
        onDone();
      } else {
        setError(json.error ?? t.errors.unknown);
      }
    } catch {
      setError(t.errors.network);
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-fg outline-none focus:border-line-accent";

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          {t.onboarding.universityLabel}
        </span>
        <select
          value={universityChoice}
          onChange={(event) => setUniversityChoice(event.target.value)}
          className={fieldClass}
        >
          <option value="">{t.onboarding.selectPlaceholder}</option>
          {UNIVERSITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {isOtherUniversity && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t.onboarding.universityOtherLabel}
          </span>
          <input
            type="text"
            value={universityOther}
            onChange={(event) => setUniversityOther(event.target.value)}
            placeholder={t.onboarding.universityOtherPlaceholder}
            maxLength={120}
            className={fieldClass}
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          {t.onboarding.referralLabel}
        </span>
        <select
          value={referral}
          onChange={(event) => setReferral(event.target.value)}
          className={fieldClass}
        >
          <option value="">{t.onboarding.selectPlaceholder}</option>
          {REFERRAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {isOtherReferral && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t.onboarding.referralDetailLabel}
          </span>
          <input
            type="text"
            value={referralDetail}
            onChange={(event) => setReferralDetail(event.target.value)}
            placeholder={t.onboarding.referralDetailPlaceholder}
            maxLength={200}
            className={fieldClass}
          />
        </label>
      )}

      <p className="text-xs text-fg-muted">{t.onboarding.profileHelp}</p>

      <Button variant="accent" loading={busy} disabled={!valid} onClick={submit}>
        {saved ? t.onboarding.profileSaved : t.common.save}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          4. ADIM — HAFTA BEYANI                            */
/* -------------------------------------------------------------------------- */

function ApplicationStep({camps}: {camps: Camp[]}) {
  const active = camps.filter((c) => c.active);
  const [campSlug, setCampSlug] = useState(active[0]?.slug ?? "");
  const [week, setWeek] = useState(1);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const camp = camps.find((c) => c.slug === campSlug);

  async function submit() {
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({campSlug, declaredWeek: week, note: note || undefined}),
      });
      const json = await response.json();
      if (json.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setMessage(json.error ?? t.errors.unknown);
      }
    } catch {
      setStatus("error");
      setMessage(t.errors.network);
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-success bg-subtle p-4">
        <p className="font-semibold text-success">✓ {t.onboarding.submitted}</p>
        <p className="mt-1 text-sm text-fg-secondary">
          {t.onboarding.submittedHelp}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          {t.onboarding.campLabel}
        </span>
        <select
          value={campSlug}
          onChange={(event) => {
            setCampSlug(event.target.value);
            setWeek(1);
          }}
          className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-fg outline-none focus:border-line-accent"
        >
          {active.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} ({c.weekCount} {t.camp.weeks})
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-sm font-semibold">
          {t.onboarding.weekLabel}
        </span>

        {/*
          Hafta seçimi düğme ızgarası olarak — açılır listede 15 seçenek
          taramak yerine tek bakışta görülüp tıklanabiliyor. Kutucuk sayısı
          kampın hafta sayısından geliyor, sabit değil.
        */}
        <div className="flex flex-wrap gap-1.5">
          {Array.from({length: camp?.weekCount ?? 0}, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setWeek(n)}
              aria-pressed={week === n}
              className={[
                "h-9 w-9 rounded-md border text-sm font-semibold transition-colors",
                week === n
                  ? "border-line-accent bg-accent text-accent-fg"
                  : "border-line-strong bg-surface text-fg-secondary hover:border-line-accent",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
        </div>

        <p className="mt-2 text-xs text-fg-muted">{t.onboarding.weekHelp}</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          {t.onboarding.noteLabel}
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.onboarding.notePlaceholder}
          rows={3}
          maxLength={500}
          className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-fg outline-none focus:border-line-accent"
        />
      </label>

      <Button
        variant="accent"
        loading={status === "sending"}
        disabled={!campSlug}
        onClick={submit}
      >
        {status === "sending" ? t.onboarding.submitting : t.onboarding.submit}
      </Button>

      {status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}

      {/*
        DÜRÜSTLÜK NOTU — Faz 0'da kararlaştırıldı:
        beyan edilen hafta sistemin tek güven noktası. Kullanıcı bunu bilsin.
      */}
      <div className="rounded-lg border border-line bg-subtle p-3">
        <Pill tone="muted">Nasıl işliyor?</Pill>
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary">
          Beyan ettiğin hafta otomatik olarak doğrulanmaz. Kulüp yöneticisi
          başvurunu elle inceleyip onaylar. Onaylandığında{" "}
          <strong>1. haftadan beyan ettiğin haftaya kadar</strong> tüm rozetleri
          tek işlemde alabilirsin.
        </p>
      </div>
    </div>
  );
}
