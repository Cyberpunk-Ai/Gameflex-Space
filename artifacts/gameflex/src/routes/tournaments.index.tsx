// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Tournaments";

export const Route = createFileRoute("/tournaments/")({
  head: () =>
    pageSeo({
      title: "Esports Tournaments | GameFlex",
      description:
        "Browse open tournaments by game, entry fee and prize pool, then register your squad.",
    }),
  component: Page,
});
