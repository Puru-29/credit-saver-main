import { ScrollText, Shield, Wrench } from "lucide-react";

export const MODULES = [
  {
    to: "/rti",
    icon: ScrollText,
    t: "RTI Assistant",
    d: "Organize an information request and prepare text for your review.",
  },
  {
    to: "/rights",
    icon: Shield,
    t: "Rights Companion",
    d: "Explore general information for wages, tenancy, consumer and other rights concerns.",
  },
  {
    to: "/civic-fix",
    icon: Wrench,
    t: "Civic Fix",
    d: "Record a local civic issue and prepare a complaint draft for review.",
  },
] as const;
