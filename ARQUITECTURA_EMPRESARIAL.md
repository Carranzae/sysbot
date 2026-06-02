# 🏢 ARQUITECTURA EMPRESARIAL - SISTEMA SYST

## 📐 ARQUITECTURA HORIZONTAL ESCALABLE

El sistema SYST está diseñado con una **arquitectura empresarial horizontal escalable** que permite:

- ✅ **Separación total** entre Frontend y Backend
- ✅ **Escalabilidad horizontal** mediante microservicios
- ✅ **Alta disponibilidad** con balanceo de carga
- ✅ **Mantenibilidad** con código organizado profesionalmente
- ✅ **Extensibilidad** para agregar nuevos módulos fácilmente

---

## 🎯 PRINCIPIOS ARQUITECTÓNICOS

### 1. Separación de Responsabilidades (SoC)
- **Frontend**: Solo presentación y experiencia de usuario
- **Backend**: Solo lógica de negocio y datos
- **Database**: Solo persistencia
- **AI Engine**: Solo inteligencia artificial

### 2. Escalabilidad Horizontal
```
                    ┌─────────────┐
                    │   NGINX     │
                    │ Load Balancer│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │Frontend │       │Frontend │       │Frontend │
   │Instance1│       │Instance2│       │Instance3│
   └─────────┘       └─────────┘       └─────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │   API GW    │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │Backend  │       │Backend  │       │Backend  │
   │Instance1│       │Instance2│       │Instance3│
   └─────────┘       └─────────┘       └─────────┘
```

### 3. Clean Architecture
- **Presentation Layer**: UI Components
- **Application Layer**: Use Cases
- **Domain Layer**: Business Logic
- **Infrastructure Layer**: External Services

---

## 📁 ESTRUCTURA DEL PROYECTO

