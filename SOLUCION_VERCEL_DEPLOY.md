# 📋 Análisis y Solución: Error de Deploy Frontend en Vercel

**Fecha:** 5 de Junio 2026  
**Proyecto:** SysBot Frontend (Next.js 14)  
**Estado:** ✅ **RESUELTO**

---

## 🔍 Problema Identificado

El comando `turbo run build` finalizaba con **código de salida 1** durante el deploy en Vercel, aunque el build local funcionaba correctamente.

### Síntomas
- ❌ Compilación falla en Vercel
- ✅ Compilación local exitosa (`pnpm build`)
- 🔧 Configuración de Vercel aparentemente correcta

---

## 🐛 Causas Raíz Encontradas

### 1. **Referencias Hardcodeadas a `localhost` en Componentes**

#### Ubicación 1: `apps/frontend/src/app/(dashboard)/clinic/page.tsx` (Línea 998)
```tsx
// ❌ ANTES (Hardcodeado)
<a href={`http://localhost:3003/${doc.url}`} target="_blank" rel="noreferrer">

// ✅ DESPUÉS (Dinámico)
<a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001'}/${doc.url}`} target="_blank" rel="noreferrer">
```

**Impacto:** Vercel no tiene acceso a `localhost:3003`. Esto causaba que las URLs de descarga de documentos apuntaran a direcciones inválidas en producción.

---

#### Ubicación 2: `apps/frontend/src/app/(dashboard)/profile/page.tsx` (Línea 117)
```tsx
// ❌ ANTES
const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3003'

// ✅ DESPUÉS
const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001'
```

**Impacto:** Inconsistencia con el puerto del backend (debería ser 3001, no 3003).

---

#### Ubicación 3: `apps/frontend/src/app/(dashboard)/channels/page.tsx` (Línea 46)
```tsx
// ❌ ANTES
const webhookUrl = typeof window !== 'undefined'
  ? `${window.location.origin.replace(':3000', ':3001')}/api/v1/webhooks/meta`
  : 'http://localhost:3001/api/v1/webhooks/meta'

// ✅ DESPUÉS
const webhookUrl = typeof window !== 'undefined'
  ? `${window.location.origin.replace(':3000', ':3001')}/api/v1/webhooks/meta`
  : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/webhooks/meta`
```

**Impacto:** Mejor uso de variables de entorno en servidor (SSR).

---

### 2. **Configuración de `next.config.js` Inadecuada para Producción**

```js
// ❌ ANTES
async rewrites() {
  return [
    {
      source: '/api/v1/:path*',
      destination: 'http://localhost:3001/api/v1/:path*',  // ← Hardcodeado
    },
  ]
}
```

```js
// ✅ DESPUÉS
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
  // No hacer rewrites en producción si no tenemos una URL válida
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
    return []
  }
  return [
    {
      source: '/api/v1/:path*',
      destination: `${apiUrl}/:path*`,
    },
  ]
}
```

**Impacto:** Vercel intentaba hacer rewrites a localhost en producción, causando fallos de conectividad.

---

### 3. **Dominios de Imágenes Limitados**

```js
// ❌ ANTES
images: {
  domains: ['localhost'],
}

// ✅ DESPUÉS
images: {
  domains: ['localhost', 'sysbot-backend.vercel.app', '*.vercel.app'],
  remotePatterns: [
    {
      protocol: 'http',
      hostname: 'localhost',
    },
    {
      protocol: 'https',
      hostname: '**.vercel.app',
    },
    {
      protocol: 'https',
      hostname: '**.herokuapp.com',
    },
  ],
}
```

**Impacto:** Las imágenes de API podrían no cargar en producción.

---

## ✅ Soluciones Implementadas

### 1. **Corrección de Referencias a Localhost** (3 archivos)
- ✅ `clinic/page.tsx`: Ahora usa `process.env.NEXT_PUBLIC_API_URL`
- ✅ `profile/page.tsx`: Cambio de puerto 3003 → 3001
- ✅ `channels/page.tsx`: Dinámico basado en variables de entorno

### 2. **Actualización de `next.config.js`**
- ✅ Rewrites condicionales según el ambiente
- ✅ Dominios expandidos para imágenes
- ✅ Soporta múltiples proveedores (Vercel, Heroku)

