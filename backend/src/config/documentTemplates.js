import { generateFormalLetter } from "../services/rightsService.js";
import {
  generateFirstAppealDraft,
  generateRtiApplication,
} from "../services/rtiService.js";

const civicCategoryLabels = Object.freeze({
  POTHOLES: "Potholes",
  GARBAGE: "Garbage",
  STREETLIGHTS: "Streetlights",
  DRAINAGE: "Drainage",
  WATER_SUPPLY: "Water supply",
});

function civicLocationLabel(location = {}) {
  return [
    location.address,
    location.locality,
    location.city,
    location.district,
    location.state,
    location.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function generateCivicComplaint({ description, category, location, recipient }) {
  const place = civicLocationLabel(location);
  return [
    "CIVIC COMPLAINT DRAFT — FOR USER REVIEW ONLY; NOT SUBMITTED",
    "",
    `To: ${recipient || "[Identify and verify the appropriate receiving office]"}`,
    `Subject: Report of ${civicCategoryLabels[category] || "[issue category]"} issue`,
    "",
    "Location:",
    place || "[Add the issue location]",
    "",
    "Description supplied by the user:",
    description,
    "",
    "Requested action:",
    "[Describe the action or response you are requesting]",
    "",
    "Name and contact details: [Complete before use]",
    "Date: [Add date before use]",
    "",
    "Draft only. Confirm all facts, recipient details, and applicable local procedures before use. This complaint has not been submitted.",
  ].join("\n");
}

export function generateDocumentTemplate(type, input) {
  if (type === "RTI_APPLICATION") {
    return {
      title: input.title || "RTI application draft",
      content: generateRtiApplication({
        description: input.description,
        authority: input.authority,
        receivingOffice: input.receivingOffice,
      }),
    };
  }

  if (type === "FIRST_APPEAL") {
    return {
      title: input.title || "First appeal draft",
      content: generateFirstAppealDraft({
        caseTitle: input.caseTitle || "[Original RTI case]",
        caseDetails: input.facts.join("\n"),
        authorityName: input.authorityName || "[Public authority — verify]",
        deadlineDate: input.date || "[Add and verify relevant date]",
        originalRequestReference: input.originalRequestReference,
      }),
    };
  }

  if (type === "RIGHTS_LETTER") {
    return generateFormalLetter({
      category: input.category,
      facts: input.facts,
      requestedAction: input.requestedAction,
      recipient: input.recipient,
      senderName: input.senderName,
      urgent: input.urgent,
    });
  }

  if (type === "CIVIC_COMPLAINT") {
    return {
      title: input.title || `${civicCategoryLabels[input.category]} complaint draft`,
      content: generateCivicComplaint(input),
    };
  }

  throw new Error("Unsupported document type");
}
