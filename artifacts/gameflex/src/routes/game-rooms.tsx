// @ts-nocheck
import { pageSeo } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/GameRooms";

export const Route = createFileRoute("/game-rooms")({
  head: () =>
    pageSeo({
      title: "Live Game Rooms | GameFlex",
      description:
        "Browse open lobbies, join custom rooms and squad up with players at your skill level.",
    }),
  component: Page,
});
