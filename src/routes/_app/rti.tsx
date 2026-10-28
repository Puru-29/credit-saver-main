import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common";
import { GuidedFlow, type Answers, type Question } from "@/components/flow/GuidedFlow";
import { authorities, authorityService, createCase } from "@/services/mock-service";

export const Route = createFileRoute("/_app/rti")({
  head: () => ({
    meta: [
      { title: "RTI Assistant — NyaySetu" },
      { name: "description", content: "Prepare a sample RTI application step by step." },
      { property: "og:title", content: "RTI Assistant — NyaySetu" },
      { property: "og:description", content: "Prepare a sample RTI application step by step." },
    ],
  }),
  component: RtiPage,
});

const questions: Question[] = [
  {
    id: "info",
    type: "textarea",
    prompt: "What information or records do you want?",
    hint: "Be specific — e.g. 'copies of work orders for road repairs in Ward 150'.",
  },
  { id: "state", type: "text", prompt: "Which state is this about?" },
  { id: "city", type: "text", prompt: "Which city or district?" },
  {
    id: "authority",
    type: "choice",
    prompt: "Which public office holds this information?",
    hint: "Simulated suggestions from demo data — confirm or change.",
    options: [
      ...authorities().map((a) => ({
        value: a.id,
        label: a.name,
        note: `${a.department} · ${a.jurisdiction}`,
      })),
      { value: "other", label: "Another office", note: "You'll type it next" },
    ],
  },
  {
    id: "authorityOther",
    type: "text",
    prompt: "Name of the public office",
    when: (a) => a["authority"] === "other",
  },
  { id: "subject", type: "text", prompt: "A short subject line for your application" },
  {
    id: "period",
    type: "text",
    prompt: "What date range does it cover?",
    hint: "e.g. April 2025 – March 2026",
    optional: true,
  },
  {
    id: "context",
    type: "textarea",
    prompt: "Any supporting context?",
    hint: "Optional. Keep it brief — reasons are not required in an RTI request.",
    optional: true,
  },
  {
    id: "lang",
    type: "choice",
    prompt: "Preferred language for the application",
    options: [
      { value: "English", label: "English" },
      { value: "Hindi", label: "Hindi" },
      { value: "Regional", label: "Regional language", note: "Template shown in English for now" },
    ],
  },
];

const officeName = (a: Answers) =>
  a["authority"] === "other"
    ? (a["authorityOther"] ?? "")
    : (authorities().find((x) => x.id === a["authority"])?.name ?? "");

function buildRti(a: Answers) {
  return `[DEMO TEMPLATE — NOT LEGALLY VERIFIED]

To,
The Public Information Officer
${officeName(a)}
${a["city"]}, ${a["state"]}

Subject: ${a["subject"]}

Sir/Madam,

I request the following information:

${a["info"]}
${a["period"] ? `\nPeriod: ${a["period"]}\n` : ""}${a["context"] ? `\nBackground (for reference only): ${a["context"]}\n` : ""}
Please provide the information in ${a["lang"] === "Regional" ? "the regional language" : a["lang"]}, by post or email.

Application fee: [Enter fee details / BPL status]

Applicant name: [Your name]
Address: [Your address]
Date: [Date]
Signature: ____________

────────────────────────
SOURCE REFERENCES (verify before use)
• Applicable RTI law and fee rules for your state — [verify and add the correct reference]
• This template does not cite statutory sections. Confirm requirements with official sources.`;
}

function RtiPage() {
  return (
    <>
      <PageHeader
        title="RTI Assistant"
        description="Answer a few short questions. We'll prepare a sample application for you to review."
      />
      <GuidedFlow
        storageKey="nyaysetu.draft.rti"
        initialAnswerId="info"
        questions={questions}
        buildDocument={buildRti}
        documentTitle="Sample RTI Application"
        onCreateCase={(a, documentContent) =>
          createCase({
            type: "rti",
            title: a["subject"]!,
            summary: a["info"]!,
            authorityId:
              a["authority"] === "other"
                ? authorityService.createManual(a["authorityOther"] ?? "")
                : a["authority"]!,
            documentTitle: "RTI application draft",
            documentKind: "application",
            dueInDays: 30,
            documentContent,
          })
        }
      />
    </>
  );
}
