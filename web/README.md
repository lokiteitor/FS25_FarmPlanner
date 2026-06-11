# FS25 Farm Planner — Web

Frontend SPA for FS25 Farm Planner: a Nuxt 4 (`ssr: false`) single-page app with
Pinia, Sass (SCSS) and a Feature-Sliced Design (FSD) structure. It consumes the
REST API at `/api/v1` (proxied by nginx in production, by Nuxt's dev proxy in
development).

See the architecture spec in `docs/arquitectura-frontend.md` and the plan in
`docs/plan-implementacion.md` (stories H1, H6, H7).

## Requirements

- Node.js >= 22

## Scripts

```bash
npm install        # install deps (runs `nuxt prepare` via postinstall)
npm run dev        # dev server with HMR; /api proxied to http://localhost:3000/api
npm run build      # server build
npm run generate   # static SPA build -> .output/public  (artifact served by nginx)
npm run preview    # preview the production build
npm run typecheck  # vue-tsc type checking
npm run lint       # eslint (flat config from @nuxt/eslint)
npm run test       # vitest run
```

The dev server expects the API to be reachable at `http://localhost:3000`
(`nitro.devProxy` forwards `/api` there). The runtime API base is `/api/v1`
(`runtimeConfig.public.apiBase`).

## Build output

`npm run generate` emits the static site to `web/.output/public`. In production
that directory is served by the shared `nginx` service (see `docker/`), which
also proxies `/api`. The local `Dockerfile` is a standalone artifact/preview
builder (SPA fallback only, no API proxy).

## Project structure (Feature-Sliced Design)

Nuxt 4 uses `app/` as `srcDir`, so `~` resolves to `web/app`. The FSD layers live
directly under `app/`. Each layer may only import from layers below it.

```
web/
├── app/
│   ├── app.vue                # root component
│   ├── app/                   # FSD "app" layer: providers, router guards, styles
│   │   ├── providers/         #   Pinia + plugins (H6.1/H6.2)
│   │   ├── router/            #   auth middleware (H6.3)
│   │   └── styles/            #   _variables.scss, _mixins.scss, main.scss (ADR-F05)
│   ├── pages/                 # FSD "pages" layer (Nuxt route directory)
│   │   └── index.vue          #   dashboard placeholder
│   ├── widgets/               # FSD "widgets"  -> ~/widgets
│   ├── features/              # FSD "features" -> ~/features
│   ├── entities/              # FSD "entities" -> ~/entities
│   └── shared/                # FSD "shared"   -> ~/shared (http client, ui-kit, engine)
├── public/                    # static assets copied verbatim (favicon, etc.)
├── nuxt.config.ts
├── Dockerfile                 # standalone static artifact / preview builder
└── package.json
```

| Layer      | Responsibility |
|------------|----------------|
| `app`      | Initialization: Nuxt config/plugins, Pinia providers, auth guards, global SCSS |
| `pages`    | Route composition; assemble widgets/features, no business logic |
| `widgets`  | Self-contained UI blocks (sidebar, comparison table, summaries, calculator panels) |
| `features` | User-facing interactions (login, field CRUD, farm switcher, ...) |
| `entities` | Domain models: types, Pinia stores and api-clients per entity |
| `shared`   | Domain-agnostic code: base HTTP client, ui-kit, calculation engine |

Key architectural decisions: SPA static (ADR-F01), FSD over Nuxt 4 (ADR-F02),
access token in memory + refresh in localStorage (ADR-F03), parametrized
calculation engine (ADR-F04), SCSS design tokens (ADR-F05), Pinia (ADR-F06).

This is the H1 scaffolding. The HTTP client, auth screens, ui-kit, calculation
engine and domain pages are added in H6 and H7.
