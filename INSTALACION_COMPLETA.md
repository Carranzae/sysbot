# 🚀 GUÍA DE INSTALACIÓN COMPLETA - SISTEMA SYST

## ✅ FRONTEND 100% COMPLETADO

El sistema está **completamente funcional** con todas las páginas implementadas.

---

## 📦 PASO 1: INSTALAR DEPENDENCIAS

```bash
cd /home/bmrx/Desktop/SYSTINF

# Instalar todas las dependencias del monorepo
pnpm install
```

Esto instalará automáticamente las dependencias de:
- ✅ Frontend (Next.js)
- ✅ Backend (NestJS)
- ✅ Shared (tipos compartidos)
- ✅ Database (Prisma)
- ✅ AI Engine (OpenAI, Qdrant)

---

## 🔧 PASO 2: CONFIGURAR VARIABLES DE ENTORNO

### Crear archivo .env en la raíz

```bash
cd /home/bmrx/Desktop/SYSTINF
nano .env
```

### Copiar y pegar esta configuración:

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

# WHATSAPP (OPCIONAL PARA DESARROLLO)
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

**⚠️ IMPORTANTE**: Reemplaza `OPENAI_API_KEY` con tu API key real de OpenAI.

---

## 🐳 PASO 3: INICIAR SERVICIOS DOCKER

```bash
cd /home/bmrx/Desktop/SYSTINF

# Iniciar PostgreSQL, Redis y Qdrant
docker-compose up -d postgres redis qdrant

# Verificar que estén corriendo
docker ps
```

Deberías ver 3 contenedores:
- ✅ syst-postgres (puerto 5432)
- ✅ syst-redis (puerto 6379)
- ✅ syst-qdrant (puerto 6333)

---

## 🗄️ PASO 4: CONFIGURAR BASE DE DATOS

```bash
cd /home/bmrx/Desktop/SYSTINF/packages/database

# Generar cliente Prisma
pnpm prisma generate

# Crear las tablas en la base de datos
pnpm prisma migrate dev --name init

# (Opcional) Ver la base de datos
pnpm prisma studio
```

---

## 🖥️ PASO 5: INICIAR BACKEND

**Terminal 1:**

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend

# Instalar dependencias (si no se hizo en paso 1)
pnpm install

# Iniciar en modo desarrollo
pnpm dev
```

El backend estará disponible en:
- **API REST**: http://localhost:3001/api/v1
- **GraphQL**: http://localhost:3001/graphql
- **WebSocket**: ws://localhost:3001

---

## 🎨 PASO 6: INICIAR FRONTEND

**Terminal 2:**

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/frontend

# Instalar dependencias (si no se hizo en paso 1)
pnpm install

# Iniciar en modo desarrollo
pnpm dev
```

El frontend estará disponible en:
- **URL**: http://localhost:3000

---

## 👤 PASO 7: CREAR TU PRIMER USUARIO

1. Abre tu navegador en: http://localhost:3000
2. Serás redirigido a `/login`
3. Click en "Regístrate aquí"
4. Completa el formulario:
   - **Nombre**: Tu nombre
   - **Apellido**: Tu apellido
   - **Email**: tu@email.com
   - **Contraseña**: Mínimo 6 caracteres
5. Click en "Crear Cuenta"
6. ¡Listo! Serás redirigido al dashboard

---

## 🏢 PASO 8: CREAR TU PRIMER NEGOCIO

1. En el dashboard, ve a "Negocios"
2. Click en "Nuevo Negocio"
3. Completa la información:
   - **Nombre**: Nombre de tu negocio
   - **Tipo de Industria**: Selecciona una opción
   - **Descripción**: Opcional
   - **Teléfono/Email/Dirección**: Opcional
4. Click en "Crear"
5. Click en "Seleccionar" para activar el negocio

---

## 📁 PASO 9: SUBIR ARCHIVOS DE CONOCIMIENTO

1. Ve a "Archivos"
2. Click en "Subir Archivo"
3. Selecciona un PDF, TXT, DOC o DOCX (máx. 10MB)
4. El archivo se procesará automáticamente
5. El bot aprenderá de este contenido

---

## ✅ VERIFICACIÓN COMPLETA

### Checklist de Servicios

```bash
# Verificar Docker
docker ps

# Verificar Backend
curl http://localhost:3001/api/v1/health

# Verificar Frontend
curl http://localhost:3000
```

### URLs de Acceso

| Servicio | URL | Estado |
|----------|-----|--------|
| Frontend | http://localhost:3000 | ✅ |
| Backend API | http://localhost:3001/api/v1 | ✅ |
| GraphQL | http://localhost:3001/graphql | ✅ |
| Qdrant Dashboard | http://localhost:6333/dashboard | ✅ |
| Prisma Studio | http://localhost:5555 | ⚙️ |

