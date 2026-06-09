# Guia de despliegue de Sysbot

Sysbot se despliega como un monorepo pnpm con dos servicios principales:

1. **Backend API**: `apps/backend`
   - NestJS, Prisma, PostgreSQL, Redis, Qdrant/Vector DB y WebSocket.
   - Despliegue recomendado: Railway.
2. **Frontend dashboard**: `apps/frontend`
   - Next.js 14 con panel administrativo, CRM, omnicanal, canales e IA.
   - Despliegue recomendado: Vercel.

El antiguo proyecto standalone `LIVE CHAT/` queda retirado del despliegue principal. La bandeja omnicanal y el puente livechat se gestionan desde el backend NestJS.

## Railway backend

Configura un servicio Railway conectado al repositorio:

- **Root / Build context**: raiz del repositorio.
- **Dockerfile Path**: `docker/backend.Dockerfile`.
- **Start command**: el definido por la imagen o `node apps/backend/dist/main.js`.

Variables principales:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `BACKEND_PUBLIC_URL`
- `QDRANT_URL`
- `OPENAI_API_KEY` o proveedor IA equivalente
- Credenciales Meta/WhatsApp/Gmail/Twilio segun canales activos

Antes del arranque productivo ejecuta migraciones con:

```bash
pnpm --filter @syst/backend prisma migrate deploy --schema=../../packages/database/prisma/schema.prisma
```

## Vercel frontend

Configura un proyecto Vercel conectado al repositorio:

- **Framework**: Next.js.
- **Root Directory**: `apps/frontend` o raiz con build filtrado.
- **Build command**: `pnpm --filter @syst/frontend build`.
- **Output**: Next.js default.

Variables principales:

- `NEXT_PUBLIC_API_URL=https://TU_BACKEND_RAILWAY/api/v1`
- `NEXT_PUBLIC_WS_URL=wss://TU_BACKEND_RAILWAY`

## Servicios gestionados

- PostgreSQL con pooler para produccion.
- Redis gestionado para BullMQ, rate limits y jobs.
- Qdrant o Vector DB gestionado para RAG.
- Dominios HTTPS publicos para webhooks de WhatsApp, Meta, Gmail y Twilio.

## Checklist de produccion

- Ejecutar `pnpm --filter @syst/backend build`.
- Ejecutar `pnpm --filter @syst/frontend build`.
- Validar Prisma schema y migraciones.
- Verificar `/api/v1/channels/:businessId/status`.
- Verificar `/api/v1/omnichannel/conversations`.
- Probar login admin, onboarding, conexion de canal, carga RAG y envio de mensaje.
