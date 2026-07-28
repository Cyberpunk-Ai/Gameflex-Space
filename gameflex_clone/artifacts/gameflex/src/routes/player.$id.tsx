// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/PlayerProfile";

export const Route = createFileRoute("/player/$id")({
  head: () =>
    pageSeo({
      title: "Player Profile | GameFlex",
      description:
        "Match history, win rate, earnings, badges and team affiliations for this GameFlex player.",
    }),
  component: Page,
});
