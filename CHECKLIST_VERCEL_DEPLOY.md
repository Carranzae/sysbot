# ✅ CHECKLIST: Deploy a Vercel - SysBot Frontend

## Antes de Comenzar

- [x] **Problema Identificado:** Referencias hardcodeadas a localhost
- [x] **Soluciones Aplicadas:** Variables de entorno dinámicas
- [x] **Build Local:** ✅ Compilando exitosamente
- [ ] **Vercel Dashboard:** Abierto y listo

---

## PASO 1: Preparar Variables de Entorno

### En tu máquina local (opcional pero recomendado)

```bash
# Probar que funciona localmente
cd /workspaces/sysbot
NEXT_PUBLIC_API_URL=https://[tu-backend]/api/v1 pnpm build
```

> Reemplaza `[tu-backend]` con tu URL real (ej: `api.example.com`)

---

## PASO 2: Configurar Vercel Dashboard

### ⚠️ IMPORTANTE: Necesitas URL real del backend

Obtén primero:
- [ ] URL del backend deployado (ej: `api.sysbot.com` o `backend-prod.vercel.app`)
- [ ] Confirmar que el backend está activo y accesible

### Acceso a Vercel Dashboard

1. Ve a: https://vercel.com/carranzaes-projects/sysbot-frontend
2. Click en **Settings**
3. Click en **Environment Variables**
4. Click en **Add New**

### Añadir Variable 1: NEXT_PUBLIC_API_URL

**Field:**
```
NEXT_PUBLIC_API_URL
```

**Value:**
```
https://[tu-backend-url]/api/v1
```

**Example:**
```
https://api.sysbot.com/api/v1
```

**Environments:** Production, Preview, Development

**Guardar:** Click "Save"

- [ ] Variable `NEXT_PUBLIC_API_URL` configurada

### Añadir Variable 2: NEXT_PUBLIC_WS_URL

**Field:**
```
NEXT_PUBLIC_WS_URL
```

**Value:**
```
wss://[tu-backend-url]
```

**Example:**
```
wss://api.sysbot.com
```

**Environments:** Production, Preview, Development

**Guardar:** Click "Save"

- [ ] Variable `NEXT_PUBLIC_WS_URL` configurada

---

## PASO 3: Commit y Push de Cambios

En tu terminal:

```bash
# Navega a la raíz del proyecto
cd /workspaces/sysbot

# Verifica qué cambió
git status

# Agrega los cambios
git add apps/frontend/.env.local
git add apps/frontend/next.config.js
git add apps/frontend/src/app/\(dashboard\)/clinic/page.tsx
git add apps/frontend/src/app/\(dashboard\)/profile/page.tsx
git add apps/frontend/src/app/\(dashboard\)/channels/page.tsx
git add VERCEL_SETUP.md
git add SOLUCION_VERCEL_DEPLOY.md
git add RESUMEN_FIX_VERCEL.md

# Commit
git commit -m "Fix: Resolver referencias a localhost y configuración de Vercel"

# Push
git push origin main
```

- [ ] Cambios pusheados a GitHub

---

## PASO 4: Trigger Deploy en Vercel

### Opción A: Automático (Recomendado)
- Ya debería activarse automáticamente cuando hiciste `git push`
- Ve a Vercel Dashboard y mira **Deployments**

### Opción B: Manual
1. Ve a Vercel Dashboard
2. Click en **Deployments**
3. Click en **Redeploy** (el más reciente o el main)
4. Selecciona **Redeploy**

- [ ] Deploy iniciado

---

## PASO 5: Monitorear Build

### En Vercel Dashboard

1. Ve a **Deployments** (pestaña superior)
2. Selecciona el deployment más reciente
3. Click en **View Build Logs**

### Busca esto en los logs:

✅ Línea de éxito (debería aparecer):
```
✓ Compiled successfully
```

❌ Errores (no debería aparecer):
```
error: Referenced module could not be found
error: localhost
```

### Timeline típica:
- **0-30 seg:** Clonando repositorio
- **30-60 seg:** Instalando dependencias
- **60-120 seg:** Building packages
- **120-180 seg:** Next.js build
- **Total:** ~2-3 minutos

- [ ] Build completado exitosamente

---

## PASO 6: Verificar Deployment

### Una vez que el build termine:

1. ✅ Si fue **exitoso:**
   - Click en el URL del deployment (ej: `sysbot-frontend-124vqgbfo-carranzaes-projects.vercel.app`)
   - Prueba que carga la página
   - Prueba que puedes hacer login
   - Prueba que las APIs responden

2. ❌ Si falló:
   - Click en **Show Build Logs**
   - Busca la línea de error
   - Consulta la sección "Troubleshooting" en `VERCEL_SETUP.md`

- [ ] Frontend cargando correctamente
- [ ] APIs respondiendo correctamente

---

## PASO 7: Testing Funcional (Opcional pero Recomendado)

### Pruebas manuales:

- [ ] **Login:** Funciona correctamente
- [ ] **Dashboard:** Carga sin errores
- [ ] **Descarga de documentos:** Links no 404
- [ ] **Imágenes:** Se cargan desde API
- [ ] **WebSocket:** Conexión establecida

---

## Troubleshooting Rápido

### ❌ Build sigue fallando
1. Verifica variables de entorno en Vercel Dashboard
2. Asegúrate que la URL del backend sea correcta
3. Prueba localmente: `NEXT_PUBLIC_API_URL=https://[url] pnpm build`

### ❌ "undefined" o localhost en producción
1. Revisa los logs del build
2. Verifica que las env vars fueron guardadas
3. Haz un "Redeploy" después de guardar

### ❌ Imágenes no cargan
1. Verifica que el dominio esté en `next.config.js`
2. Revisa la consola del navegador (DevTools > Network)

### ❌ APIs retornan errores CORS
1. Verifica que `NEXT_PUBLIC_API_URL` sea la URL correcta del backend
2. Asegúrate que el backend acepta requests desde Vercel

---

## ✅ Checklist Final

- [ ] Variables de entorno configuradas en Vercel
- [ ] URL del backend correcta y accesible
- [ ] Cambios pusheados a GitHub
- [ ] Deploy iniciado en Vercel
- [ ] Build completado exitosamente
- [ ] Frontend cargando en Vercel
- [ ] APIs respondiendo correctamente
- [ ] Testing manual realizado

---

## 🎉 ¡Listo!

Si llegaste aquí con todo checkeado, tu deploy está **exitoso** ✅

### Próximos Pasos (Opcionales):
- Configurar dominios personalizados en Vercel
- Configurar SSL/TLS
- Configurar CI/CD avanzado
- Monitorear performance

---

## 📞 Referencia Rápida

**Documentación Completa:**
- 📖 [VERCEL_SETUP.md](../VERCEL_SETUP.md)
- 📖 [SOLUCION_VERCEL_DEPLOY.md](../SOLUCION_VERCEL_DEPLOY.md)

**URLs Importantes:**
- 🔗 Vercel Dashboard: https://vercel.com/carranzaes-projects/sysbot-frontend
- 🔗 GitHub: https://github.com/Carranzae/sysbot

**Comandos Útiles:**
```bash
# Build local
pnpm build

# Build limpio
pnpm clean && pnpm install && pnpm build

# Desarrollo local
pnpm dev
```

---

**Última actualización:** 5 Junio 2026  
**Status:** ✅ Listo para Producción
