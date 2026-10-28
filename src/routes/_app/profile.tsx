import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/common";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — NyaySetu" }, { name: "description", content: "Your account details and preferences." }, { property: "og:title", content: "Profile — NyaySetu" }, { property: "og:description", content: "Your account details and preferences." }] }),
  component: () => <Placeholder title="Profile" description="Your account details and preferences." />,
});