```
SYSTINF/
│
├── apps/                           # Aplicaciones
│   ├── frontend/                   # FRONTEND (Solo Frontend)
│   │   ├── src/
│   │   │   ├── app/               # Next.js App Router
│   │   │   │   ├── (auth)/       # Grupo de autenticación
│   │   │   │   ├── (dashboard)/  # Grupo de dashboard
│   │   │   │   ├── layout.tsx    # Layout raíz
│   │   │   │   └── page.tsx      # Página principal
│   │   │   │
│   │   │   ├── components/        # Componentes React
│   │   │   │   ├── ui/           # Componentes base
│   │   │   │   ├── features/     # Componentes de features
│   │   │   │   └── layouts/      # Layouts
│   │   │   │
│   │   │   ├── lib/              # Utilidades y configuración
│   │   │   │   ├── api/          # Cliente API
│   │   │   │   ├── hooks/        # Custom hooks
│   │   │   │   └── utils/        # Funciones auxiliares
│   │   │   │
│   │   │   ├── store/            # Estado global (Zustand)
│   │   │   │   ├── auth.ts
│   │   │   │   └── business.ts
│   │   │   │
│   │   │   └── types/            # TypeScript types
│   │   │
│   │   ├── public/               # Archivos estáticos
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   │
│   └── backend/                   # BACKEND (Solo Backend)
│       ├── src/
│       │   ├── core/             # Núcleo del sistema
│       │   │   ├── config/       # Configuración
│       │   │   ├── constants/    # Constantes
│       │   │   ├── decorators/   # Decoradores
│       │   │   ├── exceptions/   # Excepciones
│       │   │   ├── filters/      # Filtros
│       │   │   ├── guards/       # Guards
│       │   │   ├── interceptors/ # Interceptores
│       │   │   ├── interfaces/   # Interfaces
│       │   │   ├── middlewares/  # Middlewares
│       │   │   └── pipes/        # Pipes
│       │   │
│       │   ├── modules/          # Módulos de negocio
│       │   │   ├── auth/         # Autenticación
│       │   │   │   ├── controllers/
│       │   │   │   ├── services/
│       │   │   │   ├── dto/
│       │   │   │   ├── entities/
│       │   │   │   ├── guards/
│       │   │   │   └── strategies/
│       │   │   │
│       │   │   ├── users/        # Usuarios
│       │   │   │   ├── controllers/
│       │   │   │   ├── services/
│       │   │   │   ├── dto/
│       │   │   │   ├── entities/
│       │   │   │   └── repositories/
│       │   │   │
│       │   │   ├── business/     # Negocios
│       │   │   ├── files/        # Archivos
│       │   │   ├── messages/     # Mensajes
│       │   │   ├── appointments/ # Citas
│       │   │   ├── orders/       # Pedidos
│       │   │   ├── leads/        # Leads
│       │   │   ├── whatsapp/     # WhatsApp
│       │   │   └── ai/           # Inteligencia Artificial
│       │   │
│       │   ├── shared/           # Compartido
│       │   │   ├── dto/          # DTOs compartidos
│       │   │   ├── entities/     # Entidades compartidas
│       │   │   ├── enums/        # Enumeraciones
│       │   │   ├── interfaces/   # Interfaces compartidas
│       │   │   └── utils/        # Utilidades compartidas
│       │   │
│       │   ├── app.module.ts     # Módulo principal
│       │   └── main.ts           # Punto de entrada
│       │
│       ├── test/                 # Tests
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       │
│       ├── package.json
│       ├── nest-cli.json
│       └── tsconfig.json
│
├── packages/                      # Paquetes compartidos
│   ├── shared/                   # Tipos y utilidades compartidas
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── constants/
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── database/                 # Capa de datos
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── package.json
│   │
│   └── ai-engine/                # Motor de IA
│       ├── src/
│       │   ├── services/
│       │   │   ├── openai.service.ts
│       │   │   ├── vector.service.ts
│       │   │   └── rag.service.ts
│       │   └── index.ts
│       └── package.json
│
├── infrastructure/               # Infraestructura
│   ├── docker/
│   │   ├── frontend/
│   │   │   └── Dockerfile
│   │   ├── backend/
│   │   │   └── Dockerfile
│   │   └── nginx/
│   │       ├── Dockerfile
│   │       └── nginx.conf
│   │
│   ├── kubernetes/              # K8s manifests
│   │   ├── frontend/
│   │   ├── backend/
│   │   ├── database/
│   │   └── ingress/
│   │
│   └── terraform/               # IaC
│       ├── aws/
│       ├── gcp/
│       └── azure/
│
├── docs/                        # Documentación
│   ├── architecture.md
│   ├── api/
│   ├── deployment/
│   └── development/
│
├── scripts/                     # Scripts de utilidad
│   ├── deploy.sh
│   ├── backup.sh
│   └── migrate.sh
│
├── .github/                     # CI/CD
│   └── workflows/
│       ├── frontend.yml
│       ├── backend.yml
│       └── deploy.yml
│
├── docker-compose.yml           # Desarrollo local
├── docker-compose.prod.yml      # Producción
├── package.json                 # Workspace root
└── pnpm-workspace.yaml          # PNPM workspace
```

---

## 🔧 BACKEND - ESTRUCTURA EMPRESARIAL

### Organización por Capas

