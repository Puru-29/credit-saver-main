export const rightsCategories = Object.freeze({
  TENANT: {
    label: "Tenant issue",
    checklist: [
      "Lease, rental agreement, or other occupancy document, if available",
      "Rent payment records relevant to the concern, if available",
      "Dated messages or notices related to the concern",
      "A dated summary of events and the outcome you are seeking",
      "Photographs or repair records, if relevant and safe to collect",
    ],
  },
  GIG_WORKER_WORKPLACE: {
    label: "Gig-worker or workplace issue",
    checklist: [
      "Work, platform, or service agreement, if available",
      "Relevant payment, deduction, or earnings records, if available",
      "Dated messages, notices, or support-ticket records",
      "A dated summary of events and the outcome you are seeking",
      "Relevant work schedules or task records, if available",
    ],
  },
});

export function getEnabledRightsCategories() {
  const configured = process.env.RIGHTS_CATEGORIES?.split(",")
    .map((category) => category.trim().toUpperCase())
    .filter(Boolean);

  if (!configured?.length) return Object.keys(rightsCategories);

  const unknown = configured.filter((category) => !rightsCategories[category]);
  if (unknown.length) {
    throw new Error(`Unsupported RIGHTS_CATEGORIES value: ${unknown.join(", ")}`);
  }

  return [...new Set(configured)];
}

export function getLegalAidReferralMessage() {
  return (
    process.env.RIGHTS_LEGAL_AID_MESSAGE?.trim() ||
    "If you consider this matter urgent or unsafe, seek help from a trusted local legal-aid provider or appropriate emergency service. NyaySetu has not contacted anyone on your behalf."
  );
}
