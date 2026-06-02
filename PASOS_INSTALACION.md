# 🚀 PASOS DE INSTALACIÓN - SISTEMA SYST

## ⚠️ IMPORTANTE: Sigue estos pasos EN ORDEN

---

## PASO 1: INSTALAR DOCKER (OBLIGATORIO)

Copia y pega estos comandos UNO POR UNO:

```bash
# 1. Actualizar repositorios
sudo apt update

# 2. Instalar Docker
sudo apt install -y docker.io

# 3. Instalar Docker Compose
sudo apt install -y docker-compose

# 4. Habilitar Docker
sudo systemctl enable docker

# 5. Iniciar Docker
sudo systemctl start docker

# 6. Verificar que Docker esté corriendo
sudo systemctl status docker
```

**Presiona `q` para salir del status**

Si ves `active (running)` en verde, ¡Docker está listo! ✅

---

## PASO 2: VERIFICAR DOCKER

```bash
# Ver versión de Docker
docker --version

# Debería mostrar algo como: Docker version 20.10.x
```

---

## PASO 3: CREAR ARCHIVO .env

```bash
cd /home/bmrx/Desktop/SYSTINF
nano .env
```

**Pega EXACTAMENTE este contenido:**

```env
DATABASE_URL=postgresql://syst_user:syst_password_2024@localhost:5432/syst_db
REDIS_HOST=localhost
REDIS_PORT=6379
QDRANT_URL=http://localhost:6333
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_API_URL=https://graph.facebook.com
WHATSAPP_API_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=mi_token_secreto_2024
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001
PORT=3001
NODE_ENV=development
```

**Guardar:** `Ctrl+O`, `Enter`, `Ctrl+X`

---

## PASO 4: EJECUTAR SCRIPT DE INICIO

```bash
cd /home/bmrx/Desktop/SYSTINF
chmod +x INICIO_RAPIDO.sh
./INICIO_RAPIDO.sh
```

Este script:
- ✅ Verifica Docker
- ✅ Instala dependencias
- ✅ Genera Prisma Client
- ✅ Inicia servicios Docker (postgres, redis, qdrant)
- ✅ Aplica migraciones de base de datos

**Espera a que termine** (puede tomar 1-2 minutos)

---

## PASO 5: INICIAR BACKEND

Abre una **NUEVA TERMINAL** y ejecuta:

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev
```

**Espera a ver:**
```
[Nest] Application successfully started
[Nest] Listening on http://localhost:3001
```

**¡NO CIERRES ESTA TERMINAL!**

---

## PASO 6: INICIAR FRONTEND

Abre **OTRA TERMINAL** y ejecuta:

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

**¡NO CIERRES ESTA TERMINAL!**

---

## PASO 7: ACCEDER AL SISTEMA

1. Abre tu navegador
2. Ve a: **http://localhost:3000**
3. Serás redirigido a `/login`
4. Click en **"Regístrate aquí"**
5. Completa el formulario:
   - Nombre: `Admin`
   - Apellido: `Test`
   - Email: `admin@test.com`
   - Contraseña: `admin123`
6. Click en **"Crear Cuenta"**
7. ¡Listo! Estarás en el dashboard

---

## 🎯 RESUMEN DE TERMINALES

Necesitas **3 terminales abiertas**:

1. **Terminal 1:** Servicios Docker (ya corriendo con el script)
2. **Terminal 2:** Backend (`cd apps/backend && pnpm dev`)
3. **Terminal 3:** Frontend (`cd apps/frontend && pnpm dev`)

---

## 🆘 SI ALGO FALLA

### Docker no inicia
```bash
sudo systemctl restart docker
sudo systemctl status docker
```

### Puerto ocupado
```bash
# Ver qué usa el puerto
lsof -i :3000  # Frontend
lsof -i :3001  # Backend

# Matar proceso
kill -9 <PID>
```

### Reiniciar todo
```bash
# Detener Docker
docker-compose down

# Reiniciar
./INICIO_RAPIDO.sh
```

---

## ✅ CHECKLIST

- [ ] Docker instalado y corriendo
- [ ] Archivo .env creado
- [ ] Script INICIO_RAPIDO.sh ejecutado
- [ ] Backend corriendo (puerto 3001)
- [ ] Frontend corriendo (puerto 3000)
- [ ] Usuario registrado en el sistema

---

**¡Sigue estos pasos en orden y todo funcionará!** 🚀