```
backend/src/
│
├── core/                        # NÚCLEO DEL SISTEMA
│   ├── config/                  # Configuración centralizada
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── jwt.config.ts
│   │
│   ├── constants/               # Constantes del sistema
│   │   ├── error-codes.ts
│   │   ├── response-messages.ts
│   │   └── app.constants.ts
│   │
│   ├── exceptions/              # Excepciones personalizadas
│   │   ├── business.exception.ts
│   │   ├── validation.exception.ts
│   │   └── http.exception.ts
│   │
│   ├── filters/                 # Filtros globales
│   │   ├── http-exception.filter.ts
│   │   └── all-exceptions.filter.ts
│   │
│   ├── guards/                  # Guards globales
│   │   ├── auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── throttle.guard.ts
│   │
│   ├── interceptors/            # Interceptores
│   │   ├── logging.interceptor.ts
│   │   ├── transform.interceptor.ts
│   │   └── timeout.interceptor.ts
│   │
│   ├── interfaces/              # Interfaces core
│   │   ├── response.interface.ts
│   │   └── pagination.interface.ts
│   │
│   ├── middlewares/             # Middlewares
│   │   ├── logger.middleware.ts
│   │   └── cors.middleware.ts
│   │
│   └── pipes/                   # Pipes de validación
│       ├── validation.pipe.ts
│       └── parse-int.pipe.ts
│
├── modules/                     # MÓDULOS DE NEGOCIO
│   ├── auth/                    # Módulo de Autenticación
│   │   ├── controllers/
│   │   │   └── auth.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── token.service.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   ├── entities/
│   │   │   └── session.entity.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   ├── interfaces/
│   │   │   └── jwt-payload.interface.ts
│   │   └── auth.module.ts
│   │
│   ├── users/                   # Módulo de Usuarios
│   │   ├── controllers/
│   │   │   └── users.controller.ts
│   │   ├── services/
│   │   │   ├── users.service.ts
│   │   │   └── users-query.service.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── user-response.dto.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── repositories/
│   │   │   └── users.repository.ts
│   │   ├── interfaces/
│   │   │   └── user.interface.ts
│   │   └── users.module.ts
│   │
│   ├── business/                # Módulo de Negocios
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── repositories/
│   │   └── business.module.ts
│   │
│   └── [otros módulos...]
│
├── shared/                      # COMPARTIDO
│   ├── dto/                     # DTOs base
│   │   ├── pagination.dto.ts
│   │   └── base-response.dto.ts
│   │
│   ├── entities/                # Entidades base
│   │   └── base.entity.ts
│   │
│   ├── enums/                   # Enumeraciones
│   │   ├── user-role.enum.ts
│   │   └── status.enum.ts
│   │
│   ├── interfaces/              # Interfaces compartidas
│   │   └── base.interface.ts
│   │
│   └── utils/                   # Utilidades
│       ├── hash.util.ts
│       ├── date.util.ts
│       └── string.util.ts
│
├── app.module.ts                # Módulo raíz
└── main.ts                      # Bootstrap
```

---

## 🎨 FRONTEND - ESTRUCTURA EMPRESARIAL

### Organización por Features

```
frontend/src/
│
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Grupo: Autenticación
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/             # Grupo: Dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── businesses/
│   │   │   └── page.tsx
│   │   ├── files/
│   │   │   └── page.tsx
│   │   ├── messages/
│   │   │   └── page.tsx
│   │   ├── appointments/
│   │   │   └── page.tsx
│   │   ├── orders/
│   │   │   └── page.tsx
│   │   ├── leads/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/                     # API Routes (si necesario)
│   ├── layout.tsx               # Layout raíz
│   ├── page.tsx                 # Página principal
│   └── globals.css              # Estilos globales
│
├── components/                  # Componentes
│   ├── ui/                      # Componentes base (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── [otros...]
│   │
│   ├── features/                # Componentes por feature
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── business/
│   │   │   ├── BusinessCard.tsx
│   │   │   └── BusinessForm.tsx
│   │   └── [otros...]
│   │
│   ├── layouts/                 # Layouts reutilizables
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   │
│   └── shared/                  # Componentes compartidos
│       ├── Loading.tsx
│       ├── ErrorBoundary.tsx
│       └── EmptyState.tsx
│
├── lib/                         # Librerías y configuración
│   ├── api/                     # Cliente API
│   │   ├── client.ts
│   │   ├── endpoints.ts
│   │   └── interceptors.ts
│   │
│   ├── hooks/                   # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useBusiness.ts
│   │   └── useToast.ts
│   │
│   ├── utils/                   # Utilidades
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   └── helpers.ts
│   │
│   └── config/                  # Configuración
│       ├── constants.ts
│       └── env.ts
│
├── store/                       # Estado global
│   ├── auth.ts
│   ├── business.ts
│   └── ui.ts
│
├── types/                       # TypeScript types
│   ├── api.types.ts
│   ├── models.types.ts
│   └── common.types.ts
│
└── styles/                      # Estilos
    └── themes/
```

---

## 🔄 FLUJO DE DATOS

### Request Flow (Cliente → Servidor)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. User Action
       ▼
┌─────────────┐
│  Component  │
└──────┬──────┘
       │ 2. Call Hook/Service
       ▼
┌─────────────┐
│  API Client │
└──────┬──────┘
       │ 3. HTTP Request
       ▼
┌─────────────┐
│   Backend   │
│  Controller │
└──────┬──────┘
       │ 4. Validate & Route
       ▼
