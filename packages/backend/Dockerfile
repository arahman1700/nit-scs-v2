# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build all packages ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
COPY packages/frontend/ packages/frontend/
RUN pnpm --filter @nit-scs-v2/shared build
RUN pnpm --filter @nit-scs-v2/frontend build
RUN cd packages/backend && npx prisma generate
RUN pnpm --filter @nit-scs-v2/backend build
# Compile seed script separately (rootDir is src/ so seed.ts is excluded from normal build)
RUN cd packages/backend && npx tsc --esModuleInterop --module nodenext --moduleResolution nodenext --outDir dist/seed --rootDir prisma prisma/seed.ts --skipLibCheck

# ── Stage 3: Production runtime ──
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy everything needed from the build stage
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/backend/prisma packages/backend/prisma
COPY --from=build /app/packages/backend/package.json packages/backend/package.json
COPY --from=build /app/packages/backend/node_modules packages/backend/node_modules

# Copy compiled frontend
COPY --from=build /app/packages/frontend/dist packages/frontend/dist

# Copy data directory for settings
COPY packages/backend/data packages/backend/data

# Copy startup script
COPY packages/backend/start.sh packages/backend/start.sh

WORKDIR /app/packages/backend
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "start.sh"]
