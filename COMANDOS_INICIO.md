# 🚀 COMANDOS PARA INICIAR EL SISTEMA SYST

## ⚡ INICIO RÁPIDO

### 📋 PREREQUISITOS

Asegúrate de tener instalado:
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Docker y Docker Compose

---

## 🔧 CONFIGURACIÓN INICIAL (SOLO LA PRIMERA VEZ)

### 1️⃣ Crear archivo .env

```bash
cd /home/bmrx/Desktop/SYSTINF
nano .env
```

Pega este contenido:

```env
# DATABASE
DATABASE_URL=postgresql://syst_user:syst_password_2024@localhost:5432/syst_db

# REDIS
REDIS_HOST=localhost
REDIS_PORT=6379

# QDRANT
QDRANT_URL=http://localhost:6333

# OPENAI (REEMPLAZA CON TU API KEY)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# WHATSAPP (OPCIONAL)
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto_2024

# JWT
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRES_IN=7d

# FRONTEND
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# BACKEND
PORT=3001
NODE_ENV=development
```

Guarda con: `Ctrl+O`, `Enter`, `Ctrl+X`

### 2️⃣ Instalar dependencias

```bash
cd /home/bmrx/Desktop/SYSTINF
pnpm install
```

### 3️⃣ Configurar base de datos

```bash
cd /home/bmrx/Desktop/SYSTINF/packages/database
pnpm prisma generate
pnpm prisma migrate dev --name init
```

---

## 🚀 INICIAR EL SISTEMA (CADA VEZ)

### OPCIÓN A: Inicio Completo (Recomendado)

Abre **4 terminales** y ejecuta en cada una:

#### Terminal 1: Docker Services
```bash
cd /home/bmrx/Desktop/SYSTINF
docker-compose up postgres redis qdrant
```

**Espera a ver:**
```
postgres_1  | database system is ready to accept connections
redis_1     | Ready to accept connections
qdrant_1    | Qdrant is ready
```

#### Terminal 2: Backend
```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev
```

**Espera a ver:**
```
[Nest] Application successfully started
[Nest] Listening on http://localhost:3001
```

#### Terminal 3: Frontend
```bash
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm dev
```

**Espera a ver:**
```
▲ Next.js 14.0.4
- Local:        http://localhost:3000
- Ready in 2.5s
```

#### Terminal 4: Monitoreo (Opcional)
```bash
# Ver logs de Docker
docker-compose logs -f
```

---

### OPCIÓN B: Inicio en Background

Si prefieres que Docker corra en segundo plano:

```bash
# Terminal 1: Docker en background
cd /home/bmrx/Desktop/SYSTINF
docker-compose up -d postgres redis qdrant

# Terminal 2: Backend
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev

# Terminal 3: Frontend
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm dev
```

---

## 🌐 URLs DE ACCESO

Una vez todo esté corriendo:

```
✅ Frontend:         http://localhost:3000
✅ Backend API:      http://localhost:3001/api/v1
✅ GraphQL:          http://localhost:3001/graphql
✅ Qdrant Dashboard: http://localhost:6333/dashboard
```

---

## 🧪 VERIFICAR QUE TODO FUNCIONA

### 1. Verificar Docker
```bash
docker ps
```

Deberías ver 3 contenedores corriendo:
- syst-postgres
- syst-redis
- syst-qdrant

### 2. Verificar Backend
```bash
curl http://localhost:3001/api/v1/health
```

Respuesta esperada: `{"status":"ok"}`

### 3. Verificar Frontend
Abre: http://localhost:3000

Deberías ver la página de login.

---

## 🔐 CREAR TU USUARIO

1. Ve a: http://localhost:3000/register
2. Completa el formulario:
   ```
   Nombre:      Admin
   Apellido:    Test
   Email:       admin@test.com
   Contraseña:  admin123
   ```
3. Click en "Crear Cuenta"
4. Serás redirigido al dashboard

---

## 🛑 DETENER EL SISTEMA

### Detener Frontend y Backend
En cada terminal donde están corriendo, presiona: `Ctrl+C`

### Detener Docker