┌─────────────┐
│   Service   │
└──────┬──────┘
       │ 5. Business Logic
       ▼
┌─────────────┐
│ Repository  │
└──────┬──────┘
       │ 6. Data Access
       ▼
┌─────────────┐
│  Database   │
└─────────────┘
```

### Response Flow (Servidor → Cliente)

```
┌─────────────┐
│  Database   │
└──────┬──────┘
       │ 1. Return Data
       ▼
┌─────────────┐
│ Repository  │
└──────┬──────┘
       │ 2. Map to Entity
       ▼
┌─────────────┐
│   Service   │
└──────┬──────┘
       │ 3. Transform to DTO
       ▼
┌─────────────┐
│  Controller │
└──────┬──────┘
       │ 4. HTTP Response
       ▼
┌─────────────┐
│  API Client │
└──────┬──────┘
       │ 5. Update State
       ▼
┌─────────────┐
│  Component  │
└──────┬──────┘
       │ 6. Re-render
       ▼
┌─────────────┐
│   Browser   │
└─────────────┘
```

---

## 🚀 ESCALABILIDAD HORIZONTAL

### Frontend Scaling

```yaml
# kubernetes/frontend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  replicas: 3  # Escalar horizontalmente
  selector:
    matchLabels:
      app: frontend
  template:
    spec:
      containers:
      - name: frontend
        image: syst-frontend:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Backend Scaling

```yaml
# kubernetes/backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  replicas: 5  # Escalar horizontalmente
  selector:
    matchLabels:
      app: backend
  template:
    spec:
      containers:
      - name: backend
        image: syst-backend:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

---

## 📊 PATRONES ARQUITECTÓNICOS

### 1. Repository Pattern
```typescript
// Backend: Abstracción de acceso a datos
export class UsersRepository {
  async findById(id: string): Promise<User> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

### 2. Service Layer Pattern
```typescript
// Backend: Lógica de negocio
export class UsersService {
  constructor(private repository: UsersRepository) {}
  
  async getUser(id: string): Promise<UserDto> {
    const user = await this.repository.findById(id);
    return this.mapToDto(user);
  }
}
```

### 3. DTO Pattern
```typescript
// Transferencia de datos
export class CreateUserDto {
  @IsEmail()
  email: string;
  
  @MinLength(6)
  password: string;
}
```

### 4. Custom Hooks Pattern
```typescript
// Frontend: Lógica reutilizable
export function useAuth() {
  const [user, setUser] = useState(null);
  
  const login = async (credentials) => {
    const response = await api.login(credentials);
    setUser(response.user);
  };
  
  return { user, login };
}
```

---

## 🔒 SEGURIDAD EMPRESARIAL

### Capas de Seguridad

1. **Frontend**
   - HTTPS obligatorio
   - CSP (Content Security Policy)
   - XSS Protection
   - CSRF Tokens

2. **Backend**
   - JWT Authentication
   - Role-Based Access Control (RBAC)
   - Rate Limiting
   - Input Validation
   - SQL Injection Prevention

3. **Database**
   - Encrypted at rest
   - SSL connections
   - Backup automático
   - Audit logs

---

## 📈 MONITOREO Y OBSERVABILIDAD

```
┌──────────────┐
│  Prometheus  │ ← Métricas
└──────┬───────┘
       │
┌──────▼───────┐
│   Grafana    │ ← Visualización
└──────────────┘

┌──────────────┐
│     ELK      │ ← Logs
│  (Elastic)   │
└──────────────┘

┌──────────────┐
│    Sentry    │ ← Errores
└──────────────┘
```

---

## ✅ VENTAJAS DE ESTA ARQUITECTURA

1. **Escalabilidad**: Cada capa puede escalar independientemente
2. **Mantenibilidad**: Código organizado y fácil de mantener
3. **Testabilidad**: Cada módulo se puede testear aisladamente
4. **Flexibilidad**: Fácil agregar nuevas features
5. **Performance**: Optimizado para alta carga
6. **Seguridad**: Múltiples capas de protección
7. **Observabilidad**: Monitoreo completo del sistema

---

**Arquitectura diseñada para**: Empresas que necesitan escalabilidad, alta disponibilidad y mantenibilidad a largo plazo.
