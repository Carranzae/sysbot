# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview
- Monorepo managed with `pnpm` workspaces + Turborepo.
- Primary apps:
  - `apps/backend`: NestJS API (`@syst/backend`)
  - `apps/frontend`: Next.js 14 dashboard (`@syst/frontend`)
  - `packages/database`: Prisma schema/client
  - `packages/shared`: shared types/constants/utils
  - `packages/ai-engine`: shared AI helpers
- There is also a separate `LIVE CHAT/` project (own backend/frontend) that integrates with the Nest backend through a bridge module.

## Essential Commands
Run from repository root unless noted.

### Install & workspace orchestration
- `pnpm install`
- `pnpm dev` (runs `turbo run dev` across workspace)
- `pnpm build` (runs `turbo run build`)
- `pnpm lint` (runs `turbo run lint`)
- `pnpm test` (runs `turbo run test`)

### Targeted app/package commands
- Backend dev: `pnpm --filter @syst/backend dev:watch`
- Backend build: `pnpm --filter @syst/backend build`
- Backend lint: `pnpm --filter @syst/backend lint`
- Backend tests: `pnpm --filter @syst/backend test`
- Single backend test file: `pnpm --filter @syst/backend test -- path\to\file.spec.ts`
- Single backend test by name: `pnpm --filter @syst/backend test -- -t "test name"`
- Frontend dev: `pnpm --filter @syst/frontend dev`
- Frontend build: `pnpm --filter @syst/frontend build`
- Frontend lint: `pnpm --filter @syst/frontend lint`

### Database / Prisma
- Generate client: `pnpm db:generate`
- Create/apply dev migration: `pnpm db:migrate`
- Open Prisma Studio: `pnpm db:studio`
- DB verification flow: `pnpm db:verify` (runs migrations + backend smoke check)

### Docker helpers
- `pnpm docker:up`
- `pnpm docker:down`
- `pnpm docker:build`

### LIVE CHAT project (separate from workspace)
Run from `LIVE CHAT/backend` or `LIVE CHAT/frontend`:
- Backend dev: `pnpm dev`
- Backend start: `pnpm start`
- Frontend dev: `pnpm dev`
- Frontend build: `pnpm build`

## High-Level Architecture

## 1) Backend composition (`apps/backend`)
- Entry point: `apps/backend/src/main.ts`
  - Loads root `.env`, applies global `api/v1` prefix, global validation pipe, and global exception filter.
  - Enables permissive CORS in development; strict origin logic in production.
- Module graph: `apps/backend/src/app.module.ts`
  - Central Nest module wiring for domains: auth, business, messaging, WhatsApp, AI, CRM, plans, monitoring, webhooks, etc.
  - Global cross-cutting concerns:
    - `MetricsInterceptor` as app interceptor
    - `RateLimitGuard` as app guard
  - BullMQ configured via Redis env vars.
- Data layer:
  - Prisma schema is in `packages/database/prisma/schema.prisma`.
  - Multi-tenant core is `Business` with many related domain models (messages, contacts, files, subscriptions, automations, social posts, medical/clinic extensions, etc.).
  - `BotConfig` is a key per-business configuration hub (AI/provider settings, channel toggles, quotas, social scheduling, payment/email settings).

## 2) Frontend composition (`apps/frontend`)
- Next.js App Router base in `apps/frontend/src/app`.
- Global providers via `src/components/providers` and state via Zustand stores (`src/store/*`).
- API access centralized in `apps/frontend/src/lib/api.ts`:
  - Axios instance with JWT from `localStorage`.
  - Large grouped API clients (`authApi`, `businessApi`, `messagesApi`, etc.) mapping backend REST endpoints.
- Realtime client in `apps/frontend/src/lib/websocket.ts`:
  - Socket.IO connection with room join/leave helpers and subscription utilities.

## 3) LIVE CHAT bridge architecture
- Separate service in `LIVE CHAT/backend` (Express + Socket.IO).
- Sysbot backend bridge module: `apps/backend/src/modules/livechat-bridge`.
  - Proxies authenticated HTTP calls from Nest to Live Chat service.
  - Opens a Socket.IO client to Live Chat and retransmits events to Sysbot WebSocket gateway for frontend consumers.
- Frontend accesses this through `livechatApi` methods in `apps/frontend/src/lib/api.ts` hitting `/livechat/*` endpoints on Nest.

## 4) Shared packages
- `@syst/shared`: shared types/constants/utils consumed by apps.
- `@syst/database`: Prisma client/schema package.
- `@syst/ai-engine`: AI helper package used by backend.

## Environment & Integration Notes
- Port defaults are not fully consistent across files:
  - Backend `main.ts` defaults to port `3003`.
  - Frontend API/WS defaults (`next.config.js`, `src/lib/api.ts`, `src/lib/websocket.ts`) point to `3001`.
  - Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` explicitly in local env to match the running backend port.
- Live Chat bridge base URL defaults to `http://localhost:4000` (see `LIVECHAT_API_URL` usage in bridge service).
- Backend serves uploaded assets from `/uploads` (static serving configured in `AppModule` and also in Live Chat backend).
