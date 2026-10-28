import { describe, expect, it } from "vitest";
import { caseService, createCase, documentService } from "@/services/mock-service";

const makeCase = (type: "rti" | "rights" | "civic_fix" = "rti") =>
  createCase({
    type,
    title: "Mock service workflow test",
    summary: "A test-only mock case.",
    authorityId: "auth_bbmp",
    documentTitle: "Workflow test draft",
    documentKind: "application",
    dueInDays: 10,
  });

describe("mock case-management workflows", () => {
  it("records valid state transitions and rejects invalid ones", async () => {
    const id = makeCase();
    expect((await caseService.get(id))?.status).toBe("drafted");
    caseService.transition(id, "awaiting_review");
    caseService.transition(id, "submitted");
    expect((await caseService.get(id))?.status).toBe("submitted");
    expect((await caseService.events(id)).some((event) => event.type === "status_change")).toBe(
      true,
    );
    expect(() => caseService.transition(id, "drafted")).toThrow("Cannot change case status");
  });

  it("simulates a breach, records the audit event and prepares an RTI appeal draft", async () => {
    const id = makeCase("rti");
    caseService.simulateDeadlineBreach(id);
    expect((await caseService.get(id))?.status).toBe("deadline_breached");
    const escalation = (await caseService.escalations(id))[0];
    expect(escalation?.level).toBe("first_appeal");
    expect(
      (await caseService.events(id)).some(
        (event) => event.title === "Simulated deadline breach — demo only",
      ),
    ).toBe(true);
    if (!escalation) throw new Error("The demo escalation was not created");
    caseService.approveEscalation(escalation.id);
    expect((await caseService.get(id))?.status).toBe("deadline_breached");
    expect((await caseService.escalations(id))[0]?.status).toBe("approved");
    expect(
      (await caseService.events(id)).some((event) => event.title.includes("not submitted")),
    ).toBe(true);
    expect(
      (await documentService.list()).some(
        (doc) => doc.caseId === id && doc.title === "Sample first-appeal draft",
      ),
    ).toBe(true);
  });

  it("creates a related sample RTI case from an unresolved Civic Fix case", async () => {
    const parentId = makeCase("civic_fix");
    const childId = caseService.createRelatedRti(parentId);
    const child = await caseService.get(childId);
    const parent = await caseService.get(parentId);
    expect(child?.parentCaseId).toBe(parentId);
    expect(child?.type).toBe("rti");
    expect(parent).not.toBeNull();
    if (!parent) throw new Error("The parent case was not found");
    expect((await caseService.related(parent)).some((item) => item.id === childId)).toBe(true);
    expect(() => caseService.createRelatedRti(parentId)).toThrow("already exists");
  });

  it("saves editable document versions in shared mock data", async () => {
    const caseId = makeCase();
    const doc = (await documentService.list()).find((item) => item.caseId === caseId);
    expect(doc).toBeDefined();
    if (!doc) throw new Error("The test document was not created");
    documentService.save(doc.id, "Updated sample draft");
    const saved = await documentService.get(doc.id);
    expect(saved?.content).toBe("Updated sample draft");
    expect(saved?.versions?.[0]?.content).toBe("Updated sample draft");
  });

  it("uses the reviewed guided-flow content for the shared mock document", async () => {
    const id = createCase({
      type: "rti",
      title: "Reviewed title",
      summary: "Reviewed summary",
      authorityId: "auth_bbmp",
      documentTitle: "Reviewed draft",
      documentKind: "application",
      dueInDays: 30,
      documentContent: "User-reviewed demo content",
    });
    const doc = (await documentService.list()).find((item) => item.caseId === id);
    expect(doc?.content).toBe("User-reviewed demo content");
    expect(doc?.versions?.[0]?.content).toBe("User-reviewed demo content");
  });

  it("requires a reviewed, locally approved escalation before the demo Escalated status", async () => {
    const id = makeCase("rti");
    caseService.simulateDeadlineBreach(id);
    caseService.transition(id, "escalation_draft_ready");
    expect(() => caseService.transition(id, "escalated")).toThrow("approve an escalation draft");
    const escalation = (await caseService.escalations(id))[0];
    if (!escalation) throw new Error("The demo escalation was not created");
    caseService.approveEscalation(escalation.id);
    caseService.transition(id, "escalated");
    expect((await caseService.get(id))?.status).toBe("escalated");
  });
});