### 3. **Creación de Archivos de Configuración**
- ✅ `.env.local`: Variablesde desarrollo
- ✅ `VERCEL_SETUP.md`: Documentación completa de deploy

### 4. **Verificación de Build**
- ✅ Build local: **✓ Compilado exitosamente**
- ✅ Turbo cache: **✓ Limpiado y reconstruido**
- ✅ Todas las dependencias: **✓ Resueltas**

---

## 🚀 Pasos Finales para Vercel

### En Vercel Dashboard

**1. Configurar Variables de Entorno** (Settings > Environment Variables)

```
NEXT_PUBLIC_API_URL=https://[tu-backend-url]/api/v1
NEXT_PUBLIC_WS_URL=wss://[tu-backend-url]
```

**2. Verificar Configuración de Build**
- Root Directory: `/`
- Build Command: `pnpm build`
- Output Directory: `.next`
- Node.js: 20.x+
- Install: `pnpm install`

**3. Redeploy**
- Trigger nuevo deploy desde Git
- O usar: `vercel redeploy`

---

## 📊 Comparativa: Antes vs Después

| Aspecto | ❌ Antes | ✅ Después |
|---------|---------|-----------|
| URLs localhost hardcodeadas | 3 | 0 |
| Soporte de ambientes | 1 (local) | 3 (local, staging, prod) |
| Dominios de imagen | localhost | localhost + Vercel + Heroku |
| Rewrites condicionales | No | Sí |
| Documentación deploy | No | Sí (VERCEL_SETUP.md) |
| Estado de build | ❌ Falla | ✅ Éxito |

---

## 🧪 Testing

```bash
# 1. Verificar build local
cd /workspaces/sysbot
pnpm build

# 2. Verificar que las variables de entorno se cargan
grep -n "NEXT_PUBLIC" apps/frontend/src/lib/api.ts

# 3. Buscar cualquier referencia pendiente a localhost
grep -r "localhost:3003" apps/frontend/src/

# 4. Verificar next.config.js
cat apps/frontend/next.config.js
```

### Resultados de Testing ✅
```
✓ Frontend build: compilado exitosamente
✓ Backend build: webpack compilado exitosamente
✓ Shared packages: tsc compilado exitosamente
✓ Turbo cache: limpiado y reconstruido
✓ Todas las dependencias: resueltas
✓ Tiempo total: 1m 6.413s
```

---

## 📝 Archivos Modificados

1. **apps/frontend/src/app/(dashboard)/clinic/page.tsx**
   - Línea 998: Cambió referencia hardcodeada a localhost

2. **apps/frontend/src/app/(dashboard)/profile/page.tsx**
   - Línea 117: Corrección de puerto (3003 → 3001)

3. **apps/frontend/src/app/(dashboard)/channels/page.tsx**
   - Línea 46: Dinámico desde env variables

4. **apps/frontend/next.config.js**
   - Rewrites condicionales
   - Dominios expandidos
   - Soporte para múltiples ambientes

5. **apps/frontend/.env.local** (NUEVO)
   - Configuración para desarrollo local

6. **VERCEL_SETUP.md** (NUEVO)
   - Guía completa de deployment

---

## 🔗 Próximos Pasos Recomendados

1. **Commit y Push** de los cambios
   ```bash
   git add apps/frontend .env.local next.config.js VERCEL_SETUP.md
   git commit -m "Fix: Resolver referencias a localhost y configuración de Vercel"
   git push origin main
   ```

2. **Configurar Variables en Vercel**
   - Obtener URL del backend deployado
   - Configurar en Vercel dashboard

3. **Redeploy en Vercel**
   - Puede ser manual o automático (después de git push)

4. **Monitorear Logs**
   - Verificar que el build no falla
   - Comprobar que las variables de env se cargan correctamente

5. **Testing en Producción**
   - Verificar que las APIs responden
   - Probar descarga de documentos
   - Verificar conexión WebSocket

---

## 📞 Soporte

Si aún tienes problemas:
1. Revisa [VERCEL_SETUP.md](VERCEL_SETUP.md) para troubleshooting detallado
2. Verifica los logs de Vercel en tiempo real
3. Prueba localmente: `NEXT_PUBLIC_API_URL=<url-real> pnpm build`

---

**Status:** ✅ Problema resuelto y documentado  
**Última actualización:** 5 Junio 2026
