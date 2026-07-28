// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Auth";

export const Route = createFileRoute("/auth")({
  head: () =>
    pageSeo({
      title: "Sign In or Create an Account | GameFlex",
      description:
        "Log in or register to join tournaments, chat with players and track your competitive progress.",
      noindex: true,
    }),
  component: Page,
});
