import { describe, expect, it } from "vitest";
import { assessSeriousness } from "./rights-rules";

describe("seriousness rules", () => {
  it("eviction with lost income is High", () => {
    expect(assessSeriousness({ category: "eviction", income: "yes" }).level).toBe("High");
  });
  it("small deposit with no written contact is Low", () => {
    expect(assessSeriousness({ category: "deposit", deposit: "5000", communication: "none", evidence: "receipt" }).level).toBe("Low");
  });
});
