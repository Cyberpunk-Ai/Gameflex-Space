// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/FairPlay";

export const Route = createFileRoute("/fair-play")({
  head: () =>
    pageSeo({
      title: "Fair Play Policy | GameFlex",
      description:
        "How GameFlex detects cheating, enforces anti-smurf rules and keeps competition fair for everyone.",
    }),
  component: Page,
});
