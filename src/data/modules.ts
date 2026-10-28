import { ScrollText, Shield, Wrench } from "lucide-react";

export const MODULES = [
  { to: "/rti", icon: ScrollText, t: "RTI Assistant", d: "Draft a Right to Information application and track the 30-day reply window." },
  { to: "/rights", icon: Shield, t: "Rights Companion", d: "Understand procedural options for wages, tenancy, consumer and other rights issues." },
  { to: "/civic-fix", icon: Wrench, t: "Civic Fix", d: "Report potholes, streetlights or waste problems to a possible responsible office." },
] as const;
