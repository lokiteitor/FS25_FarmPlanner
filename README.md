# FS25 Farm Planner

Aplicacion cliente-servidor para planificar granjas de **Farming Simulator 25**:
campos, establos/animales, maquinaria y calculadoras de produccion. Es la
evolucion del prototipo `planner/` (SPA con persistencia en IndexedDB) hacia un
servicio multiusuario con cuentas, multiples partidas por usuario y catalogos del
juego versionables sin redesplegar.

## Arquitectura

El sistema se despliega con **Docker Compose** detras de un proxy inverso nginx.
Solo nginx publica puertos al exterior; el resto de servicios viven en una red
interna (`fs25net`).

| Servicio   | Tecnologia                              | Responsabilidad                                                        |
|------------|-----------------------------------------|-----------------------------------------------------------------------|
| `nginx`    | nginx (alpine)                          | Proxy inverso, estaticos de la SPA, compresion, cabeceras de seguridad |
| `api`      | Node.js 22 + Fastify 5 + TypeScript     | API REST `/api/v1`: auth JWT, CRUD de dominio, catalogos               |
| `worker`   | Node.js 22 + BullMQ + TypeScript        | Procesador de jobs en background (preparado, sin jobs en v1)           |
| `postgres` | PostgreSQL 18                           | Persistencia (PK `uuidv7()` nativo)                                    |
| `redis`    | Redis 7                                 | Broker de colas BullMQ                                                 |

```
Navegador (SPA Nuxt 4)
        |  HTTP :80
        v
     [ nginx ] --/-------> estaticos (web/.output/public)
        |  --/api/-------> [ api :3000 ] --> [ postgres ]
                                          --> [ redis ]
                            [ worker ]    --> [ redis ] / [ postgres ]
```

Documentacion de referencia en [`docs/`](docs/):

- [`docs/arquitectura-api.md`](docs/arquitectura-api.md) - arquitectura del backend
- [`docs/arquitectura-frontend.md`](docs/arquitectura-frontend.md) - arquitectura del frontend (FSD)
- [`docs/base-de-datos.md`](docs/base-de-datos.md) - modelo de datos
- [`docs/autorizacion-api.md`](docs/autorizacion-api.md) - modelo de autorizacion
- [`docs/openapi.yaml`](docs/openapi.yaml) - contrato de la API (fuente de verdad)
- [`docs/seeds-catalogo.md`](docs/seeds-catalogo.md) - catalogos del juego (seed)
- [`docs/plan-implementacion.md`](docs/plan-implementacion.md) - plan por historias

## Estructura del repositorio

```
api/         # Backend Fastify + TypeScript (ver docs/arquitectura-api.md)
web/         # Frontend Nuxt 4 (SPA, ssr: false) con Feature-Sliced Design
docker/      # Infraestructura compartida (compose, nginx, .env.example)
docs/        # Documentacion de arquitectura y contrato
```

## Quick start (despliegue completo con Docker)

Requisitos: Docker + Docker Compose v2. PostgreSQL 18 es obligatorio (usa
`uuidv7()` nativo).

```bash
cp docker/.env.example docker/.env
# Editar docker/.env: cambiar POSTGRES_PASSWORD y JWT_SECRET en produccion.

docker compose -f docker/docker-compose.yml up --build
```

Al levantar, el servicio `api` aplica migraciones y seeds y arranca el servidor;
nginx sirve la SPA y hace proxy de `/api/`.

- Aplicacion: <http://localhost:80> (puerto configurable con `NGINX_HTTP_PORT`)
- Health de la API (via proxy): <http://localhost:80/api/v1/health>

Postgres y Redis **no** publican puertos: solo son accesibles dentro de la red
interna de Docker.

### Puertos

| Puerto        | Servicio | Expuesto al host |
|---------------|----------|------------------|
| 80            | nginx    | si (`NGINX_HTTP_PORT`) |
| 443           | nginx    | preparado (TLS comentado) |
| 3000          | api      | no (proxy interno) |
| 5432          | postgres | no |
| 6379          | redis    | no |

## Flujo de desarrollo

Para iterar con hot-reload se ejecutan API y frontend en local (el compose
construye imagenes de produccion):

- **API** (`api/`): `npm run dev` arranca Fastify con `tsx` en watch en el
  puerto `3000` (`/api/v1`). Necesita Postgres y Redis; pueden ser los de este
  compose publicando temporalmente sus puertos mediante un archivo
  `docker-compose.override.yml` no commiteado.
- **Web** (`web/`): `npm run dev` arranca Nuxt en `:3000` con hot-reload. La SPA
  llama a la base relativa `/api/v1`; en desarrollo se usa el proxy de Nuxt
  (`nitro.devProxy`) hacia la API local, evitando CORS. En produccion el proxy
  lo hace nginx.

Build estatico del frontend (lo realiza el Dockerfile de nginx):

```bash
cd web && npm run generate   # genera web/.output/public
```

## Convenciones

- TypeScript strict en `api/` y `web/`; ESLint + Prettier.
- API stateless; estado solo en Postgres/Redis.
- Autorizacion por propiedad (ownership), sin roles en v1; acceso ajeno -> `404`.
- Variables de entorno por `.env` (no commiteado) con `.env.example` versionado.

## Licencia

Ver [`LICENSE`](LICENSE).
