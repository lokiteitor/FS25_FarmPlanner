# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

```
api/    # Fastify 5 + TypeScript REST backend
web/    # Nuxt 4 SPA frontend (Feature-Sliced Design)
docker/ # Docker Compose, nginx config, .env.example
docs/   # Architecture docs, OpenAPI contract, DB model
```

`api/` and `web/` are independent projects (separate `package.json`, no workspaces). Always `cd api/` or `cd web/` before running their respective scripts.

## Commands

### API (`api/`)

El API corre TypeScript directamente con **bun** (sin compilar a `dist/`), gestionado
por **pm2** en Docker.

```bash
bun run dev          # hot-reload API en local (bun --watch, port 3000)
bun run worker:dev   # hot-reload BullMQ worker en local
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run (all tests)
npm run test:watch   # vitest watch
npm run db:generate  # drizzle-kit: generate migrations from schema
npm run db:migrate   # apply pending migrations (bun run src/db/migrate.ts)
npm run db:seed      # seed catalog data (bun run src/db/seed.ts)
```

### Web (`web/`)

```bash
npm run dev          # nuxt dev with hot-reload
npm run generate     # nuxt generate → web/.output/public (static SPA)
npm run typecheck    # nuxt typecheck
npm run lint         # eslint
npm run test         # vitest run
```

### Full stack (Docker Compose)

```bash
cp docker/.env.example docker/.env   # then edit secrets

# Producción (bun + pm2, sin watch):
docker compose -f docker/docker-compose.yml up --build
# App: http://localhost:80  |  API health: http://localhost:80/api/v1/health

# Desarrollo en Docker (bun + pm2 con watch — reinicia al editar src/):
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build

# Fijar versión de bun en el build (recomendado en producción):
docker compose -f docker/docker-compose.yml build --build-arg BUN_VERSION=1.x.y
```

### Running a single API test file

```bash
cd api && npx vitest run tests/db/schema.test.ts
```

## Architecture

### System topology

Only `nginx` is exposed to the host. Everything else communicates over the `fs25net` internal Docker network:

```
Browser (SPA)  →  nginx :80
                  ├── /       → static files (web/.output/public)
                  └── /api/*  → api :3000 → postgres :5432
                                           → redis    :6379
                  worker ← redis / postgres (BullMQ, infra-ready, no business jobs in v1)
```

### API layer architecture (`api/src/`)

Routes → Controllers → Services → Repositories — queries live **only** in repositories.

- **`plugins/auth`** — verifies JWT access token, decorates `request.user`. Every route is private by default; mark public with `{ config: { public: true } }`.
- **`plugins/farm-scope`** — for routes under `/farms/:farmId`, resolves the farm and verifies `farms.user_id === request.user.id`, then decorates `request.farm`. Ownership failures return `404` (ADR-005: never reveal existence of other users' resources).
- **`plugins/error-handler`** — maps zod errors → `422 VALIDATION_ERROR`, typed domain errors → their code/status, everything else → `500 INTERNAL_ERROR`.
- **`config/env.ts`** — zod-validated env; throws at boot if invalid or if `JWT_SECRET` is the default in production.
- **`app.ts`** — factory function used by both the HTTP server and the test harness.

### Frontend architecture (`web/app/`)

Nuxt 4 SPA (`ssr: false`) structured with **Feature-Sliced Design**. Layer import rule: each layer may only import from layers below it.

| Layer | Path | Purpose |
|---|---|---|
| `app` | `app/app/` | Nuxt providers, auth router guard, SCSS tokens/entry |
| `pages` | `app/pages/` | Nuxt route files; no business logic |
| `widgets` | `app/widgets/` | Self-contained UI blocks (sidebar, crop table, calculator panels) |
| `features` | `app/features/` | User-facing interactions (auth, farm-switcher, field-manage, …) |
| `entities` | `app/entities/` | Pinia stores + API clients per entity (farm, field, stable, machinery, catalog, user) |
| `shared` | `app/shared/` | HTTP client, ui-kit, **calculation engine** (`shared/lib/engine/`) |

Component auto-import is disabled (`components: { dirs: [] }`) — import explicitly via each slice's public `index.ts`.

### Calculation engine (`web/app/shared/lib/engine/`)

Pure functions: `f(catalog, farmContext, inputs) → results`. Ported from the `planner/` prototype. The engine **never** touches stores or the network — it receives catalog data (from `entities/catalog`) as arguments. Tests run without any network setup.

Files: `cropEngine.ts`, `animalEngine.ts`, `workSpeedEngine.ts`, `types.ts`.

### Database

PostgreSQL 18 is required (uses native `uuidv7()` for all PKs). Schema source of truth: `api/src/db/schema/` (Drizzle ORM). Migrations: `api/src/db/migrations/`. Catalog seeds: `api/src/db/seeds/`.

- Money/quantities: `numeric`, never `float`/`real`.
- All tables have `created_at` / `updated_at timestamptz`.
- `animal_calculator_configs` uses `inputs jsonb` discriminated by `species` enum; the zod union in `schemas/catalog.ts` is the enforcement layer.

### API contract

- Base path: `/api/v1`
- Source of truth: `docs/openapi.yaml`
- Swagger UI available at `/api/v1/docs` when the API is running
- Response envelope: `{ data, meta }` on success; `{ error: { code, message, details } }` on failure
- Ownership errors return `404`, not `403`
- Catalog endpoints carry `Cache-Control: public, max-age=86400`

### Auth flow

- Access token: JWT, ~15 min, in `Authorization: Bearer` header (stored in Pinia memory on the frontend)
- Refresh token: opaque 32-byte token, ~30 days, stored as SHA-256 hash in `refresh_tokens` table; rotated on each use with reuse detection (`REFRESH_TOKEN_REUSED` → revoke entire chain)
- Frontend: `shared/api` HTTP client handles `401 TOKEN_EXPIRED` → refresh → retry automatically

## Key conventions

- **TypeScript strict** in both `api/` and `web/`.
- **Zod schemas** are the single source for request/response validation and TypeScript types in the API — one schema, validated at runtime and typed at compile time.
- **Environment**: `docker/.env` (never committed). Defaults in `docker/.env.example`. The API reads env via `api/src/config/env.ts` (zod-validated); `dotenv` is only loaded when `NODE_ENV !== production`.
- **Dev proxy**: in `web/` dev mode, `nitro.devProxy` forwards `/api` to `http://localhost:3000/api` — no CORS handling needed. In production nginx does the proxy.
- **Integration tests** use Testcontainers (`@testcontainers/postgresql`) to spin up a real `postgres:18-alpine` — Docker must be running. Tests in `api/tests/db/` require Docker; `api/tests/health.test.ts` and domain tests are lighter.
- **Numeric precision**: the calculation engine uses JS `number` (floats); tests compare with tolerances, never strict equality.
- **FSD slices** expose their public API via `index.ts`; do not import internal files of another slice directly.
