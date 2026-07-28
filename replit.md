# GameFlex

Kenya's premier gaming tournament platform — compete, win, and earn with M-Pesa payments.

## Run & Operate

- `pnpm --filter @workspace/gameflex run dev` — run the frontend (port 20405, preview path `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + TanStack Router + Tailwind CSS v4 + framer-motion
- Backend: Express 5
- DB: Supabase (PostgreSQL) — accessed directly from the frontend via `@supabase/supabase-js`
- Auth: Supabase Auth (via `AuthProvider` in `src/lib/auth-context.tsx`)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)

## Where things live

- `artifacts/gameflex/src/` — all frontend source
  - `routes/` — TanStack Router file-based routes (auto-generates `routeTree.gen.ts`)
  - `pages/` — page components imported by routes
  - `components/` — shared components (UI, social, messaging, layout…)
  - `features/` — domain-scoped hooks and types
  - `integrations/supabase/` — Supabase client + generated types
  - `lib/` — auth context, router compat shim, utilities
  - `styles.css` — global styles + dark-mode theme tokens (entry point)
- `gameflex_clone/` — original cloned repo (reference only, not served)

## Architecture decisions

- **Supabase-first**: All data (stories, posts, likes, comments, follows) lives in Supabase tables; the frontend queries Supabase directly via the anon key. The Express API server is available for any server-side features that need it.
- **Dark-only**: `main.tsx` adds `dark` class to `<html>` at startup; no light mode toggle.
- **TanStack Router file-based routing**: Routes live in `src/routes/`. The `routeTree.gen.ts` is auto-generated — never edit it manually.
- **Stories as `user_statuses`**: Stories and regular posts both live in the `user_statuses` table. Text stories encode their gradient in `media_type` as `text:<gradientId>`.
- **Stats columns**: `user_statuses` has `likes_count` and `comments_count` columns (updated by DB triggers) used for display; actual likes/comments are in `status_likes` / `status_comments` tables.

## Product

- **Home** — landing page with stats, how-it-works, CTA
- **Social** (`/social`) — Instagram-style feed with Stories rail, post creation, For You / Trending / Following tabs
- **Stories** (`/stories/`) — Community grid + **My Stories** tab with per-story stats (likes, comments, time remaining), edit (text stories) and delete
- **Reels, Explore, Search, Messages, Notifications, Profile**
- **Tournaments, Leaderboard, Marketplace, Wallet, Achievements, Game Rooms**
- **Admin** (`/admin`) — full admin dashboard (users, tournaments, payments, analytics…)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Supabase credentials are hardcoded in `src/integrations/supabase/client.ts` as fallback values; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars to override.
- Stories page auth-guards unauthenticated users to `/login` — the "blank" page on direct nav is expected; social page works as a guest.
- After changing routes, TanStack Router regenerates `routeTree.gen.ts` automatically via the Vite plugin.
- `gameflex_clone/` artifacts and workflows were registered as side effects of cloning — ignore those workflows; only `artifacts/gameflex: web` is the live app.
