export const CATEGORIES = [
  { value: "deposit", label: "Withheld security deposit", note: "Tenant" },
  { value: "eviction", label: "Eviction or lockout", note: "Tenant" },
  { value: "rent", label: "Rent increase or essential services cut", note: "Tenant" },
  { value: "wages", label: "Unpaid wages or arbitrary deductions", note: "Gig / worker" },
  { value: "deactivation", label: "Gig-platform account deactivation", note: "Gig / worker" },
  { value: "insurance", label: "Accident or insurance-benefit dispute", note: "Gig / worker" },
];

export const isTenant = (c?: string) => c === "deposit" || c === "eviction" || c === "rent";

/** Transparent rules. Not a validated legal or AI assessment. */
export function assessSeriousness(a: Record<string, string>) {
  let score = 0;
  const reasons: string[] = [];
  if (a["category"] === "eviction") {
    score += 2;
    reasons.push("Loss of housing is involved.");
  }
  if (a["category"] === "insurance") {
    score += 2;
    reasons.push("An accident or injury is involved.");
  }
  if (a["income"] === "yes") {
    score += 2;
    reasons.push("Your income has stopped.");
  }
  const amt = Number(a["deposit"] || a["amount"] || 0);
  if (amt >= 25000) {
    score += 1;
    reasons.push(`A significant amount (₹${amt.toLocaleString("en-IN")}) is involved.`);
  }
  if (a["communication"] === "written") {
    score += 1;
    reasons.push("Written attempts have not resolved it.");
  }
  if (!a["evidence"]?.trim()) reasons.push("No evidence listed yet — gather documents first.");
  const level = score >= 3 ? "High" : score >= 1 ? "Medium" : "Low";
  if (reasons.length === 0) reasons.push("No high-risk factors in your answers.");
  return { level, score, reasons } as const;
}
