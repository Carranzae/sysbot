# 🔐 CREDENCIALES Y CONTRASEÑAS - SISTEMA SYST

## 📋 INFORMACIÓN IMPORTANTE

Este documento contiene **TODAS** las credenciales, contraseñas y configuraciones necesarias para el sistema SYST.

**⚠️ MANTÉN ESTE ARCHIVO SEGURO Y NO LO COMPARTAS**

---

## 🗄️ BASE DE DATOS (PostgreSQL)

### Configuración Local

```env
DATABASE_URL=postgresql://syst_user:syst_password_2024@localhost:5432/syst_db
```

**Desglose:**
- **Host**: `localhost`
- **Puerto**: `5432`
- **Usuario**: `syst_user`
- **Contraseña**: `syst_password_2024`
- **Base de datos**: `syst_db`

### Acceso Directo

```bash
# Conectar a PostgreSQL
psql -h localhost -p 5432 -U syst_user -d syst_db

# Cuando pida contraseña, ingresa:
syst_password_2024
```

### Configuración Docker

El archivo `docker-compose.yml` ya tiene estas credenciales configuradas:

```yaml
POSTGRES_USER: syst_user
POSTGRES_PASSWORD: syst_password_2024
POSTGRES_DB: syst_db
```

---

## 🔴 REDIS

### Configuración Local

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Redis NO requiere contraseña en desarrollo local**

### Acceso Directo

```bash
# Conectar a Redis
redis-cli

# O con Docker
docker exec -it syst-redis redis-cli
```

---

## 🔍 QDRANT (Vector Database)

### Configuración Local

```env
QDRANT_URL=http://localhost:6333
```

**Qdrant NO requiere autenticación en desarrollo local**

### Acceso Web UI

- **URL**: http://localhost:6333/dashboard
- **No requiere login**

---

## 🤖 OPENAI API

### Configuración

```env
OPENAI_API_KEY=tu_api_key_aqui
```

**⚠️ IMPORTANTE**: Debes obtener tu propia API Key de OpenAI

### Cómo Obtener la API Key

1. Ve a: https://platform.openai.com/api-keys
2. Inicia sesión o crea una cuenta
3. Click en "Create new secret key"
4. Copia la key y pégala en el archivo `.env`

### Modelos Utilizados

- **Chat**: `gpt-4` o `gpt-3.5-turbo`
- **Embeddings**: `text-embedding-ada-002`

---

## 💬 WHATSAPP BUSINESS API

### Configuración

```env
WHATSAPP_API_TOKEN=tu_token_aqui
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id_aqui
WHATSAPP_BUSINESS_ACCOUNT_ID=tu_account_id_aqui
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto_2024
```

### Cómo Obtener Credenciales

1. Ve a: https://developers.facebook.com/
2. Crea una app de tipo "Business"
3. Agrega el producto "WhatsApp"
4. En el panel de WhatsApp encontrarás:
   - **Token de acceso temporal** (WHATSAPP_API_TOKEN)
   - **ID del número de teléfono** (WHATSAPP_PHONE_NUMBER_ID)
   - **ID de cuenta empresarial** (WHATSAPP_BUSINESS_ACCOUNT_ID)

### Webhook Verify Token

```
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto_2024
```

Este token lo defines tú y lo usas para verificar webhooks.

---

## 🔑 JWT (Autenticación)

### Configuración

```env
JWT_SECRET=tu_jwt_secret_super_seguro_2024
JWT_EXPIRES_IN=7d
```

### Generar un JWT Secret Seguro

