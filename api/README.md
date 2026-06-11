# FS25 Farm Planner API

REST backend for FS25 Farm Planner. Node.js 22 + TypeScript (strict) + Fastify 5,
PostgreSQL 18 (Drizzle ORM), Redis 7 / BullMQ (infra ready, no business jobs in v1).

Base path: `/api/v1`. Health probe: `GET /api/v1/health`.

## Requirements

- Node.js >= 22

## Setup

```bash
npm install
cp .env.example .env   # then edit secrets
```

## Development

```bash
npm run dev          # API with hot reload (tsx watch)
npm run worker:dev   # BullMQ worker with hot reload (no jobs in v1)
```

## Build & run

```bash
npm run build        # tsc -> dist/
npm run start        # node dist/server.js
npm run worker       # node dist/worker.js
```

## Quality

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run
npm run test:watch   # vitest watch
```

## Database (Drizzle)

```bash
npm run db:generate  # generate migrations from schema
npm run db:migrate   # apply migrations
npm run db:seed      # seed catalog data
```

## Environment variables

See `.env.example`. dotenv is only loaded when `NODE_ENV !== production`
(in production the environment is injected by Docker Compose).

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `API_PORT` | `3000` | HTTP listen port (binds `0.0.0.0`) |
| `DATABASE_URL` | `postgres://fs25_planner:fs25_planner@postgres:5432/fs25_planner` | PostgreSQL connection string |
| `JWT_SECRET` | `change-me-...` | Secret for signing access tokens (override in prod) |
| `ACCESS_TOKEN_TTL` | `900` | Access token lifetime (seconds) |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime (days) |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string (BullMQ) |
| `RATE_LIMIT_MAX` | `10` | Max requests per window on auth endpoints |
| `RATE_LIMIT_WINDOW` | `1 minute` | Rate-limit window |
| `ENABLE_TOKEN_CLEANUP` | `false` | Enable periodic refresh-token cleanup job (H5.2) |
| `LOG_LEVEL` | `info` | pino log level |
| `CORS_ORIGIN` | _(empty)_ | Allowed CORS origin(s); empty = none |

## Docker

The `Dockerfile` is multi-stage (build TS -> `node:22-alpine` runtime). The
`worker` service reuses the same image with `command: ["node", "dist/worker.js"]`.
Only `nginx` publishes ports; the API listens internally on `:3000`.
