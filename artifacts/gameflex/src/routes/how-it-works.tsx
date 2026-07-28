// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/HowItWorks";

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    pageSeo({
      title: "How GameFlex Works",
      description:
        "From registration to payout — a step-by-step guide to competing and earning on GameFlex.",
    }),
  component: Page,
});
