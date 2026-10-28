import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare, Gauge, LifeBuoy } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/common";
import { GuidedFlow, label, type Answers, type Question } from "@/components/flow/GuidedFlow";
import { createCase } from "@/services/mock-service";
import { assessSeriousness, CATEGORIES, isTenant } from "@/lib/rights-rules";

export const Route = createFileRoute("/_app/rights")({
  head: () => ({
    meta: [
      { title: "Rights Companion — NyaySetu" },
      { name: "description", content: "Guided help for tenants and gig workers." },
      { property: "og:title", content: "Rights Companion — NyaySetu" },
      { property: "og:description", content: "Guided help for tenants and gig workers." },
    ],
  }),
  component: RightsPage,
});

const T = (a: Answers) => isTenant(a["category"]);
const G = (a: Answers) => !!a["category"] && !isTenant(a["category"]);
const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const questions: Question[] = [
  { id: "category", type: "choice", prompt: "What's happening?", options: CATEGORIES },
  {
    id: "issueSummary",
    type: "textarea",
    prompt: "Briefly describe what happened",
    hint: "Include the key facts and what remains unresolved.",
  },
  {
    id: "deposit",
    type: "number",
    prompt: "How much was the security deposit (₹)?",
    when: (a) => a["category"] === "deposit",
  },
  {
    id: "rent",
    type: "number",
    prompt: "What is/was the monthly rent (₹)?",
    when: (a) => T(a) && a["category"] !== "deposit",
    optional: true,
  },
  { id: "tenancyStart", type: "date", prompt: "When did the tenancy start?", when: T },
  {
    id: "vacated",
    type: "date",
    prompt: "When did you vacate?",
    when: (a) => a["category"] === "deposit",
  },
  {
    id: "incidentDate",
    type: "date",
    prompt: "When did this happen?",
    when: (a) => a["category"] === "eviction" || a["category"] === "rent",
  },
  { id: "platform", type: "text", prompt: "Which platform or employer?", when: G },
  {
    id: "issueType",
    type: "text",
    prompt: "Briefly, what's the issue?",
    hint: "e.g. ₹2,000 deducted without reason",
    when: G,
  },
  { id: "issueDate", type: "date", prompt: "When did it start?", when: G },
  {
    id: "amount",
    type: "number",
    prompt: "Amount withheld or deducted (₹)?",
    when: (a) => a["category"] === "wages" || a["category"] === "insurance",
    optional: true,
  },
  {
    id: "income",
    type: "choice",
    prompt: "Has this stopped your income?",
    options: yesNo,
    when: G,
  },
  { id: "otherParty", type: "text", prompt: "Name of the landlord / company", when: T },
  {
    id: "communication",
    type: "choice",
    prompt: "Have you already raised this with them?",
    options: [
      { value: "none", label: "Not yet" },
      { value: "verbal", label: "Verbally" },
      { value: "written", label: "In writing / chat / email" },
    ],
  },
  {
    id: "evidence",
    type: "textarea",
    prompt: "What evidence do you have?",
    hint: "e.g. agreement, receipts, screenshots, bank statements",
    optional: true,
  },
];

function buildNotice(a: Answers) {
  const cat = label(questions[0]!, a["category"]);
  const party = a["otherParty"] || a["platform"] || "[Name]";
  const facts = isTenant(a["category"])
    ? `${a["issueSummary"]} I was your tenant from ${a["tenancyStart"]}${a["vacated"] ? ` until ${a["vacated"]}` : ""}.${a["deposit"] ? ` A security deposit of ₹${a["deposit"]} was paid.` : ""}${a["incidentDate"] ? ` The issue arose on ${a["incidentDate"]}.` : ""}`
    : `I have worked with ${party}. Since ${a["issueDate"]}, ${a["issueType"] || a["issueSummary"]}.${a["amount"] ? ` The amount involved is ₹${a["amount"]}.` : ""}`;
  return `[DRAFT TEMPLATE — NOT LEGAL ADVICE]

To,
${party}

Subject: Notice regarding ${cat.toLowerCase()}

Sir/Madam,

${facts}

${a["communication"] === "none" ? "I am raising this with you formally for the first time." : "Despite earlier communication, the matter remains unresolved."}

I request that you resolve this within [15] days of receiving this notice. Please reply in writing.

Supporting documents: ${a["evidence"] || "[list documents]"}

Name: [Your name]
Contact: [Phone / email]
Date: [Date]`;
}

function Result(a: Answers) {
  const s = assessSeriousness(a);
  const checklist = isTenant(a["category"])
    ? [
        "Rent / leave-and-licence agreement",
        "Deposit and rent payment receipts or bank entries",
        "Move-out photos or handover note",
        "Messages with the landlord",
      ]
    : [
        "Platform / employer ID screenshots",
        "Earnings statements and deduction records",
        "Deactivation or warning messages",
        "Support-ticket history",
      ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SurfaceCard className="md:col-span-2">
        <h2 className="text-xl font-semibold">In plain language</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You're dealing with:{" "}
          <strong className="text-foreground">{label(questions[0]!, a["category"])}</strong>. A
          common first step is a calm, written notice to the other party that sets out facts and a
          reasonable time to respond. Keep copies of everything. If there's no reply, you can
          consider escalating or contacting legal aid.
        </p>
      </SurfaceCard>
      <SurfaceCard>
        <h3 className="flex items-center gap-2 font-semibold">
          <CheckSquare className="h-4 w-4 text-teal" /> Evidence checklist
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          {checklist.map((c) => (
            <li key={c} className="flex gap-2">
              <input type="checkbox" className="mt-1 accent-primary" aria-label={c} />
              {c}
            </li>
          ))}
        </ul>
      </SurfaceCard>
      <SurfaceCard>
        <h3 className="flex items-center gap-2 font-semibold">
          <Gauge className="h-4 w-4 text-teal" /> Seriousness:{" "}
          <span
            className={
              s.level === "High"
                ? "text-destructive"
                : s.level === "Medium"
                  ? "text-warning-foreground"
                  : "text-success"
            }
          >
            {s.level}
          </span>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          General rules-based guidance — not a validated assessment or AI score.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {s.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </SurfaceCard>
      {s.level === "High" && (
        <SurfaceCard className="border-primary md:col-span-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="h-4 w-4 text-primary" /> Possible legal-aid referral
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Your District Legal Services Authority (DLSA) may offer free legal aid to eligible
            people. Contact your local DLSA office to check eligibility. Confirm the process with an
            official source.
          </p>
        </SurfaceCard>
      )}
    </div>
  );
}

function RightsPage() {
  return (
    <>
      <PageHeader
        title="Rights Companion"
        description="For tenants and gig workers. One question at a time."
      />
      <GuidedFlow
        storageKey="nyaysetu.draft.rights"
        initialAnswerId="issueSummary"
        questions={questions}
        buildDocument={buildNotice}
        renderResult={Result}
        documentTitle="Notice Draft"
        onCreateCase={(a, documentContent) => {
          const id = createCase({
            type: "rights",
            title: `${label(questions[0]!, a["category"])}${a["otherParty"] || a["platform"] ? ` — ${a["otherParty"] || a["platform"]}` : ""}`,
            summary:
              a["issueSummary"] ||
              a["issueType"] ||
              `Draft about ${label(questions[0]!, a["category"]).toLowerCase()}`,
            authorityId: "auth_dlsa",
            documentTitle: "Notice draft",
            documentKind: "complaint",
            dueInDays: 15,
            documentContent,
          });
          return id;
        }}
      />
    </>
  );
}
