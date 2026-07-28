// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Privacy";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageSeo({
      title: "Privacy Policy | GameFlex",
      description:
        "What data GameFlex collects, how it is used, and the controls you have over it.",
    }),
  component: Page,
});
