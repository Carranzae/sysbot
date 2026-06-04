# Guía de Despliegue de Sysbot & LiveChat

Este repositorio es un monorepo que contiene dos sistemas completos independientes (cada uno con su propio frontend y backend):

1. **Sysbot** (Panel Principal y Bot con IA)
   - **Backend**: `apps/backend` (NestJS con NestCLI y Prisma)
   - **Frontend**: `apps/frontend` (Next.js 14)
2. **LiveChat** (Módulo de Chat en Vivo y WhatsApp)
   - **Backend**: `LIVE CHAT/backend` (Node.js/Express y Socket.io)
   - **Frontend**: `LIVE CHAT/frontend` (Vite, React y TS)

---

## 🚀 Despliegue de Backends (en Railway)

Recomendamos utilizar **Railway** para los backends, ya que soporta Dockerfiles, PostgreSQL y Redis de manera nativa.

### 1. Sysbot Backend (`apps/backend`)
- Crea un nuevo servicio en Railway conectado a tu repositorio de GitHub.
- En la pestaña **Settings** (Configuración) de ese servicio, define:
  - **Dockerfile Path**: `docker/backend.Dockerfile`
  - **Build Context**: `/` (la raíz del repositorio)
- Agrega las siguientes variables de entorno principales:
  - `DATABASE_URL`: URL de conexión a tu base de datos PostgreSQL (puedes crearla en Railway).
  - `REDIS_HOST`: Host de tu servicio Redis (puedes crearlo en Railway).
  - `REDIS_PORT`: `6379`
  - `JWT_SECRET`: Una clave segura para tokens de sesión.
  - `OPENAI_API_KEY`: Tu clave API de OpenAI.

### 2. LiveChat Backend (`LIVE CHAT/backend`)
- Crea otro servicio independiente en Railway conectado al mismo repositorio de GitHub.
- En la pestaña **Settings** de este servicio, define:
  - **Root Directory**: `LIVE CHAT/backend` (Railway buscará el `Dockerfile` y ejecutará la compilación dentro de esta carpeta de forma aislada).
- Agrega las variables de entorno principales:
  - `PORT`: `4000` (o el puerto que prefieras)
  - `DATABASE_URL`: URL de otra base de datos de PostgreSQL (o la misma con diferente base de datos/schema).
  - `REDIS_URL`: URL de conexión a Redis (`redis://...`).
  - `JWT_SECRET`: Clave segura.
  - `GEMINI_API_KEY` o `GROQ_API_KEY` (si utilizas soporte de bots).

---

## 💻 Despliegue de Frontends (en Netlify)

Recomendamos usar **Netlify** para los frontends. Netlify compilará el código estático y lo servirá de manera óptima a través de su CDN.

### 1. Sysbot Frontend (`apps/frontend`)
- Crea un nuevo sitio en Netlify conectado a tu repositorio de GitHub.
- Deja el **Base directory** (Directorio base) vacío (o apunta a la raíz `/`) para que use el archivo `netlify.toml` de la raíz del monorepo.
- El archivo `netlify.toml` en la raíz se encargará de configurar automáticamente:
  - **Build command**: `pnpm --filter @syst/frontend build`
  - **Publish directory**: `apps/frontend/.next`
- Agrega las siguientes variables de entorno en Netlify (**Site configuration -> Environment variables**):
  - `NETLIFY_USE_PNPM`: `true`
  - `NODE_VERSION`: `20`
  - `NEXT_PUBLIC_API_URL`: URL pública de tu Sysbot Backend desplegado en Railway (ej: `https://sysbot-backend.up.railway.app/api/v1`).
  - `NEXT_PUBLIC_WS_URL`: URL de WebSocket del Sysbot Backend (ej: `wss://sysbot-backend.up.railway.app`).

### 2. LiveChat Frontend (`LIVE CHAT/frontend`)
- Crea otro sitio independiente en Netlify conectado a tu repositorio.
- Configura los ajustes de compilación:
  - **Base directory**: `LIVE CHAT/frontend`
  - **Build command**: `npm run build`
  - **Publish directory**: `LIVE CHAT/frontend/dist`
- Agrega las variables de entorno:
  - `VITE_API_URL`: URL pública de tu LiveChat Backend en Railway (ej: `https://livechat-backend.up.railway.app`).

---

## 🗄️ Configuración de Bases de Datos

1. **PostgreSQL**: Puedes crear una base de datos PostgreSQL compartida o dos independientes en Railway. Asegúrate de pasar la cadena de conexión correspondiente (`DATABASE_URL`) a cada backend.
2. **Redis**: Crea un plugin de Redis en Railway y comparte la URL de conexión con ambos servicios.
