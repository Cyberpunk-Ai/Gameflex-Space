// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Support";

export const Route = createFileRoute("/support")({
  head: () =>
    pageSeo({
      title: "Support Center | GameFlex",
      description:
        "Open a ticket, track existing requests and get help with your GameFlex account.",
    }),
  component: Page,
});
