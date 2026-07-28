// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/social/Explore";
export const Route = createFileRoute("/explore")({
  head: () =>
    pageSeo({
      title: "Explore Players, Clips & Teams | GameFlex",
      description:
        "Discover trending creators, highlight reels and rising teams across the GameFlex community.",
    }),
  component: Page,
});