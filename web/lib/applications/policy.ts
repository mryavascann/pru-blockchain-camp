export type ApplicationDecision = {
  requiresReview: boolean;
  status: "PENDING" | "APPROVED";
  completionWeeks: number[];
};

/**
 * İleri haftadan başlama her zaman insan onayı ister. Birinci hafta ise kamp
 * ayarına göre ya hemen açılır ya da aynı inceleme kuyruğuna girer.
 */
export function decideApplication(
  declaredWeek: number,
  firstWeekRequiresApproval: boolean,
): ApplicationDecision {
  const requiresReview = declaredWeek > 1 || firstWeekRequiresApproval;

  return {
    requiresReview,
    status: requiresReview ? "PENDING" : "APPROVED",
    completionWeeks: requiresReview ? [] : [1],
  };
}
