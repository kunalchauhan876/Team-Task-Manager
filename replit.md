# FlowTrack

A focused project management web app for small teams — create projects, assign tasks, track progress, and manage team roles (Admin/Member).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/project-manager run dev` — run the frontend (port 18497)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (after codegen, reset `lib/api-zod/src/index.ts` to export only from `./generated/api`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, Wouter, TanStack Query
- Auth: Clerk (Replit-managed, whitelabel)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle table definitions (users, projects, project_members, tasks, activity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/project-manager/src/` — React frontend

## Architecture decisions

- Contract-first: OpenAPI spec gates codegen which gates frontend type safety
- Clerk proxy: API server proxies Clerk auth at `/api/__clerk` so the frontend doesn't need a separate Clerk domain
- Role-based access: Admin/Member roles stored per-project in `project_members` table; enforced in API route handlers
- Activity feed: Every significant action (task create/update/complete, member add, project create) is recorded in the `activity` table for the dashboard
- api-zod index: After codegen, `lib/api-zod/src/index.ts` must only export from `./generated/api` (not `./generated/types`) to avoid duplicate export conflicts

## Product

- Landing page for unauthenticated users with CTA to sign up/sign in
- Dashboard: stats cards, task breakdown by status/priority, my tasks list, recent activity feed
- Projects: list all projects with progress bars; create new projects; project detail with Kanban board
- Task management: create, assign, update status, set priority and due dates
- Team management: invite members by email, assign Admin/Member roles (Admin only)
- My Tasks: cross-project view of all tasks assigned to current user
- Settings: update user profile

## User preferences

- No emojis in UI
- Role-based access enforced both client and server side

## Gotchas

- After running codegen, ALWAYS reset `lib/api-zod/src/index.ts` to only `export * from "./generated/api";` — codegen regenerates it with both exports causing TS2308 duplicate export errors
- Clerk dev keys warning in browser console is expected in development; not a bug
- The Clerk proxy middleware must be mounted BEFORE body parsers in app.ts (streams raw bytes)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
