// Simulated demo analysis. Shape mirrors a future FastAPI response (MLPrediction-like).
export const CIVIC_CATEGORIES = [
  { value: "pothole", label: "Pothole / damaged road", dept: ["auth_bbmp_roads", "auth_bbmp"] },
  { value: "drain", label: "Overflowing drain", dept: ["auth_bwssb", "auth_bbmp"] },
  { value: "waste", label: "Waste accumulation", dept: ["auth_bbmp_swm", "auth_bbmp"] },
  { value: "streetlight", label: "Broken streetlight", dept: ["auth_bescom", "auth_bbmp"] },
  { value: "infrastructure", label: "Damaged public infrastructure", dept: ["auth_bbmp", "auth_bbmp_roads"] },
] as const;

export interface DemoAnalysis { category: string; confidence: number; severity: "Low" | "Medium" | "High"; severityReason: string; model: "demo-rules-v0" }

export function simulateAnalysis(category: string, description: string): DemoAnalysis {
  const d = description.toLowerCase();
  const urgent = /(accident|injur|child|school|hospital|flood|deep|dark|night|week)/.test(d);
  const severity = urgent ? "High" : category === "pothole" || category === "drain" ? "Medium" : "Low";
  const severityReason = urgent
    ? "Your description mentions a safety risk or a long-standing problem."
    : severity === "Medium" ? "This category commonly affects traffic or health." : "No urgent risk words found in your description.";
  return { category, confidence: urgent ? 0.82 : 0.68, severity, severityReason, model: "demo-rules-v0" };
}
