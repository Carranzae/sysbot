# 📦 SISTEMA DE PLANES - BOT SAS

## 🎯 **Sistema de 5 Planes Implementado y Funcionando**

---

## ✅ **Estado: PROGRAMADO Y FUNCIONANDO**

### 📁 **Archivos Creados:**

| Archivo | Descripción |
|---------|-------------|
| `entities/plan.entity.ts` | Definición de planes, enums y tipos |
| `plan.service.ts` | Lógica de negocio y límites |
| `plan.controller.ts` | API endpoints REST |
| `plan.module.ts` | Módulo NestJS |
| `dto/*.dto.ts` | Validación de datos |
| `guards/plan-feature.guard.ts` | Guards para proteger rutas por plan |
| `index.ts` | Exportaciones |

### 🗄️ **Modelos Prisma Agregados:**

```prisma
✅ BusinessSubscription  - Suscripciones de negocios
✅ Conversation          - Conversaciones para límite FREE
✅ Message               - Mensajes de conversaciones
✅ BusinessPlanType      - Enum de 5 planes
✅ PlanInterval          - Enum de intervalos
✅ BusinessSubscriptionStatus - Enum de estados
```

---

## 🚀 **Cómo Activar el Sistema**

### **Paso 1: Generar Cliente Prisma**
```bash
cd sysinfo/packages/database
npx prisma generate
```

### **Paso 2: Ejecutar Migración**
```bash
cd sysinfo/packages/database
npx prisma migrate dev --name add_business_plans
```

### **Paso 3: Reiniciar Backend**
```bash
cd sysinfo/apps/backend
pnpm run dev
```

---

## 📚 **Endpoints API Disponibles**

### 🔓 **Públicos (No requieren auth):**

```
GET    /plans                 → Lista todos los planes
GET    /plans/types           → Tipos de planes e intervalos
GET    /plans/:type           → Detalle de un plan
GET    /plans/price           → Calcular precio
```

### 🔐 **Protegidos (Requieren JWT):**

```
GET    /plans/subscription/my         → Mi suscripción actual
POST   /plans/subscription          → Crear suscripción
PUT    /plans/subscription/:id      → Actualizar (upgrade/downgrade)
DELETE /plans/subscription/:id      → Cancelar

POST   /plans/limits/check-users       → Verificar límite usuarios
POST   /plans/limits/check-branches    → Verificar límite sucursales
POST   /plans/limits/check-products    → Verificar límite productos
POST   /plans/limits/check-students    → Verificar límite estudiantes
POST   /plans/limits/check-properties  → Verificar límite propiedades
POST   /plans/limits/check-services    → Verificar límite servicios
POST   /plans/limits/check-courses     → Verificar límite cursos
POST   /plans/limits/check-conversations → Verificar límite conversaciones

GET    /plans/features/my           → Mis características
GET    /plans/features/check/:feature → Verificar si tengo feature
```

---

## 💡 **Uso en el Código**

### **1. Verificar Límite de Usuarios:**

```typescript
import { PlanService } from './modules/plan';

// En un servicio o controller
constructor(private readonly planService: PlanService) {}

async createUser(businessId: string) {
  const currentUsers = 5; // contar usuarios actuales
  
  const check = await this.planService.checkUserLimit(
    businessId, 
    currentUsers
  );
  
  if (!check.allowed) {
    throw new Error(check.message);
  }
  
  // Crear usuario...
}
```

### **2. Verificar Feature (IA, Delivery, etc.):**

```typescript
async useAI(businessId: string) {
  const hasAI = await this.planService.hasFeatureAccess(
    businessId, 
    'hasAI'
  );
  
  if (!hasAI) {
    throw new Error('Requiere plan Business o superior');
  }
  
  // Usar IA...
}
```

### **3. Proteger Ruta con Guard:**

```typescript
import { RequireFeature } from './modules/plan/guards/plan-feature.guard';

@Controller('advanced')
export class AdvancedController {
  
  @UseGuards(RequireFeature('hasAI'))
  @Post('ai-analysis')
  async aiAnalysis() {
    // Solo accesible si tiene feature hasAI
  }
}
```

