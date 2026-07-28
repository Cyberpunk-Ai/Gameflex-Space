// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Achievements";

export const Route = createFileRoute("/achievements")({
  head: () =>
    pageSeo({
      title: "Achievements & Badges | GameFlex",
      description:
        "Track every badge, milestone and trophy you have unlocked across GameFlex tournaments and matches.",
    }),
  component: Page,
});