**Si iniciaste con `docker-compose up`:**
```bash
Ctrl+C
```

**Si iniciaste con `docker-compose up -d`:**
```bash
cd /home/bmrx/Desktop/SYSTINF
docker-compose down
```

**Para detener y eliminar volúmenes (⚠️ borra datos):**
```bash
docker-compose down -v
```

---

## 🔄 REINICIAR SERVICIOS

### Reiniciar Docker
```bash
cd /home/bmrx/Desktop/SYSTINF
docker-compose restart postgres redis qdrant
```

### Reiniciar Backend
```bash
# En la terminal del backend, presiona Ctrl+C y luego:
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev
```

### Reiniciar Frontend
```bash
# En la terminal del frontend, presiona Ctrl+C y luego:
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm dev
```

---

## 📊 COMANDOS ÚTILES

### Ver logs de Docker
```bash
# Todos los servicios
docker-compose logs -f

# Solo PostgreSQL
docker-compose logs -f postgres

# Solo Redis
docker-compose logs -f redis

# Solo Qdrant
docker-compose logs -f qdrant
```

### Verificar estado de servicios
```bash
# Ver contenedores corriendo
docker ps

# Ver uso de recursos
docker stats

# Ver puertos en uso
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :6333  # Qdrant
```

### Limpiar y reinstalar
```bash
# Limpiar node_modules
cd /home/bmrx/Desktop/SYSTINF
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# Regenerar Prisma Client
cd packages/database
pnpm prisma generate

# Resetear base de datos (⚠️ borra datos)
pnpm prisma migrate reset
```

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error: "Port already in use"

**Frontend (puerto 3000):**
```bash
lsof -i :3000
kill -9 <PID>
```

**Backend (puerto 3001):**
```bash
lsof -i :3001
kill -9 <PID>
```

### Error: "Cannot connect to database"

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres

# Reiniciar PostgreSQL
docker-compose restart postgres

# Ver logs
docker-compose logs postgres
```

### Error: "Prisma Client not generated"

```bash
cd /home/bmrx/Desktop/SYSTINF/packages/database
pnpm prisma generate
```

### Error: "Module not found"

```bash
cd /home/bmrx/Desktop/SYSTINF
rm -rf node_modules
pnpm install
```

### Error: "EADDRINUSE: address already in use"

Otro proceso está usando el puerto. Encuentra y mata el proceso:

```bash
# Para puerto 3000
lsof -ti:3000 | xargs kill -9

# Para puerto 3001
lsof -ti:3001 | xargs kill -9
```

---

## 📝 NOTAS IMPORTANTES

1. **Siempre inicia Docker primero** antes del backend
2. **Espera a que el backend esté listo** antes de usar el frontend
3. **No uses `npm`**, usa `pnpm` en su lugar
4. **El archivo `.env`** debe estar en la raíz del proyecto
5. **La primera vez** debes crear tu usuario en `/register`

---

## ✅ CHECKLIST DE INICIO

- [ ] Archivo `.env` creado en `/home/bmrx/Desktop/SYSTINF`
- [ ] Dependencias instaladas (`pnpm install`)
- [ ] Prisma Client generado (`pnpm prisma generate`)
- [ ] Migraciones aplicadas (`pnpm prisma migrate dev`)
- [ ] Docker corriendo (postgres, redis, qdrant)
- [ ] Backend corriendo en puerto 3001
- [ ] Frontend corriendo en puerto 3000
- [ ] Usuario registrado en el sistema

---

## 🎯 RESUMEN DE COMANDOS

```bash
# 1. Configuración inicial (solo primera vez)
cd /home/bmrx/Desktop/SYSTINF
pnpm install
cd packages/database
pnpm prisma generate
pnpm prisma migrate dev

# 2. Iniciar servicios (cada vez)
# Terminal 1:
cd /home/bmrx/Desktop/SYSTINF
docker-compose up postgres redis qdrant

# Terminal 2:
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev

# Terminal 3:
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm dev

# 3. Acceder
# Abre: http://localhost:3000
```

---

**¡Listo para hacer pruebas!** 🚀
