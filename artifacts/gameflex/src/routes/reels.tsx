// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/social/Reels";
export const Route = createFileRoute("/reels")({
  head: () =>
    pageSeo({
      title: "Reels — Short Gaming Clips | GameFlex",
      description:
        "Scroll the best short-form gameplay clips uploaded by GameFlex creators.",
    }),
  component: Page,
});