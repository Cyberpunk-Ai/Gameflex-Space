// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/AdminDashboard";

export const Route = createFileRoute("/admin/")({
  head: () =>
    pageSeo({
      title: "Admin Overview | GameFlex",
      description:
        "Platform-wide metrics, alerts and moderation queues for GameFlex administrators.",
      noindex: true,
    }),
  component: Page,
});
