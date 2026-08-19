"use client";

/**
 * ============================================================================
 * Kampa katılım akışı — dört adım
 *
 *   1. Cüzdanı bağla ve imzala   (ücretsiz, zincire gitmez)
 *   2. Nick belirle              (zincir işlemi, gas gerekir)
 *   3. Kendini tanıt             (zincir dışı, yalnızca yönetim görür)
 *   4. Kampa katıl               (1. hafta doğrudan veya kamp ayarına göre onaylı)
 *
 * 4. ADIM HER KAMP İÇİN AYRI: Bir kişi birden fazla kampa katılabilir. Herkes
 * varsayılan olarak 1. haftadan başlar; yalnızca gerçekten ileride olan kişi
 * küçük seçeneği açarak o kamp için ileri hafta inceleme talebi gönderir.
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
import Link from "next/link";

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
  firstWeekRequiresApproval: boolean;
  active: boolean;
};

type ApplicationRecord = {
  id: string;
  campId: number;
  declaredWeek: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  camp: {slug: string; name: string; weekCount: number};
};

export function JoinFlow({camps}: {camps: Camp[]}) {
  const {session, needsSignIn, wrongNetwork, refresh} = useAuth();

  const signedIn = Boolean(session?.address) && !needsSignIn;
  const hasNickname = Boolean(session?.hasNickname);
  /* Zincir okunamadı: "nick yok" değil, "bilmiyoruz" (bkz. lib/auth/guards.ts) */
  const nicknameUnknown = Boolean(session?.nicknameUnknown);

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

  /*
   * Kişinin mevcut başvuruları. Her kampın kendi durumu var: hiç
   * başvurmamış / bekliyor / onaylanmış / reddedilmiş.
   */
  const applicationsQuery = useQuery({
    queryKey: ["applications"],
    queryFn: async (): Promise<ApplicationRecord[]> => {
      const response = await fetch("/api/applications", {cache: "no-store"});
      const json = await response.json();
      if (!json.ok) throw new Error(json.error);
      return json.data.applications;
    },
    enabled: signedIn && profileDone,
  });

  const applications = applicationsQuery.data ?? [];

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
        ) : nicknameUnknown ? (
          /*
           * Form GÖSTERİLMİYOR. Kişinin nicki olabilir; ikinci kez almaya
           * kalkarsa işlem zincirde reddedilir ve boşuna gas öder.
           */
          <div className="rounded-lg border border-warning bg-subtle p-3">
            <p className="text-sm leading-relaxed text-fg-secondary">
              {t.errors.chainUnreachable}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-2 text-sm font-semibold text-accent-text underline underline-offset-2"
            >
              Tekrar dene
            </button>
          </div>
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
        /* En az bir kampa başvurulduysa adım tamamlanmış sayılır;
           diğer kamplar için blok açık kalmaya devam eder. */
        done={applications.length > 0}
        active={signedIn && hasNickname && profileDone}
      >
        <ApplicationStep
          camps={camps}
          applications={applications}
          loading={applicationsQuery.isLoading}
          onChanged={() => void applicationsQuery.refetch()}
        />
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
    <Card accent={active} className={done && !active ? "opacity-70" : undefined}>
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
/*                       4. ADIM — KAMPA KATILIM                              */
/* -------------------------------------------------------------------------- */

/**
 * HER KAMP İÇİN AYRI KATILIM.
 *
 * Önceki hâli tek bir açılır listeydi: bir kamp seç, bir hafta seç, gönder.
 * Bu, iki kampa birden katılan kişiyi çıkmaza sokuyordu — birinci kampa
 * başvurduktan sonra ikincisini beyan edecek yer kalmıyordu.
 *
 * Herkes varsayılan olarak 1. haftadan başlar. Yalnızca başka bir programdan
 * devam edenler küçük ileri hafta seçeneğini açıp inceleme talebi gönderir.
 * Kamplar birbirinden bağımsızdır.
 */
function ApplicationStep({
  camps,
  applications,
  loading,
  onChanged,
}: {
  camps: Camp[];
  applications: ApplicationRecord[];
  loading: boolean;
  onChanged: () => void;
}) {
  const activeCamps = camps.filter((c) => c.active);
  const inactiveCamps = camps.filter((c) => !c.active);

  if (loading) {
    return <p className="text-sm text-fg-muted">{t.common.loading}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-fg-secondary">
        İstediğin kampın <strong className="text-fg">1. haftasına başla</strong>.
        Başka bir programda ilerlediysen ilgili kampın içinden ileri hafta
        talebi gönderebilirsin.
      </p>

      {activeCamps.length > 1 && (
        <p className="rounded-lg border border-line-accent bg-subtle px-3 py-2 text-sm font-semibold text-accent-text">
          Birden fazla kampa katılabilirsin; her kampın katılımı ve ilerlemesi
          birbirinden bağımsızdır.
        </p>
      )}

      {activeCamps.map((camp) => (
        <CampApplication
          key={camp.id}
          camp={camp}
          application={applications.find((a) => a.campId === camp.id) ?? null}
          onChanged={onChanged}
        />
      ))}

      {inactiveCamps.map((camp) => (
        <div
          key={camp.id}
          className="rounded-lg border border-dashed border-line p-4"
        >
          <p className="font-semibold">{camp.name}</p>
          <p className="mt-1 text-sm text-fg-muted">{t.camp.inactive}</p>
        </div>
      ))}

      <div className="rounded-lg border border-line bg-subtle p-3">
        <Pill tone="muted">Nasıl işliyor?</Pill>
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary">
          1. hafta çoğu kampta hemen açılır; eğitmen isterse ilk katılım için de
          onay isteyebilir. <strong>2. hafta ve sonrası her zaman eğitmen
          incelemesine gider.</strong> Onaylanan ileri hafta talebi, 1. haftadan
          seçtiğin haftaya kadar erişimini açar.
        </p>
      </div>
    </div>
  );
}

/** Tek bir kampın katılım bloğu — kendi başlangıcı, kendi durumu */
function CampApplication({
  camp,
  application,
  onChanged,
}: {
  camp: Camp;
  application: ApplicationRecord | null;
  onChanged: () => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(application && application.declaredWeek > 1),
  );
  const [week, setWeek] = useState(
    Math.max(2, application?.declaredWeek ?? 2),
  );
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  /* Bekleyen ve onaylı başvurular değiştirilemez; reddedilen yeniden gönderilir */
  const locked =
    application?.status === "PENDING" || application?.status === "APPROVED";

  async function submit(requestedWeek: number) {
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          campSlug: camp.slug,
          declaredWeek: requestedWeek,
          note: note || undefined,
        }),
      });
      const json = await response.json();

      if (json.ok) {
        setStatus("idle");
        setNote("");
        setAdvancedOpen(false);
        onChanged();
      } else {
        setStatus("error");
        setMessage(json.error ?? t.errors.unknown);
      }
    } catch {
      setStatus("error");
      setMessage(t.errors.network);
    }
  }

  return (
    <div
      className={[
        "rounded-lg border p-4",
        application?.status === "APPROVED"
          ? "border-success"
          : application?.status === "PENDING"
            ? "border-line-accent"
            : "border-line-strong",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{camp.name}</p>

        {application ? (
          <Pill
            tone={
              application.status === "APPROVED"
                ? "reward"
                : application.status === "PENDING"
                  ? "accent"
                  : "danger"
            }
          >
            {application.status === "APPROVED"
              ? application.declaredWeek === 1
                ? "✓ 1. hafta açık"
                : `✓ ${application.declaredWeek}. haftaya kadar onaylı`
              : application.status === "PENDING"
                ? application.declaredWeek === 1
                  ? "1. hafta onayı bekleniyor"
                  : `${application.declaredWeek}. hafta isteği inceleniyor`
                : "reddedildi"}
          </Pill>
        ) : (
          <Pill tone="muted">
            {camp.weekCount} {t.camp.weeks}
          </Pill>
        )}
      </div>

      {/* ---- Onaylanmış ---- */}
      {application?.status === "APPROVED" && (
        <p className="mt-2 text-sm text-fg-secondary">
          {application.declaredWeek === 1
            ? "1. hafta erişimin açık. İçeriğe başlayabilirsin. "
            : `1–${application.declaredWeek}. hafta erişimin açıldı. `}
          <Link
            href={
              application.declaredWeek === 1
                ? `/kamplar/${camp.slug}/hafta/1`
                : "/profil"
            }
            className="font-semibold text-accent-text underline underline-offset-2"
          >
            {application.declaredWeek === 1
              ? "1. haftaya git →"
              : "Profilini aç →"}
          </Link>
        </p>
      )}

      {/* ---- Bekliyor ---- */}
      {application?.status === "PENDING" && (
        <p className="mt-2 text-sm text-fg-secondary">
          {application.declaredWeek === 1
            ? "Bu kampın eğitmeni ilk katılımı onaylıyor. Onaydan sonra 1. hafta açılacak."
            : `${application.declaredWeek}. haftadan başlama isteğin eğitmenin incelemesinde.`}
        </p>
      )}

      {/* ---- Reddedilmiş: sebebi göster, tekrar denemeye izin ver ---- */}
      {application?.status === "REJECTED" && application.reviewNote && (
        <p className="mt-2 text-sm text-danger">
          İnceleme notu: {application.reviewNote}
        </p>
      )}

      {/* ---- Katılım ve ileri hafta talebi ---- */}
      {!locked && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-lg border border-line bg-subtle p-3">
            <p className="text-sm font-semibold">1. haftadan başla</p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              {camp.firstWeekRequiresApproval
                ? "Bu kamp ilk katılımı eğitmen onayından sonra açıyor."
                : "Ek onay beklemeden kampın 1. haftası hemen açılır."}
            </p>
            <div className="mt-3">
              <Button
                variant="accent"
                loading={status === "sending"}
                onClick={() => submit(1)}
              >
                {camp.firstWeekRequiresApproval
                  ? "1. hafta için başvur"
                  : "Kampa katıl ve 1. haftayı aç"}
              </Button>
            </div>
          </div>

          {camp.weekCount > 1 && (
            <button
              type="button"
              aria-expanded={advancedOpen}
              disabled={status === "sending"}
              onClick={() => setAdvancedOpen((open) => !open)}
              className="self-start text-xs font-semibold text-accent-text underline underline-offset-4 disabled:opacity-50"
            >
              {advancedOpen
                ? "İleri hafta talebini kapat"
                : "Zaten ileride misin? İleri haftadan başlama isteği gönder"}
            </button>
          )}

          {advancedOpen && camp.weekCount > 1 && (
            <div className="flex flex-col gap-3 rounded-lg border border-line-accent p-3">
              <div>
                <span className="mb-1.5 block text-sm font-semibold">
                  Başlamak istediğin hafta
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    {length: camp.weekCount - 1},
                    (_, index) => index + 2,
                  ).map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setWeek(number)}
                      aria-pressed={week === number}
                      className={[
                        "h-9 w-9 rounded-md border text-sm font-semibold transition-colors",
                        week === number
                          ? "border-line-accent bg-accent text-accent-fg"
                          : "border-line-strong bg-surface text-fg-secondary hover:border-line-accent",
                      ].join(" ")}
                    >
                      {number}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-fg-muted">
                  İleri hafta talepleri eğitmen tarafından kontrol edilip onaylanır.
                </p>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold">
                  Kısa açıklama (isteğe bağlı)
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Önceki ilerlemeni doğrulamaya yardımcı olacak bilgi yazabilirsin."
                  rows={2}
                  maxLength={500}
                  className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-fg outline-none focus:border-line-accent"
                />
              </label>

              <Button
                variant="secondary"
                loading={status === "sending"}
                onClick={() => submit(week)}
              >
                {week}. haftadan başlama isteği gönder
              </Button>
            </div>
          )}

          {status === "error" && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
