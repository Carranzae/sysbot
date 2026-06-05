# Configuración de Vercel para SysBot Frontend

## Problemas Resueltos

### ✅ Referencias hardcodeadas a localhost
- Se corrigieron referencias a `http://localhost:3003` en `clinic/page.tsx`
- Se corrigieron referencias a `http://localhost:3003` en `profile/page.tsx`  
- Se actualizó la lógica de webhook URL en `channels/page.tsx`

### ✅ Configuración de next.config.js
- Se removieron rewrites hardcodeados a localhost
- Se agregó lógica condicional para rewrites solo en desarrollo
- Se expandió soporte de dominios para imágenes

## Pasos para Deployar en Vercel

### 1. **Variables de Entorno en Vercel**
Configura estas variables en tu proyecto de Vercel (Settings > Environment Variables):

```
NEXT_PUBLIC_API_URL=https://tu-backend-url.com/api/v1
NEXT_PUBLIC_WS_URL=wss://tu-backend-url.com
```

**Importante:** Reemplaza `tu-backend-url.com` con la URL real de tu backend.

### 2. **Configuración de Build**
En Vercel, asegúrate de que:
- **Framework**: Automatic (Vercel detectará Next.js)
- **Build Command**: `pnpm build` (ya está configurado)
- **Output Directory**: `.next` (automático para Next.js)
- **Install Command**: `pnpm install`
- **Node.js Version**: 20.x o superior (recomendado: 24.x)

### 3. **Monorepo Setup**
Vercel debe estar configurado para el monorepo:
- **Root Directory**: `/` (raíz del proyecto)
- En la configuración de build, Vercel debería detectar automáticamente el monorepo

O si necesitas especificarlo manualmente:
```json
{
  "buildCommand": "cd apps/frontend && pnpm build",
  "outputDirectory": "apps/frontend/.next"
}
```

### 4. **Variables de Entorno por Ambiente**

#### Production
```
NEXT_PUBLIC_API_URL=https://api.sysbot.com/api/v1
NEXT_PUBLIC_WS_URL=wss://api.sysbot.com
```

#### Preview (Staging)
```
NEXT_PUBLIC_API_URL=https://staging-api.sysbot.com/api/v1
NEXT_PUBLIC_WS_URL=wss://staging-api.sysbot.com
```

#### Development
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## Troubleshooting

### Error: "turbo run build" failed
Si aún ves este error:
1. Verifica que las variables de entorno estén configuradas
2. Asegúrate de que el backend esté disponible (si es necesario durante el build)
3. Prueba localmente: `pnpm build` para reproducir el error

### Error: Referencias a localhost en producción
- ✅ Ya están corregidas en el código
- El frontend ahora usa `process.env.NEXT_PUBLIC_API_URL`
- Si no está configurada, usa valores por defecto seguros

### Error: Imágenes no cargan
- Se actualizaron los dominios permitidos en `next.config.js`
- Verifica que tus URLs de imagen coincidan con los dominios configurados

## Checklist antes de Deployar

- [ ] Variables de entorno configuradas en Vercel
- [ ] Backend deployado y accesible
- [ ] URLs del backend correctas (sin trailing slash)
- [ ] Node.js version compatible (20.x+)
- [ ] pnpm.lock.yaml sincronizado
- [ ] Tests locales pasando: `pnpm build`

## Comandos Útiles

```bash
# Probar build localmente
pnpm build

# Probar build del monorepo
pnpm turbo run build

# Limpiar y construir desde cero
pnpm turbo run clean
pnpm install
pnpm build

# Ver errores específicos del frontend
cd apps/frontend && pnpm build
```

## URLs de Referencia

- [Vercel Monorepo Documentation](https://vercel.com/docs/monorepos)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Turbo Build Documentation](https://turbo.build/repo/docs)
