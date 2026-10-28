import { getRtiApplicationTemplate } from "../config/rti-template.js";

function renderBlock(label, value) {
  return value ? `${label}: ${value.trim()}\n` : "";
}

export function generateRtiApplication({
  description,
  authority,
  receivingOffice,
  template = getRtiApplicationTemplate(),
}) {
  if (!template.includes("{{description}}")) {
    throw new Error("RTI_APPLICATION_TEMPLATE must include the {{description}} placeholder");
  }

  const values = {
    description: description.trim(),
    authorityBlock: renderBlock("Public authority (unverified)", authority?.name),
    receivingOfficeBlock: [
      renderBlock("Receiving office (unverified)", receivingOffice?.name),
      renderBlock("PIO name (unverified)", receivingOffice?.pioName),
    ].join(""),
  };

  return template.replace(
    /\{\{(description|authorityBlock|receivingOfficeBlock)\}\}/g,
    (_match, key) => values[key],
  );
}

export function generateFirstAppealDraft({
  caseTitle,
  caseDetails,
  authorityName,
  deadlineDate,
  originalRequestReference,
  appealGrounds,
}) {
  return [
    "SAMPLE FIRST-APPEAL DRAFT — FOR USER REVIEW ONLY; NOT FILED",
    "",
    `Subject: Request for review concerning ${caseTitle}`,
    `Public authority recorded in case (verify before use): ${authorityName}`,
    `Original request reference: ${originalRequestReference || "[Add the original request reference]"}`,
    `Relevant date recorded by the user: ${deadlineDate || "[Add and verify the relevant date]"}`,
    "",
    ...(appealGrounds ? ["Grounds supplied by the user:", appealGrounds, ""] : []),
    "I request review of the handling of the information request described below:",
    caseDetails,
    "",
    "Please review the request and provide a response or explain the next steps available.",
    "[Add the original request reference, grounds, recipient details, and any procedure-specific information only after verifying them.]",
    "",
    "This sample uses only details recorded in the case. Verify every fact, recipient, applicable procedure, and deadline before deciding whether or how to use it. No statutory provision or appeal deadline has been supplied or verified by NyaySetu.",
  ].join("\n");
}

export function generateActionTakenRtiDraft({
  caseTitle,
  caseDetails,
  category,
  location,
  authorityName,
}) {
  const place = [
    location.address,
    location.locality,
    location.city,
    location.district,
    location.state,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    "SAMPLE ACTION-TAKEN INFORMATION REQUEST — FOR USER REVIEW ONLY; NOT FILED",
    "",
    "Subject: Request for information about action taken on a reported civic issue",
    `Public authority recorded in the civic case (unverified; confirm the correct authority): ${authorityName}`,
    `Issue category recorded: ${category}`,
    `Location recorded in the civic case: ${place}`,
    "",
    "I request information, if held, about action taken on the following issue report:",
    caseDetails,
    "",
    "Please provide the relevant action-taken records or current status, if available.",
    "[Add dates, complaint references, recipient details, and any other facts only after verifying them.]",
    "",
    `Related civic case title: ${caseTitle}`,
    "This sample is based only on the civic case details shown above. Confirm the facts, authority, applicable process, any fee, and any deadline independently. NyaySetu has not submitted this request.",
  ].join("\n");
}
