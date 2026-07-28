// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Contact";

export const Route = createFileRoute("/contact")({
  head: () =>
    pageSeo({
      title: "Contact the GameFlex Team",
      description:
        "Questions about tournaments, payouts or your account? Reach the GameFlex support team here.",
    }),
  component: Page,
});
