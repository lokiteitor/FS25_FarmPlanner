# syntax=docker/dockerfile:1

# Base limpia de Alpine. Bun se instala manualmente (variante musl).
# No se usa la imagen oven/bun.
FROM alpine:3.20 AS runtime
WORKDIR /app

# Libs que necesita el binario musl de bun + utilidades para instalarlo.
# BusyBox (incluido en Alpine) ya trae wget — usado por el healthcheck.
RUN apk add --no-cache bash libstdc++ libgcc curl unzip

# Instalar bun (el instalador detecta Alpine/musl automáticamente).
# Para builds reproducibles fija la versión:
#   docker build --build-arg BUN_VERSION=1.x.y ...
# Por defecto instala la última versión estable.
ARG BUN_VERSION=latest
ENV BUN_INSTALL=/usr/local
RUN if [ "$BUN_VERSION" = "latest" ]; then \
      curl -fsSL https://bun.sh/install | bash; \
    else \
      curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"; \
    fi
# El instalador pone el binario en $BUN_INSTALL/bin/bun (/usr/local/bin/bun).

# Instalar dependencias (incluye pm2 y @node-rs/argon2 con binarios precompilados).
# Sin compilación nativa: no hace falta python3/make/g++.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Código fuente y configuración de procesos pm2.
# Los .sql de migraciones ya viven en src/db/migrations/ — bun los resuelve
# con __dirname sin necesidad del copiado frágil del paso tsc → dist/.
COPY tsconfig*.json ./
COPY src ./src
COPY ecosystem.config.cjs ./

# Usuario no-root. pm2 escribe en $PM2_HOME dentro del contenedor.
RUN addgroup -S app && adduser -S -G app app
ENV PM2_HOME=/home/app/.pm2
RUN chown -R app:app /app /home/app
USER app

EXPOSE 3000

# docker-compose sobreescribe este CMD para inyectar migrate+seed antes de
# arrancar, o para seleccionar --only worker.
CMD ["bunx", "pm2-runtime", "start", "ecosystem.config.cjs", "--only", "api"]