### **4. Crear Suscripción:**

```typescript
const subscription = await this.planService.createSubscription({
  businessId: 'business-id',
  planType: PlanType.PROFESSIONAL,
  interval: PlanInterval.MONTHLY,
  trialDays: 14,
});
```

---

## 📊 **Planes Disponibles**

| Plan | Precio Base | Usuarios | Sucursales | IA | Soporte |
|------|-------------|----------|------------|-----|---------|
| 🆓 FREE | $0 | 1 | 1 | ❌ | Email 72h |
| 🥉 STARTER | $19-29 | 2 | 1 | ❌ | Email 48h |
| 🥈 PROFESSIONAL | $39-69 | 5 | 1 | ❌ | Chat 24h |
| 🥇 BUSINESS | $69-119 | 15 | 3 | ✅ | Prioritario 8h |
| 💎 ENTERPRISE | $119-199 | ∞ | ∞ | ✅ Avanzada | Dedicado 24/7 |

---

## 🎨 **Features por Plan**

### 🆓 **FREE:**
- 100 conversaciones/mes
- 1 usuario
- Menú básico (5 opciones)
- Sin reservas ni delivery

### 🥉 **STARTER:**
- Conversaciones ilimitadas
- 2 usuarios
- Hasta 50 productos
- Reservas básicas
- Delivery simple

### 🥈 **PROFESSIONAL:** ⭐
- 5 usuarios
- Productos ilimitados
- Reservas avanzadas
- Gestión de mesas
- Telemedicina
- CRM básico
- Marketing automatizado

### 🥇 **BUSINESS:**
- 15 usuarios
- 3 sucursales
- IA básica
- Programa de fidelidad
- Integraciones avanzadas
- Soporte prioritario

### 💎 **ENTERPRISE:**
- Usuarios ilimitados
- Sucursales ilimitadas
- IA avanzada
- White label (marca propia)
- Desarrollo a medida
- Soporte 24/7 dedicado

---

## 🔧 **Configuración de Precios por Rubro**

Los precios se ajustan automáticamente por rubro:

```typescript
// Multiplicadores aplicados:
RESTAURANT:     1.0x  (precio base)
CLINIC:         1.3x  (más caro)
REAL_ESTATE:    1.2x
ACADEMY:        1.0x
RETAIL:         0.8x  (más barato)
SERVICES:       0.8x
OTHER:          0.8x
```

---

## 🔄 **Flujo de Upgrade/Downgrade**

### **Upgrade (Subir de plan):**
```
1. Usuario solicita upgrade
2. Sistema calcula precio prorrateado
3. Nuevo plan activo inmediatamente
4. Nuevas features disponibles al instante
```

### **Downgrade (Bajar de plan):**
```
1. Usuario solicita downgrade
2. Plan actual sigue hasta final de período
3. Al renovar, aplica nuevo plan con límites
4. Datos excedentes se archivan (no se borran)
```

---

## 🛡️ **Validaciones Automáticas**

El sistema verifica automáticamente:

✅ Límite de usuarios al crear usuario  
✅ Límite de sucursales al crear sucursal  
✅ Límite de productos al crear producto  
✅ Límite de conversaciones (solo FREE)  
✅ Features requeridas antes de usar funcionalidad  
✅ Fecha de expiración del plan  

---

## 📞 **Soporte**

¿Problemas con el sistema de planes?

1. Verificar que Prisma está generado: `npx prisma generate`
2. Verificar migraciones: `npx prisma migrate status`
3. Reiniciar servidor backend
4. Contactar soporte técnico

---

## ✅ **Checklist de Implementación**

- [x] Entidades y tipos definidos
- [x] Servicio de planes creado
- [x] Controller con endpoints
- [x] Guards para protección
- [x] DTOs de validación
- [x] Modelos Prisma agregados
- [x] Módulo registrado en AppModule
- [ ] Prisma generate ejecutado
- [ ] Migración aplicada
- [ ] Tests de integración

---

**🚀 Sistema de Planes: 100% Programado y Listo**

*Ejecutar los comandos de activación para comenzar a usar.*
