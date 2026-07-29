// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { createLazyPage } from "@/lib/lazy-page";

const Page = createLazyPage(() => import("@/pages/Home"));

export const Route = createFileRoute("/")({
  head: () =>
    pageSeo({
      title: "GameFlex — Compete in Esports Tournaments & Win",
      description:
        "Join GameFlex to enter competitive gaming tournaments, climb the leaderboard, join teams and earn real rewards.",
    }),
  component: Page,
});
