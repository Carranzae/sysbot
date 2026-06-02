# Instalación de SYST

## Requisitos Previos

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker y Docker Compose (para producción)
- PostgreSQL 15+
- Redis 7+
- Qdrant (Vector DB)

## Instalación Local (Desarrollo)

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd SYSTINF
```

### 2. Instalar Dependencias

```bash
pnpm install
```

### 3. Configurar Variables de Entorno

Copiar el archivo de ejemplo y configurar las variables:

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
- `DATABASE_URL`: Conexión a PostgreSQL
- `OPENAI_API_KEY`: API Key de OpenAI
- `WHATSAPP_API_TOKEN`: Token de WhatsApp Business API
- `JWT_SECRET`: Secreto para JWT (cambiar en producción)

### 4. Iniciar Servicios con Docker

```bash
docker-compose up -d postgres redis qdrant
```

### 5. Generar Cliente Prisma y Migrar Base de Datos

```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Iniciar Aplicación en Modo Desarrollo

```bash
# Terminal 1 - Backend
cd apps/backend
pnpm dev

# Terminal 2 - Frontend
cd apps/frontend
pnpm dev
```

La aplicación estará disponible en:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api/v1

## Instalación con Docker (Producción)

### 1. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con las credenciales de producción.

### 2. Construir y Ejecutar Contenedores

```bash
docker-compose up -d
```

### 3. Ejecutar Migraciones

```bash
docker-compose exec backend pnpm db:migrate
```

### 4. Verificar Estado

```bash
docker-compose ps
docker-compose logs -f
```

## Configuración de WhatsApp Business API

### 1. Crear Aplicación en Meta for Developers

1. Ir a https://developers.facebook.com/
2. Crear una nueva aplicación
3. Agregar producto "WhatsApp Business API"

### 2. Configurar Webhook

URL del Webhook: `https://tu-dominio.com/api/v1/whatsapp/webhook`

Verify Token: El mismo configurado en `WHATSAPP_VERIFY_TOKEN`

Eventos a suscribir:
- messages
- message_status

### 3. Obtener Credenciales

- Phone Number ID
- Access Token
- Verify Token

Agregar estas credenciales al archivo `.env`.

## Configuración de OpenAI

1. Crear cuenta en https://platform.openai.com/
2. Generar API Key
3. Agregar al `.env` como `OPENAI_API_KEY`

## Configuración de Vector Database (Qdrant)

### Opción 1: Docker (Recomendado)

Ya incluido en `docker-compose.yml`

### Opción 2: Qdrant Cloud

1. Crear cuenta en https://cloud.qdrant.io/
2. Crear cluster
3. Obtener URL y API Key
4. Configurar en `.env`:
   ```
   QDRANT_URL=https://xxx.qdrant.io
   QDRANT_API_KEY=tu-api-key
   ```

## Verificación de Instalación

### Verificar Backend

```bash
curl http://localhost:3001/api/v1/health
```

### Verificar Base de Datos

```bash
pnpm db:studio
```

### Verificar Redis

```bash
docker-compose exec redis redis-cli ping
```

### Verificar Qdrant

```bash
curl http://localhost:6333/health
```

## Solución de Problemas

### Error de Conexión a Base de Datos

Verificar que PostgreSQL esté corriendo:
```bash
docker-compose ps postgres
```

Verificar logs:
```bash
docker-compose logs postgres
```

### Error de Prisma

Regenerar cliente:
```bash
pnpm db:generate
```

### Error de Dependencias

Limpiar e instalar de nuevo:
```bash
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

## Escalabilidad Horizontal

Para escalar horizontalmente:

1. **Backend**: Agregar más instancias detrás de un Load Balancer
2. **Redis**: Usar Redis Cluster o Redis Sentinel
3. **PostgreSQL**: Configurar réplicas de lectura
4. **Qdrant**: Escalar cluster según documentación oficial

Ejemplo con Docker Swarm:

```bash
docker stack deploy -c docker-compose.yml syst
docker service scale syst_backend=3
```

## Monitoreo

Recomendaciones:
- Prometheus + Grafana para métricas
- Sentry para errores
- Winston para logs centralizados
- PM2 para gestión de procesos Node.js

## Backup

### Base de Datos

```bash
docker-compose exec postgres pg_dump -U syst_user syst_db > backup.sql
```

### Restaurar

```bash
docker-compose exec -T postgres psql -U syst_user syst_db < backup.sql
```

## Actualizaciones

```bash
git pull origin main
pnpm install
pnpm db:migrate
docker-compose up -d --build
```
