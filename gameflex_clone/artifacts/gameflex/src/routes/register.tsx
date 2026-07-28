// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Register";

export const Route = createFileRoute("/register")({
  head: () =>
    pageSeo({
      title: "Create Your GameFlex Account",
      description:
        "Register in seconds to compete in tournaments, join teams and earn rewards on GameFlex.",
      noindex: true,
    }),
  component: Page,
});