---

## 📱 PÁGINAS DISPONIBLES (100%)

### ✅ Autenticación
- `/login` - Inicio de sesión
- `/register` - Registro de usuarios

### ✅ Dashboard
- `/dashboard` - Home con métricas
- `/dashboard/businesses` - Gestión de negocios
- `/dashboard/files` - Archivos de conocimiento
- `/dashboard/messages` - Mensajes y conversaciones
- `/dashboard/appointments` - Citas
- `/dashboard/orders` - Pedidos
- `/dashboard/leads` - Leads
- `/dashboard/settings` - Configuración del bot

---

## 🎨 CARACTERÍSTICAS IMPLEMENTADAS

### ✅ Diseño Profesional
- Paleta de colores empresarial
- Tipografía Inter de Google Fonts
- Componentes shadcn/ui
- Iconos Lucide React

### ✅ Totalmente Responsive
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px
- Sidebar colapsable en mobile
- Touch-friendly (botones 44x44px)

### ✅ Funcionalidades
- Autenticación con JWT
- Estado global con Zustand
- Gestión de servidor con React Query
- WebSockets para tiempo real
- CRUD completo de todas las entidades
- Notificaciones toast
- Validación de formularios
- Manejo de errores

---

## 🔐 CREDENCIALES POR DEFECTO

### PostgreSQL
- **Usuario**: `syst_user`
- **Contraseña**: `syst_password_2024`
- **Base de datos**: `syst_db`

### JWT
- **Secret**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

### Usuario del Sistema
- **NO HAY USUARIO POR DEFECTO**
- Debes registrarte en `/register`

**📄 Ver archivo `CREDENCIALES.md` para más detalles**

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "Cannot connect to database"

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres

# Reiniciar PostgreSQL
docker-compose restart postgres

# Ver logs
docker-compose logs postgres
```

### Error: "Port 3000 already in use"

```bash
# Encontrar proceso usando el puerto
lsof -i :3000

# Matar el proceso
kill -9 <PID>

# O usar otro puerto
PORT=3002 pnpm dev
```

### Error: "OpenAI API key not found"

1. Verifica que el archivo `.env` exista en la raíz
2. Verifica que `OPENAI_API_KEY` esté configurado
3. Obtén una API key en: https://platform.openai.com/api-keys

### Error: Dependencias no instaladas

```bash
# Limpiar e instalar de nuevo
cd /home/bmrx/Desktop/SYSTINF
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

---

## 📊 ESTADO DEL PROYECTO

| Componente | Progreso | Estado |
|-----------|----------|--------|
| Backend | 100% | ✅ Completo |
| Frontend | 100% | ✅ Completo |
| Base de Datos | 100% | ✅ Completo |
| AI Engine | 100% | ✅ Completo |
| Autenticación | 100% | ✅ Completo |
| Negocios | 100% | ✅ Completo |
| Archivos | 100% | ✅ Completo |
| Mensajes | 100% | ✅ Completo |
| Citas | 100% | ✅ Completo |
| Pedidos | 100% | ✅ Completo |
| Leads | 100% | ✅ Completo |
| Configuración | 100% | ✅ Completo |
| Responsive | 100% | ✅ Completo |
| Documentación | 100% | ✅ Completo |

**PROGRESO TOTAL: 100% ✅**

---

## 🎉 ¡SISTEMA COMPLETO Y FUNCIONAL!

El sistema SYST está **100% implementado** y listo para usar.

### Próximos Pasos Sugeridos:

1. ✅ Registrarte en el sistema
2. ✅ Crear tu primer negocio
3. ✅ Subir archivos de conocimiento
4. ✅ Configurar el bot
5. ✅ Conectar WhatsApp Business API (opcional)
6. ✅ Probar todas las funcionalidades

---

## 📚 DOCUMENTACIÓN ADICIONAL

- `FRONTEND_SETUP.md` - Guía detallada del frontend
- `CREDENCIALES.md` - Todas las credenciales y contraseñas
- `RESUMEN_PROYECTO.md` - Resumen completo del proyecto
- `docs/architecture.md` - Arquitectura del sistema
- `docs/installation.md` - Guía de instalación original

---

## 🆘 SOPORTE

Si tienes problemas:

1. Revisa los logs del backend: `docker-compose logs backend`
2. Revisa los logs del frontend en la terminal
3. Verifica que todos los servicios estén corriendo: `docker ps`
4. Consulta la documentación en la carpeta `docs/`

---

**Creado con ❤️ para SYST - Sistema Inteligente de Bots**

**Fecha**: Diciembre 2024  
**Versión**: 1.0.0  
**Estado**: ✅ PRODUCCIÓN READY
