# Fase 5: Produccion Railway + Vercel

Esta guia separa desarrollo local de produccion para que Sysbot pueda operar como SaaS omnicanal.

## Backend en Railway

Variables obligatorias:

```env
NODE_ENV=production
PORT=3001
API_PREFIX=api/v1
BACKEND_PUBLIC_URL=https://TU-BACKEND.up.railway.app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public
REDIS_HOST=HOST
REDIS_PORT=PORT
REDIS_PASSWORD=PASSWORD
QDRANT_URL=https://TU-QDRANT
JWT_SECRET=CAMBIAR_POR_SECRETO_LARGO
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://TU-FRONTEND.vercel.app,https://TU-DOMINIO.com
AUTO_RUN_MIGRATIONS=false
```

Canales:

```env
WHATSAPP_API_URL=https://graph.facebook.com
WHATSAPP_API_TOKEN=TOKEN_REAL
WHATSAPP_PHONE_NUMBER_ID=ID_REAL
WHATSAPP_BUSINESS_ACCOUNT_ID=ID_REAL
WHATSAPP_VERIFY_TOKEN=TOKEN_VERIFICACION_REAL
META_APP_ID=APP_ID
META_APP_SECRET=APP_SECRET
META_OAUTH_REDIRECT_URI=https://TU-BACKEND.up.railway.app/api/v1/oauth/meta/callback
GOOGLE_CLIENT_ID=CLIENT_ID
GOOGLE_CLIENT_SECRET=CLIENT_SECRET
GOOGLE_OAUTH_REDIRECT_URI=https://TU-BACKEND.up.railway.app/api/v1/oauth/google/callback
TWILIO_ACCOUNT_SID=SID
TWILIO_AUTH_TOKEN=TOKEN
TWILIO_PHONE_NUMBER=NUMERO
```

IA:

```env
OPENAI_API_KEY=KEY_REAL
GEMINI_API_KEY=KEY_REAL
GROQ_API_KEY=KEY_REAL
```

Pagos:

```env
STRIPE_SECRET_KEY=KEY_REAL
STRIPE_WEBHOOK_SECRET=SECRET_REAL
IZIPAY_API_KEY=KEY_REAL
```

## Flujo de deploy backend

1. Ejecutar migraciones antes de iniciar app:

```bash
pnpm --filter @syst/backend exec prisma migrate deploy --schema=../../packages/database/prisma/schema.prisma
```

2. Compilar:

```bash
pnpm --filter @syst/backend build
```

3. Iniciar:

```bash
node apps/backend/dist/main.js
```

No activar `AUTO_RUN_MIGRATIONS=true` en produccion salvo emergencia controlada.

## Frontend en Vercel

Variables obligatorias:

```env
NEXT_PUBLIC_API_URL=https://TU-BACKEND.up.railway.app/api/v1
NEXT_PUBLIC_WS_URL=wss://TU-BACKEND.up.railway.app
```

Build command:

```bash
pnpm --filter @syst/frontend build
```

Output: Next.js default.

## Webhooks publicos

Configurar en proveedores:

- Meta webhook: `https://TU-BACKEND.up.railway.app/api/v1/meta/webhook`
- WhatsApp webhook: `https://TU-BACKEND.up.railway.app/api/v1/whatsapp/webhook`
- Google OAuth callback: `https://TU-BACKEND.up.railway.app/api/v1/oauth/google/callback`
- Meta OAuth callback: `https://TU-BACKEND.up.railway.app/api/v1/oauth/meta/callback`
- Stripe webhook: `https://TU-BACKEND.up.railway.app/api/v1/payment/webhook/stripe`

## Requisitos para 20k empresas/personas

- Postgres gestionado con pooler y backups.
- Redis gestionado para BullMQ, rate limits y cache.
- Qdrant gestionado o servicio vectorial dedicado.
- Logs persistentes y alertas de errores.
- Rate limits por negocio y por canal.
- Presupuesto IA por negocio.
- Conteo MAC: contactos activos mensuales por negocio.
- Auditoria de acciones admin y cambios de configuracion.
- Rotacion inmediata de cualquier secret expuesto en archivos locales.

## Checklist de salida a mercado

- Backend health OK.
- Frontend build OK.
- Login, onboarding y seleccion de negocio OK.
- WhatsApp Web/API probado.
- Meta OAuth probado con dominio Railway.
- Gmail OAuth probado con dominio Railway.
- CRM externo probado por proveedor prioritario.
- Un archivo RAG cargado y consultable.
- Una automatizacion activa por negocio.
- AI Agent probado con escalamiento humano.
- Planes y limites activos.
