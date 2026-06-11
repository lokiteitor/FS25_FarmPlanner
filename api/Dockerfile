# syntax=docker/dockerfile:1

# --- Build stage: compile TypeScript to dist/ --------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install full deps (including dev) for the build.
COPY package*.json ./
RUN npm ci

# Compile the sources.
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies so the runtime stage copies a lean node_modules.
RUN npm prune --omit=dev

# --- Runtime stage: minimal image running the compiled output ----------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

USER node
EXPOSE 3000

# The `worker` service reuses this exact image with a command override:
#   command: ["node", "dist/worker.js"]
CMD ["node", "dist/server.js"]
