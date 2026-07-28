// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/FAQs";

export const Route = createFileRoute("/faqs")({
  head: () =>
    pageSeo({
      title: "Frequently Asked Questions | GameFlex",
      description:
        "Answers about entry fees, payouts, tournament rules, verification and account security.",
    }),
  component: Page,
});
