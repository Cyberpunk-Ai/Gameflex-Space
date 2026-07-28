// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Report";

export const Route = createFileRoute("/report")({
  head: () =>
    pageSeo({
      title: "Report a Player or Match | GameFlex",
      description:
        "Submit evidence of cheating, abuse or payment issues for review by our moderation team.",
    }),
  component: Page,
});
