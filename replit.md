# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Horario Secretarias — App Features

**artifacts/horario-secretarias**: Web app for school schedule management for secretaries.
- **Campus**: TEMUCO (Las Encinas + Inés de Suárez), D. Almagro, Villarrica, Av. Alemania
- **Dynamic Campuses**: New `schedule_horarios` DB table; campuses/sedes managed via Admin → Gestionar Campus; new ones added via API `POST /api/horarios`
- **Notification System**: `NotificationContext` stores notifications in localStorage per campus; `ToastContainer` shows 5-second alerts top-right when student removed or spot available; `/notificaciones` page shows full history with filters by type and sede, read/unread state, delete per-item or all
- **Notification Trigger**: `handleRemove` in `DetailPanel` (HorarioPage) fires `alumno_eliminado` on removal and `cupo_disponible` if new count < MAX_STUDENTS (8)
- **API**: `GET/POST /api/horarios`, `PUT /api/horarios/:id/sedes`, `DELETE /api/horarios/:id/sedes/:sedeName`, `DELETE /api/horarios/:id`
- **Capacity**: NORMAL_CAPACITY=7, MAX_STUDENTS=8; amber highlight for 8th student
- **Print Guides**: GuiasPage generates printable PDF-ready guides per campus/sede
- **Photo Export**: FotoPage generates 1920×1080 PNG for TV display per campus/day
- **Presence**: Real-time presence system shows active secretaries
- **Typing Indicators**: Shows when another user is typing in a class slot

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/horario-secretarias` (`@workspace/horario-secretarias`)

React + Vite + Tailwind CSS web app for school schedule management (Temuco 2026).

- Campuses: Las Encinas (7 salas) and Inés de Suárez (5 salas)
- Full weekly grid (Mon–Fri) with all time slots, like an Excel sheet
- Fetches live data from `/api/schedule` with 5-second polling for real-time collaboration
- Click any class cell to open a detail panel with add/remove student management
- Duplicate enrollment detection (warns if same student appears in same course type across both campuses)
- Design: DM Sans + Outfit fonts, purple/teal theme, glass navbar, rounded cards
- Drag-to-scroll on the grid (click suppression after drag to prevent accidental cell selection)
- Sticky "Horario" column with opaque background during horizontal scroll
- Dynamic sala columns per day (each day shows only as many columns as needed)
- Auto-seed from Excel on startup if DB has < 80 classes (picks newest file by mtime from attached_assets/)

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
