# Deployment Guide

This guide covers deploying the NIT Supply Chain System to production.

## Table of Contents

1. [Render Deployment (Recommended)](#render-deployment-recommended)
2. [Docker Deployment](#docker-deployment)
3. [Local Docker](#local-docker)
4. [Post-Deployment Steps](#post-deployment-steps)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Troubleshooting](#troubleshooting)
7. [Production Checklist](#production-checklist)

---

## Render Deployment (Recommended)

Render.com provides free PostgreSQL and easy deployment from GitHub.

### Prerequisites

- GitHub account
- Render.com account (free tier available)
- Git repository pushed to GitHub

### One-Click Deployment

This project includes a `render.yaml` blueprint for automated deployment.

#### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

#### Step 2: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub
3. Authorize Render to access your repositories

#### Step 3: Deploy Blueprint

1. Click **New** → **Blueprint**
2. Select your GitHub repository
3. Render will detect `render.yaml` and preview the services:
   - **Web Service:** `nit-scs` (Docker container)
   - **Database:** `nit-scs-db` (PostgreSQL 15)
4. Click **Apply**

Render will:
1. Provision a free PostgreSQL database
2. Build your Docker image from `packages/backend/Dockerfile`
3. Set environment variables automatically
4. Start the web service

#### Step 4: Monitor Build

- Build takes ~5-10 minutes
- View build logs in the Render dashboard
- Wait for status: **Live**

#### Step 5: Access Your App

Your app will be available at:
```
https://nit-scs.onrender.com
```

**API Health Check:**
```
https://nit-scs.onrender.com/api/health
```

### render.yaml Configuration

**File:** `render.yaml` (project root)

```yaml
services:
  - type: web
    name: nit-scs
    runtime: docker
    dockerfilePath: packages/backend/Dockerfile
    dockerContext: .
    plan: free
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: nit-scs-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 15m
      - key: JWT_REFRESH_EXPIRES_IN
        value: 7d
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 4000
      - key: CORS_ORIGIN
        value: "*"

databases:
  - name: nit-scs-db
    plan: free
    databaseName: nit_scs
    user: nit_admin
```

**Key Features:**
- **Auto-generated secrets:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are randomly generated on first deploy
- **Database URL:** Automatically injected from the PostgreSQL service
- **Health checks:** Render pings `/api/health` to verify service is running
- **Free tier:** 750 hours/month web service + 90 days free PostgreSQL (then $7/month)

### Custom Environment Variables

To add custom environment variables:

1. Go to Render dashboard → Your service → **Environment**
2. Click **Add Environment Variable**
3. Enter key/value pairs
4. Click **Save Changes**
5. Service will automatically redeploy

**Important:** Do NOT commit secrets to `render.yaml`. Use `generateValue: true` or add via dashboard.

---

## Docker Deployment

The project includes a multi-stage Dockerfile for production builds.

### Dockerfile Overview

**File:** `packages/backend/Dockerfile`

**Three Stages:**

1. **deps** - Install all dependencies (Node 20 Alpine + pnpm)
2. **build** - Build all packages (shared → frontend → backend)
3. **runtime** - Production image with minimal dependencies

**Key Features:**
- Multi-stage build (small final image ~200MB)
- pnpm for efficient dependency management
- Prisma client generation
- Frontend built and served by backend (single container)
- Production-only dependencies in final stage
- Node 20 Alpine for minimal image size

**Dockerfile Structure:**

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json packages/
RUN pnpm install --frozen-lockfile

# Stage 2: Build all packages
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
COPY packages/frontend/ packages/frontend/
RUN pnpm --filter @nit-scs/shared build
RUN pnpm --filter @nit-scs/frontend build
RUN cd packages/backend && npx prisma generate
RUN pnpm --filter @nit-scs/backend build

# Stage 3: Production runtime
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json packages/
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/backend/dist packages/backend/dist
COPY --from=build /app/packages/backend/prisma packages/backend/prisma
COPY --from=build /app/packages/backend/node_modules/.prisma packages/backend/node_modules/.prisma
COPY --from=build /app/packages/frontend/dist packages/frontend/dist
COPY packages/backend/data packages/backend/data

WORKDIR /app/packages/backend
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Building Locally

From the project root:

```bash
docker build -t nit-scs -f packages/backend/Dockerfile .
```

**Build Time:** ~5-10 minutes (first build), ~2-3 minutes (cached builds)

### Running the Container

```bash
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  -e JWT_REFRESH_SECRET="your-refresh-secret" \
  nit-scs
```

Access the app at `http://localhost:4000`.

### Docker Compose (Full Stack)

Create a `docker-compose.prod.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    container_name: nit-scs-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: nit_scs
      POSTGRES_USER: nit_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nit_admin -d nit_scs"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    container_name: nit-scs-app
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://nit_admin:${DB_PASSWORD}@postgres:5432/nit_scs
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      NODE_ENV: production
      PORT: 4000
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata:
```

**.env file:**

```bash
DB_PASSWORD=strong_password_here
JWT_SECRET=generate_with_openssl_rand_base64_32
JWT_REFRESH_SECRET=generate_with_openssl_rand_base64_32
```

**Start:**

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Stop:**

```bash
docker-compose -f docker-compose.prod.yml down
```

---

## Local Docker

For development, use the included `docker-compose.yml` for PostgreSQL only.

### Start PostgreSQL

```bash
docker-compose up -d
```

This starts PostgreSQL 15 on `localhost:5432` with:
- Database: `nit_scs`
- User: `nit_admin`
- Password: `nit_scs_dev_2026`

### Stop PostgreSQL

```bash
docker-compose down
```

### Reset Database

To delete all data and start fresh:

```bash
docker-compose down -v  # -v removes volumes
docker-compose up -d
pnpm db:push
pnpm db:seed
```

---

## Post-Deployment Steps

After deploying, follow these steps to initialize the database and verify the deployment.

### 1. Run Database Migrations

**On Render:**

1. Go to Render dashboard → Your service → **Shell**
2. Run:
   ```bash
   cd packages/backend
   npx prisma db push
   ```

**Via Docker:**

```bash
docker exec -it nit-scs-app sh
cd packages/backend
npx prisma db push
exit
```

### 2. Seed the Database

**On Render:**

```bash
cd packages/backend
npx tsx prisma/seed.ts
```

**Via Docker:**

```bash
docker exec -it nit-scs-app sh
cd packages/backend
npm install -g tsx  # If not already installed
npx tsx prisma/seed.ts
exit
```

**Seed Creates:**
- 8 default users (one per role)
- Master data (regions, warehouses, projects, items, etc.)
- Sample documents (MRRV, MIRV, etc.)

**Default Admin Account:**
- Email: `admin@nit.com.sa`
- Password: `password123`

**Security:** Change the default password immediately after first login.

### 3. Verify Deployment

**Health Check:**

```bash
curl https://your-app.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-02-08T12:00:00.000Z"
}
```

**Login Test:**

```bash
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nit.com.sa","password":"password123"}'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "...",
    "user": { "id": "...", "email": "admin@nit.com.sa", ... }
  }
}
```

### 4. Update Admin Password

1. Login to the web app
2. Go to **Settings** → **Profile**
3. Change password
4. Logout and login with new password

### 5. Configure Settings

1. Login as admin
2. Go to **System** → **Settings**
3. Configure:
   - Company name
   - Approval thresholds
   - Email notifications (if enabled)
   - Currency settings
   - Date formats

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | Yes |
| `JWT_SECRET` | Secret for access tokens | `openssl rand -base64 32` | Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | `openssl rand -base64 32` | Yes |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_EXPIRES_IN` | Access token expiration | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `7d` |
| `PORT` | Server port | `4000` |
| `NODE_ENV` | Environment | `production` |
| `CORS_ORIGIN` | Allowed CORS origin | `*` (production should be specific domain) |

### Generating Secrets

**JWT Secrets:**

```bash
openssl rand -base64 32
```

Run twice to generate both `JWT_SECRET` and `JWT_REFRESH_SECRET`.

**Example Output:**

```
8K5gV7xP9mL2nQ4rT6wY8zA0bC3dE5fG7hJ9kM1nO3pR
```

### Setting Environment Variables

**Render:**
1. Dashboard → Service → Environment
2. Click "Add Environment Variable"
3. Enter key/value
4. Save (service auto-redeploys)

**Docker:**
- Use `.env` file with docker-compose
- Or pass via `-e` flag: `docker run -e JWT_SECRET=xyz ...`

**Local Development:**
- Copy `.env.example` to `.env`
- Edit values
- Never commit `.env` to Git

---

## Troubleshooting

### Common Issues

#### 1. Build Fails on Render

**Symptom:** Render build fails with "Cannot find module" or "prisma generate failed"

**Solution:**
- Ensure `render.yaml` points to correct Dockerfile path
- Check `dockerContext: .` (project root, not packages/backend)
- Verify all package.json files are committed to Git

#### 2. Database Connection Failed

**Symptom:** App crashes with "connection refused" or "cannot connect to database"

**Solution:**
- Verify `DATABASE_URL` is correctly set
- Check database is running (Render dashboard → Database → Status)
- Ensure database accepts connections from your app's IP
- For local Docker, check PostgreSQL container is running: `docker ps`

#### 3. CORS Errors

**Symptom:** Browser console shows "CORS policy blocked"

**Solution:**
- Set `CORS_ORIGIN` to your frontend domain (e.g., `https://nit-scs.onrender.com`)
- For multiple origins, update `packages/backend/src/config/cors.ts`
- In production, never use `CORS_ORIGIN=*` (security risk)

#### 4. 401 Unauthorized on All Requests

**Symptom:** All API calls return 401, even with valid token

**Solution:**
- Verify `JWT_SECRET` matches between token generation and verification
- Check token expiration (default 15 minutes)
- Clear browser localStorage and login again
- Ensure `Authorization: Bearer <token>` header is sent

#### 5. Prisma Client Not Generated

**Symptom:** Error "Cannot find module '@prisma/client'"

**Solution:**
- Run `npx prisma generate` in `packages/backend`
- For Docker, ensure Dockerfile runs `npx prisma generate` in build stage (already included)
- For Render, add a build command: `cd packages/backend && npx prisma generate`

#### 6. Frontend Not Serving

**Symptom:** API works but frontend shows 404

**Solution:**
- Ensure frontend was built: `pnpm --filter @nit-scs/frontend build`
- Check `packages/frontend/dist` exists
- Verify Dockerfile copies `frontend/dist` to runtime stage (already included)
- In `packages/backend/src/index.ts`, ensure production static file serving is enabled (already included)

#### 7. Socket.IO Connection Failed

**Symptom:** Real-time updates not working, console shows "WebSocket connection failed"

**Solution:**
- Ensure `VITE_WS_URL` points to backend (e.g., `https://nit-scs.onrender.com`)
- Check backend supports WebSocket upgrades (Render does by default)
- Verify no proxy/firewall blocking WebSocket connections

#### 8. Render Free Tier Spins Down

**Symptom:** App is slow on first request after 15 minutes of inactivity

**Solution:**
- Free tier spins down after inactivity
- Upgrade to paid plan for always-on service ($7/month)
- Or use a cron job to ping `/api/health` every 10 minutes (external service like UptimeRobot)

---

## Production Checklist

Before going live, verify:

### Security

- [ ] Strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (not default values)
- [ ] `NODE_ENV=production` is set
- [ ] CORS origin is restricted to your domain (not `*`)
- [ ] Default admin password has been changed
- [ ] Database password is strong (not default)
- [ ] `.env` files are NOT committed to Git
- [ ] Rate limiting is enabled (default: 200 req/min)
- [ ] Helmet security headers are enabled (default: yes)

### Database

- [ ] Database migrations applied (`npx prisma db push` or `npx prisma migrate deploy`)
- [ ] Database is seeded with initial data
- [ ] Database backups are configured (Render: automatic daily backups on paid plan)
- [ ] Database connection pooling is configured (Render: automatic)

### Functionality

- [ ] Health check endpoint returns 200: `/api/health`
- [ ] Login works with seeded users
- [ ] All API endpoints return expected responses
- [ ] Real-time updates work (Socket.IO events)
- [ ] File uploads work (test with image upload)
- [ ] PDF export works (test with report generation)

### Performance

- [ ] Frontend assets are minified and gzipped (Vite does this automatically)
- [ ] Code-splitting is working (check Network tab in DevTools)
- [ ] Database indexes are applied (Prisma schema has indexes)
- [ ] No N+1 query problems (use Prisma `include` wisely)

### Monitoring

- [ ] Render dashboard configured for alerts (uptime, errors)
- [ ] Application logs are accessible (Render dashboard → Logs)
- [ ] Error tracking is set up (consider Sentry, LogRocket)
- [ ] Uptime monitoring is configured (UptimeRobot, Pingdom)

### Documentation

- [ ] Admin documentation is up to date
- [ ] User guide is available (if needed)
- [ ] API documentation is current (see `docs/ARCHITECTURE.md`)
- [ ] Emergency contacts are documented

---

## Scaling Considerations

For production deployments with high traffic:

### Horizontal Scaling

- Deploy multiple backend instances (Render supports auto-scaling on paid plans)
- Use Redis for session storage and rate limiting (instead of in-memory)
- Use external file storage (S3, GCS) instead of local disk

### Database Scaling

- Upgrade PostgreSQL plan (more storage, connections)
- Enable connection pooling (Render does this automatically)
- Add read replicas for read-heavy workloads
- Optimize slow queries with indexes

### CDN & Caching

- Serve frontend assets via CDN (Cloudflare, AWS CloudFront)
- Enable HTTP caching headers for static assets
- Use Redis for application-level caching

### Monitoring & Logging

- Use structured logging (Winston, Pino)
- Send logs to centralized service (Datadog, LogDNA)
- Set up APM (Application Performance Monitoring)
- Monitor database performance (query times, connection pool)

---

## Support

For deployment issues:

- **Render Support:** https://render.com/docs
- **Docker Support:** https://docs.docker.com
- **PostgreSQL Docs:** https://www.postgresql.org/docs
- **Project Documentation:** See `docs/README.md` and `docs/ARCHITECTURE.md`

---

**Version:** 1.0.0
**Last Updated:** 2026-02-08
**Deployment Platforms:** Render (primary), Docker (alternative)
