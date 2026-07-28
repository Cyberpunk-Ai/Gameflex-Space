// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Refund";

export const Route = createFileRoute("/refund")({
  head: () =>
    pageSeo({
      title: "Refund Policy | GameFlex",
      description:
        "When entry fees and marketplace purchases are refundable, and how to request a refund.",
    }),
  component: Page,
});
