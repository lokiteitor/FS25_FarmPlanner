# =============================================================================
# nginx - proxy inverso + estaticos de la SPA Nuxt
# -----------------------------------------------------------------------------
# Contexto de build: RAIZ DEL REPOSITORIO (ver docker-compose.yml -> nginx.build.
# context: ".."). Esto permite copiar web/ para generar el build estatico.
#
# Multi-stage:
#   1) web-build : node:22-alpine -> "nuxt generate" -> /app/.output/public
#   2) runtime   : nginx:alpine sirviendo esos estaticos + proxy /api/.
# =============================================================================

# --- Stage 1: build estatico del frontend Nuxt -------------------------------
FROM node:22-alpine AS web-build

WORKDIR /app

# Capa de dependencias cacheable: solo se invalida si cambian los manifests.
COPY web/package*.json ./
RUN npm ci

# Resto del codigo fuente del frontend.
COPY web/ ./

# Genera la SPA estatica en /app/.output/public (Nuxt 4, ssr: false).
RUN npm run generate

# --- Stage 2: runtime nginx --------------------------------------------------
FROM nginx:alpine AS runtime

# Configuracion de nginx (proxy + SPA fallback + cabeceras de seguridad).
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Estaticos generados por el stage anterior.
COPY --from=web-build /app/.output/public /usr/share/nginx/html

EXPOSE 80
# EXPOSE 443   # Descomentar al habilitar el bloque TLS en nginx.conf.

# La imagen base de nginx ya define un CMD que arranca nginx en foreground.
