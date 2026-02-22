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
# Compile seed scripts separately (rootDir is src/ so prisma/*.ts is excluded from normal build)
RUN cd packages/backend && npx tsc --esModuleInterop --module nodenext --moduleResolution nodenext --outDir dist/seed --rootDir prisma prisma/seed.ts prisma/seed-templates.ts prisma/seed-data.ts prisma/seed-semantic-layer.ts --skipLibCheck || echo "Seed compilation warning (non-fatal)"

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

# Copy startup script
COPY packages/backend/start.sh packages/backend/start.sh
RUN chmod +x packages/backend/start.sh

# Create writable directories before switching to non-root
RUN mkdir -p /app/packages/backend/uploads

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app/packages/backend/uploads
USER nodejs

WORKDIR /app/packages/backend
ENV NODE_ENV=production
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["sh", "start.sh"]
