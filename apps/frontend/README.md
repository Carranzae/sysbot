# SYST Frontend

Panel web profesional y responsive para el Sistema Inteligente de Bots.

## 🚀 Instalación

### 1. Instalar dependencias

Desde la raíz del monorepo:

```bash
cd /home/bmrx/Desktop/SYSTINF
pnpm install
```

### 2. Configurar variables de entorno

Las variables ya están configuradas en el archivo raíz `.env`

### 3. Iniciar en desarrollo

```bash
cd apps/frontend
pnpm dev
```

La aplicación estará disponible en: http://localhost:3000

## 📱 Características

### ✅ Diseño Responsive
- **Mobile First**: Optimizado para dispositivos móviles
- **Tablet**: Adaptable a tablets (iPad, Android tablets)
- **Desktop**: Experiencia completa en pantallas grandes
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)

### ✅ Compatibilidad de Dispositivos
- ✅ iPhone (todas las versiones)
- ✅ Android (gama media y alta)
- ✅ iPad / Tablets Android
- ✅ Computadoras (Windows, Mac, Linux)
- ✅ Navegadores modernos (Chrome, Firefox, Safari, Edge)

### ✅ Optimizaciones
- **Performance**: Code splitting y lazy loading
- **SEO**: Metadata optimizada
- **Accesibilidad**: ARIA labels y navegación por teclado
- **PWA Ready**: Preparado para Progressive Web App

## 🎨 Tecnologías

- **Next.js 14**: Framework React con App Router
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Estilos utility-first
- **shadcn/ui**: Componentes UI profesionales
- **React Query**: Gestión de estado del servidor
- **Zustand**: Estado global
- **Socket.io**: Tiempo real
- **Lucide Icons**: Iconos modernos

## 📂 Estructura

```
src/
├── app/                    # Rutas de Next.js
│   ├── (auth)/            # Páginas de autenticación
│   │   ├── login/         # Inicio de sesión
│   │   └── register/      # Registro
│   ├── (dashboard)/       # Páginas del dashboard
│   │   ├── dashboard/     # Home del dashboard
│   │   ├── businesses/    # Gestión de negocios
│   │   ├── files/         # Archivos de conocimiento
│   │   ├── messages/      # Mensajes y conversaciones
│   │   ├── appointments/  # Citas
│   │   ├── orders/        # Pedidos
│   │   ├── leads/         # Leads
│   │   └── settings/      # Configuración
│   ├── layout.tsx         # Layout principal
│   └── globals.css        # Estilos globales
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes base (shadcn/ui)
│   └── providers.tsx     # Providers de React Query
├── lib/                  # Utilidades
│   ├── api.ts           # Cliente API
│   ├── websocket.ts     # Cliente WebSocket
│   └── utils.ts         # Funciones auxiliares
├── store/               # Estado global (Zustand)
│   ├── auth.ts         # Autenticación
│   └── business.ts     # Negocio seleccionado
└── hooks/              # Custom hooks
    └── use-toast.ts    # Hook de notificaciones
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
pnpm dev

# Build para producción
pnpm build

# Iniciar en producción
pnpm start

# Linting
pnpm lint
```

## 🌐 Responsive Breakpoints

```css
/* Mobile */
@media (min-width: 640px) { /* sm */ }

/* Tablet */
@media (min-width: 768px) { /* md */ }

/* Desktop pequeño */
@media (min-width: 1024px) { /* lg */ }

/* Desktop grande */
@media (min-width: 1280px) { /* xl */ }

/* Desktop extra grande */
@media (min-width: 1536px) { /* 2xl */ }
```

## 📱 Optimizaciones Mobile

- **Touch-friendly**: Botones y áreas táctiles de mínimo 44x44px
- **Gestos**: Soporte para swipe en sidebar
- **Viewport**: Configurado para prevenir zoom en inputs
- **Performance**: Lazy loading de imágenes y componentes
- **Offline**: Service worker para funcionalidad offline (próximamente)

## 🎯 Páginas Implementadas

- ✅ Login (responsive, validación)
- ✅ Registro (responsive, validación)
- ✅ Dashboard (métricas en tiempo real)
- ✅ Layout con sidebar responsive
- ⏳ Gestión de negocios (próximamente)
- ⏳ Archivos de conocimiento (próximamente)
- ⏳ Mensajes y conversaciones (próximamente)
- ⏳ Citas, pedidos y leads (próximamente)

## 🔐 Autenticación

El sistema usa JWT tokens almacenados en localStorage y Zustand para persistencia.

## 🌍 Internacionalización

Actualmente en Español. Preparado para i18n en el futuro.

## 📄 Licencia

Propietario - Todos los derechos reservados
