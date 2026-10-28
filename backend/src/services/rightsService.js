import {
  getEnabledRightsCategories,
  getLegalAidReferralMessage,
  rightsCategories,
} from "../config/rights.js";

const verificationNotice =
  "Procedural drafting assistance only, not legal advice or a guarantee of outcome. Verify the facts, recipient, local procedure, and any applicable deadlines before relying on or sending this draft. No laws, citations, or deadlines were verified.";

function assertCategory(category) {
  if (!getEnabledRightsCategories().includes(category)) {
    const error = new Error("Unsupported or disabled rights matter category");
    error.statusCode = 400;
    throw error;
  }
}

function referralFor(urgent) {
  return urgent ? `\n\nSupport note: ${getLegalAidReferralMessage()}` : "";
}

export function generateProceduralGuidance({ category, description, urgent = false }) {
  assertCategory(category);
  const matter = rightsCategories[category];

  return {
    title: `${matter.label} — procedural guidance draft`,
    content:
      [
        `Matter category: ${matter.label}`,
        "",
        "User-provided description:",
        description.trim(),
        "",
        "Suggested organizational steps (general information; verify locally):",
        "1. Write a dated, factual sequence of events and keep a copy for your records.",
        "2. Collect relevant documents and communications; distinguish records you have from records you still need.",
        "3. Identify the person, organization, or service involved using information you can verify.",
        "4. State the outcome you are seeking and communicate through a channel appropriate to your situation.",
        "5. Keep copies of correspondence and note any response dates stated by the recipient. This draft does not calculate a legal deadline.",
        "",
        "No jurisdiction-specific legal rule, eligibility decision, or outcome has been assessed.",
      ].join("\n") + referralFor(urgent),
    verificationNotice,
  };
}

export function generateFormalLetter({
  category,
  facts,
  requestedAction,
  recipient,
  senderName,
  urgent = false,
}) {
  assertCategory(category);
  const matter = rightsCategories[category];
  const factLines = facts.map((fact) => `- ${fact.trim()}`).join("\n");
  const recipientLine = recipient?.trim() || "[Recipient — identify and verify]";
  const senderLine = senderName?.trim() || "[Your name]";
  const actionText =
    requestedAction?.trim() || "[Describe the action or response you are requesting]";

  return {
    title: `${matter.label} — formal letter draft`,
    content:
      [
        recipientLine,
        "",
        "Subject: Request concerning the matter described below",
        "",
        "Dear Sir or Madam,",
        "",
        "I am writing about the following facts, as provided by me:",
        factLines,
        "",
        "I request the following action or response:",
        actionText,
        "",
        "Please provide a response through an appropriate channel.",
        "",
        "Sincerely,",
        senderLine,
        "",
        "Date: [Add date before use]",
        "",
        "Draft only — verify the recipient, facts, local procedure, and any applicable deadlines before sending. This letter has not been sent.",
      ].join("\n") + referralFor(urgent),
    verificationNotice,
  };
}

export function getEvidenceChecklist({ category, urgent = false }) {
  assertCategory(category);
  const matter = rightsCategories[category];
  return {
    category,
    categoryLabel: matter.label,
    checklist: [...matter.checklist],
    note: "This is a general organizational checklist, not a legal requirement. Only collect or share items relevant to your matter and do so safely.",
    ...(urgent ? { supportMessage: getLegalAidReferralMessage() } : {}),
  };
}
