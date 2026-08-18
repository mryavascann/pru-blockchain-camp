/**
 * ============================================================================
 * Katılımcı profili — seçenekler ve doğrulama
 *
 * Bu dosya TEK DOĞRULUK KAYNAĞI: hem onboarding formu hem admin paneli aynı
 * listeyi kullanır. Ayrı ayrı tanımlansaydı biri güncellendiğinde diğeri
 * eskir ve admin panelinde "bilinmeyen seçenek" satırları belirirdi.
 * ============================================================================
 */

/**
 * "Bu siteyi nereden duydun?" seçenekleri.
 *
 * NEDEN SABİT LİSTE, SERBEST METİN DEĞİL:
 * Yönetimin bu cevabı görmesindeki amaç hangi kanalın işe yaradığını
 * anlamak. Serbest metin olsaydı "instagram", "Instagram", "insta", "IG"
 * dört ayrı satır olur ve sayım anlamsızlaşırdı. "Diğer" seçeneği serbest
 * metne kapı açıyor ama gruplama bozulmuyor.
 */
export const REFERRAL_OPTIONS = [
  {value: "club_event", label: "Kulüp etkinliği veya duyurusu"},
  {value: "friend", label: "Arkadaş / tanıdık tavsiyesi"},
  {value: "instagram", label: "Instagram"},
  {value: "linkedin", label: "LinkedIn"},
  {value: "x", label: "X (Twitter)"},
  {value: "university", label: "Üniversite duyurusu / hoca yönlendirmesi"},
  {value: "search", label: "Arama motoru"},
  {value: "other", label: "Diğer"},
] as const;

export type ReferralValue = (typeof REFERRAL_OPTIONS)[number]["value"];

export const REFERRAL_VALUES = REFERRAL_OPTIONS.map((o) => o.value);

/** Kod değerini okunur etikete çevirir (admin paneli için) */
export function referralLabel(value: string | null): string {
  if (!value) return "—";
  return REFERRAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/**
 * Üniversite seçenekleri.
 *
 * Kulüp Piri Reis Üniversitesi'nde; katılımcıların çoğu oradan gelecek.
 * Ama kamplar dışa da açık olabildiği için "Diğer" ile serbest metin
 * bırakılıyor. Seçilen değer olduğu gibi saklanıyor — "Diğer" seçilirse
 * yazılan metin kaydediliyor.
 */
export const PRIMARY_UNIVERSITY = "Piri Reis Üniversitesi";

export const UNIVERSITY_OPTIONS = [
  PRIMARY_UNIVERSITY,
  "Diğer",
] as const;

export const UNIVERSITY_MAX_LENGTH = 120;
export const REFERRAL_DETAIL_MAX_LENGTH = 200;

export type ParticipantProfile = {
  university: string | null;
  referralSource: string | null;
  referralDetail: string | null;
};

/** Profil tamamlanmış sayılır mı? Onboarding adımının "bitti" işareti. */
export function isProfileComplete(profile: ParticipantProfile | null): boolean {
  return Boolean(profile?.university && profile?.referralSource);
}
