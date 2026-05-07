# FlowTrack

A focused project management web app for small teams. Create projects, assign tasks, track progress, and manage team roles.

## Features

- **Authentication** — Sign up / sign in via email or Google (powered by Clerk)
- **Dashboard** — Stats overview, task breakdown by status and priority, recent activity feed
- **Projects** — Create and manage projects; view progress at a glance
- **Kanban board** — Drag tasks across Todo, In Progress, In Review, and Done columns
- **Task management** — Create tasks with title, description, priority, assignee, and due date
- **My Tasks** — Cross-project view of all tasks assigned to you, with filters and sorting
- **Team management** — Invite members by email; assign Admin or Member roles
- **Role-based access** — Admins manage projects and members; enforced on both client and server

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS v4, shadcn/ui, Wouter, TanStack Query |
| Backend | Express 5, Node.js 24, TypeScript 5.9 |
| Database | PostgreSQL, Drizzle ORM |
| Auth | Clerk (whitelabel) |
| Validation | Zod v4, drizzle-zod |
| API | OpenAPI spec, Orval codegen |
| Monorepo | pnpm workspaces |

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL database

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (frontend) |
| `SESSION_SECRET` | Session secret |

### Running Locally

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (port 18497)
pnpm --filter @workspace/project-manager run dev
```

### Other Commands

```bash
# Full typecheck
pnpm run typecheck

# Build all packages
pnpm run build

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

> After running codegen, reset `lib/api-zod/src/index.ts` to only `export * from "./generated/api";` — codegen regenerates it with both exports, causing duplicate export errors.

## Project Structure

```
.
├── artifacts/
│   ├── api-server/          # Express API server
│   └── project-manager/     # React frontend
├── lib/
│   ├── api-spec/            # OpenAPI spec (source of truth)
│   ├── api-client-react/    # Generated TanStack Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle schema and client
└── scripts/                 # Utility scripts
```

## Architecture Notes

- **Contract-first**: The OpenAPI spec in `lib/api-spec/openapi.yaml` drives codegen for both the frontend hooks and the Zod validation schemas.
- **Clerk proxy**: The API server proxies Clerk auth at `/api/__clerk` so the frontend only needs one domain.
- **Role-based access**: Admin/Member roles are stored per-project in the `project_members` table and enforced in every route handler.
- **Activity feed**: Significant actions (task changes, member invites, project creation) are recorded in the `activity` table and shown on the dashboard.