```bash
# Opción 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Opción 2: OpenSSL
openssl rand -hex 32

# Opción 3: Usar este ejemplo
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

## 👤 USUARIOS DEL SISTEMA

### Usuario Administrador por Defecto

**NO HAY USUARIO POR DEFECTO** - Debes registrarte en el frontend

### Primer Usuario (Registro)

1. Ve a: http://localhost:3000/register
2. Completa el formulario:
   - **Nombre**: Tu nombre
   - **Apellido**: Tu apellido
   - **Email**: tu@email.com
   - **Contraseña**: Mínimo 6 caracteres
3. Click en "Crear Cuenta"

### Login Posterior

1. Ve a: http://localhost:3000/login
2. Ingresa tu email y contraseña
3. Click en "Iniciar Sesión"

---

## 🌐 PUERTOS Y URLs

### Frontend (Next.js)

- **Puerto**: `3000`
- **URL Local**: http://localhost:3000
- **URL Login**: http://localhost:3000/login
- **URL Dashboard**: http://localhost:3000/dashboard

### Backend (NestJS)

- **Puerto**: `3001`
- **URL API REST**: http://localhost:3001/api/v1
- **URL GraphQL**: http://localhost:3001/graphql
- **URL WebSocket**: ws://localhost:3001

### Servicios Docker

- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Qdrant**: `localhost:6333`
- **Qdrant Dashboard**: http://localhost:6333/dashboard

---

## 📝 ARCHIVO .env COMPLETO

Crea un archivo `.env` en la raíz del proyecto con este contenido:

```env
# ===================================
# DATABASE
# ===================================
DATABASE_URL=postgresql://syst_user:syst_password_2024@localhost:5432/syst_db

# ===================================
# REDIS
# ===================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ===================================
# QDRANT
# ===================================
QDRANT_URL=http://localhost:6333

# ===================================
# OPENAI
# ===================================
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===================================
# WHATSAPP
# ===================================
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto_2024

# ===================================
# JWT
# ===================================
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRES_IN=7d

# ===================================
# FRONTEND
# ===================================
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# ===================================
# BACKEND
# ===================================
PORT=3001
NODE_ENV=development
```

---

## 🚀 COMANDOS DE INICIO

### 1. Iniciar Servicios Docker

```bash
cd /home/bmrx/Desktop/SYSTINF
docker-compose up -d postgres redis qdrant
```

### 2. Iniciar Backend

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

### 3. Iniciar Frontend

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm install
pnpm dev
```

---

## 🔒 SEGURIDAD

### ⚠️ IMPORTANTE PARA PRODUCCIÓN

**NUNCA uses estas credenciales en producción:**

1. **PostgreSQL**: Cambia usuario y contraseña
2. **JWT_SECRET**: Genera uno nuevo y seguro
3. **WHATSAPP_WEBHOOK_VERIFY_TOKEN**: Usa uno único
4. **OpenAI API Key**: Usa una key de producción con límites

### Recomendaciones

- ✅ Usa variables de entorno diferentes para producción
- ✅ Activa autenticación en Redis y Qdrant
- ✅ Usa HTTPS en producción
- ✅ Implementa rate limiting
- ✅ Habilita logs de auditoría
- ✅ Usa secretos gestionados (AWS Secrets Manager, etc.)

---

## 📞 SOPORTE

Si tienes problemas con las credenciales:

1. Verifica que el archivo `.env` esté en la raíz del proyecto
2. Verifica que Docker esté corriendo: `docker ps`
3. Verifica los logs: `docker-compose logs`
4. Reinicia los servicios: `docker-compose restart`

---

## ✅ CHECKLIST DE CONFIGURACIÓN

- [ ] Archivo `.env` creado en la raíz
- [ ] PostgreSQL corriendo (puerto 5432)
- [ ] Redis corriendo (puerto 6379)
- [ ] Qdrant corriendo (puerto 6333)
- [ ] OpenAI API Key configurada
- [ ] WhatsApp API configurada (opcional para desarrollo)
- [ ] JWT Secret configurado
- [ ] Backend corriendo (puerto 3001)
- [ ] Frontend corriendo (puerto 3000)
- [ ] Usuario registrado en el sistema

---

**Fecha de creación**: Diciembre 2024  
**Última actualización**: Diciembre 2024  
**Versión del sistema**: 1.0.0

🔐 **MANTÉN ESTE ARCHIVO SEGURO**
