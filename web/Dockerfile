# FS25 Farm Planner Web — standalone static artifact / preview builder.
#
# NOTE: Production deployment uses docker/nginx (the shared compose service),
# which serves the SPA static build AND proxies /api to the api service. This
# Dockerfile is the self-contained static artifact builder used for previewing
# the frontend in isolation; it bundles a minimal nginx with SPA fallback only
# (no /api proxy). For the real topology see docs/arquitectura-api.md §4.

# ---------------------------------------------------------------------------
# Stage 1 — build the static SPA (nuxt generate -> .output/public)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies from lockfile first (better layer caching).
COPY package.json package-lock.json* ./
RUN npm ci

# Build the static site.
COPY . .
RUN npm run generate

# ---------------------------------------------------------------------------
# Stage 2 — serve the static artifact with a minimal nginx (SPA fallback)
# ---------------------------------------------------------------------------
FROM nginx:alpine AS final

# Minimal SPA config: gzip + history-mode fallback to /index.html.
RUN printf '%s\n' \
    'server {' \
    '    listen 80;' \
    '    server_name _;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    gzip on;' \
    '    gzip_types text/css application/javascript application/json image/svg+xml;' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

# Copy the generated static output.
COPY --from=build /app/.output/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
