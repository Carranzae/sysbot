# 🏗️ IMPLEMENTACIÓN META GRAPH API - SISTEMA SaaS
## Sin romper lo existente + Integración con Meta CRM

---

## 🎯 PRINCIPIO FUNDAMENTAL

**NO TOCAR lo que ya funciona:**
- ✅ WhatsApp Business API (mantener como está)
- ✅ WhatsApp Web (mantener como está)
- ✅ Sistema de pagos y evidencias (mantener como está)
- ✅ AI Service (extender, no reemplazar)

**AGREGAR como capa adicional:**
- ➕ Meta Graph API como nuevo módulo
- ➕ Detección de plataforma en el router
- ➕ Servicios adicionales sin modificar los existentes

---

## 🏛️ ARQUITECTURA SaaS MULTI-PLATAFORMA

### **Estructura Actual (Mantener):**

```
Business (Negocio)
  ├── WhatsApp Business API (si está configurado)
  ├── WhatsApp Web (si está configurado)
  └── Bot Config (configuración del bot)
```

### **Estructura Nueva (Agregar):**

```
Business (Negocio)
  ├── WhatsApp Business API (existente - NO TOCAR)
  ├── WhatsApp Web (existente - NO TOCAR)
  ├── Meta Platforms (NUEVO)
  │   ├── Facebook Messenger (opcional)
  │   ├── Instagram Direct (opcional)
  │   └── Meta CRM Connection (opcional)
  └── Bot Config (extender, no reemplazar)
```

---

## 📊 ESTRUCTURA DE BASE DE DATOS

### **1. Nueva Tabla: MetaPlatformConnection**

```prisma
model MetaPlatformConnection {
  id                    String   @id @default(uuid())
  businessId            String
  business              Business @relation(...)
  
  // Configuración de plataformas
  messengerEnabled      Boolean  @default(false)
  messengerPageId       String?
  messengerAccessToken  String?
  messengerVerifyToken  String?
  
  instagramEnabled      Boolean  @default(false)
  instagramAccountId    String?
  instagramAccessToken  String?
  
  // Meta CRM
  crmEnabled           Boolean  @default(false)
  crmAccessToken       String?
  crmPageId            String?
  
  // Estado
  messengerConnected    Boolean  @default(false)
  instagramConnected    Boolean  @default(false)
  crmConnected          Boolean  @default(false)
  
  // Webhook
  webhookUrl            String?
  webhookVerified       Boolean  @default(false)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([businessId])
  @@map("meta_platform_connections")
}
```

**Ventaja:** Cada negocio puede tener sus propias conexiones, sin afectar a otros.

### **2. Extender Tabla Message (Sin romper):**

```prisma
model Message {
  // ... campos existentes (NO TOCAR)
  
  // Nuevos campos (opcionales, no afectan lo existente)
  platform              String?  // 'WHATSAPP_API', 'WHATSAPP_WEB', 'MESSENGER', 'INSTAGRAM'
  platformMessageId     String?  // ID del mensaje en la plataforma original
  platformSenderId      String?  // ID del remitente en la plataforma
  
  @@index([businessId, platform]) // Nuevo índice, no afecta consultas existentes
}
```

**Ventaja:** Los mensajes existentes siguen funcionando, los nuevos pueden tener plataforma.

### **3. Nueva Tabla: CustomerPlatform (Multi-plataforma):**

```prisma
model CustomerPlatform {
  id            String   @id @default(uuid())
  businessId    String
  business      Business @relation(...)
  
  // Identificadores en diferentes plataformas
  phone         String?  // Para WhatsApp (ya existe en Contact)
  messengerId   String?  // ID en Facebook Messenger
  instagramId   String?  // ID en Instagram
  whatsappId    String?  // ID en WhatsApp (si es diferente al phone)
  
  // Información unificada
  unifiedName   String?
  unifiedEmail  String?
  unifiedPhone  String?  // Teléfono principal
  
  // Relación con Contact existente (opcional)
  contactId     String?
  contact       Contact? @relation(...)
  
  // Metadata
  preferredPlatform String? // 'WHATSAPP', 'MESSENGER', 'INSTAGRAM'
  lastActivePlatform String?
  lastActiveAt      DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([businessId, phone])
  @@unique([businessId, messengerId])
  @@unique([businessId, instagramId])
  @@index([businessId, unifiedPhone])
  @@map("customer_platforms")
}
```

**Ventaja:** Unifica clientes de múltiples plataformas sin tocar la tabla Contact existente.

---

## 🔄 ROUTER DE MENSAJES (Sin romper lo existente)

### **Estrategia: Middleware Pattern**

```typescript
// apps/backend/src/modules/meta/meta-router.service.ts

@Injectable()
export class MetaRouterService {
  constructor(
    private whatsappService: WhatsappService,        // Existente
    private whatsappWebService: WhatsappWebService,        // Existente
    private messengerService: MessengerService,           // NUEVO
    private instagramService: InstagramService,           // NUEVO
    private aiService: AiService,                          // Existente (extender)
  ) {}

  /**
   * Router principal - decide a dónde enviar el mensaje
   * NO modifica los servicios existentes, solo los llama
   */
  async routeIncomingMessage(
    businessId: string,
    platform: 'WHATSAPP_API' | 'WHATSAPP_WEB' | 'MESSENGER' | 'INSTAGRAM',
    messageData: any
  ) {
    // Obtener configuración del negocio
    const config = await this.getBusinessConfig(businessId);
    
    // Router según plataforma (sin tocar servicios existentes)
    switch (platform) {
      case 'WHATSAPP_API':
        // Usar servicio existente - NO TOCAR
        return await this.whatsappService.handleIncomingMessage(messageData);
        
      case 'WHATSAPP_WEB':
        // Usar servicio existente - NO TOCAR
        return await this.whatsappWebService.handleMessage(businessId, messageData);
        
      case 'MESSENGER':
        // Nuevo servicio - no afecta lo existente
        return await this.messengerService.handleIncomingMessage(businessId, messageData);
        
      case 'INSTAGRAM':
        // Nuevo servicio - no afecta lo existente
        return await this.instagramService.handleIncomingMessage(businessId, messageData);
    }
  }
}
```

**Ventaja:** Los servicios existentes siguen funcionando igual, solo agregamos nuevos.

---

## 🔌 INTEGRACIÓN CON META CRM

### **1. Sincronización Bidireccional:**

```typescript
// apps/backend/src/modules/meta-crm/meta-crm.service.ts

@Injectable()
export class MetaCrmService {
  /**
   * Sincronizar conversaciones desde Meta CRM a tu BD
   * Se ejecuta periódicamente (cron job)
   */
  async syncConversationsFromCRM(businessId: string) {
    const connection = await this.getMetaConnection(businessId);
    if (!connection.crmEnabled) return;
    
    // Obtener conversaciones del CRM
    const conversations = await this.fetchCRMConversations(connection);
    
    // Guardar en tu BD (sin duplicar)
    for (const conv of conversations) {
      await this.syncConversationToDB(businessId, conv);
    }
  }
  
  /**
   * Sincronizar etiquetas y datos desde tu sistema al CRM
   */
  async syncToCRM(businessId: string, customerId: string, data: any) {
    const connection = await this.getMetaConnection(businessId);
    if (!connection.crmEnabled) return;
    
    // Agregar etiquetas al CRM
    if (data.labels) {
      await this.addLabelsToCRM(connection, customerId, data.labels);
    }
    
    // Actualizar información del cliente
    if (data.customerInfo) {
      await this.updateCustomerInCRM(connection, customerId, data.customerInfo);
    }
  }
}
```

### **2. Etiquetas Automáticas desde tu Sistema:**

```typescript
// Cuando se crea un pago pendiente, agregar etiqueta al CRM
async onPaymentCreated(paymentReceiptId: string) {
  const receipt = await this.getPaymentReceipt(paymentReceiptId);
  const customer = await this.getCustomerByPhone(receipt.customerPhone);
  
  // Agregar etiqueta en Meta CRM
  if (customer.messengerId || customer.instagramId) {
    await this.metaCrmService.addLabel(
      receipt.businessId,
      customer.platformId,
      'PAGO_PENDIENTE'
    );
  }
}

// Cuando se verifica un pago, cambiar etiqueta
async onPaymentVerified(paymentReceiptId: string) {
  // Remover 'PAGO_PENDIENTE'
  // Agregar 'PAGO_VERIFICADO'
}
```

---

## 🎯 FLUJO COMPLETO SIN ROMPER NADA

### **Escenario 1: Cliente escribe por WhatsApp Web (Existente)**

```
1. Mensaje llega a WhatsApp Web Service (existente)
   ↓
2. WhatsApp Web Service procesa (como siempre)
   ↓
3. Guarda en Message con platform = 'WHATSAPP_WEB'
   ↓
4. AI Service genera respuesta (existente)
   ↓
5. Envía respuesta por WhatsApp Web (existente)
   ↓
6. OPCIONAL: Si tiene CRM conectado, sincroniza
```

**Resultado:** Todo funciona igual que antes, solo agregamos campo `platform`.

### **Escenario 2: Cliente escribe por Messenger (Nuevo)**

```
1. Webhook de Meta recibe mensaje de Messenger
   ↓
2. Meta Router detecta: platform = 'MESSENGER'
   ↓
3. Messenger Service procesa (NUEVO, no afecta WhatsApp)
   ↓
4. Guarda en Message con platform = 'MESSENGER'
   ↓
5. AI Service genera respuesta (mismo servicio, con contexto de plataforma)
   ↓
6. Messenger Service envía respuesta (NUEVO)
   ↓
7. OPCIONAL: Sincroniza con Meta CRM
```

**Resultado:** Nuevo flujo paralelo, no afecta WhatsApp.

### **Escenario 3: Cliente escribe por Instagram (Nuevo)**

```
1. Webhook de Meta recibe mensaje de Instagram
   ↓
2. Meta Router detecta: platform = 'INSTAGRAM'
   ↓
3. Instagram Service procesa (NUEVO)
   ↓
4. Guarda en Message con platform = 'INSTAGRAM'
   ↓
5. AI Service genera respuesta (adaptada para Instagram - más concisa)
   ↓
6. Instagram Service envía respuesta (NUEVO)
   ↓
7. OPCIONAL: Sincroniza con Meta CRM
```

**Resultado:** Nuevo flujo paralelo, no afecta WhatsApp ni Messenger.

---

## 🔧 IMPLEMENTACIÓN PASO A PASO

### **Paso 1: Crear Tablas (Migración)**

```bash
# Crear migración sin tocar tablas existentes
npx prisma migrate dev --name add_meta_platforms
```

**Tablas nuevas:**
- `MetaPlatformConnection` (configuración por negocio)
- `CustomerPlatform` (unificación de clientes)

**Tablas extendidas:**
- `Message` (agregar campos `platform`, `platformMessageId`, `platformSenderId`)
- `BotConfig` (ya tiene campos, solo verificar)

**Ventaja:** Migración no destructiva, no afecta datos existentes.

### **Paso 2: Crear Módulo Meta (Nuevo, no toca existente)**

```
apps/backend/src/modules/
  ├── meta/                          # NUEVO MÓDULO
  │   ├── meta.module.ts
  │   ├── meta.service.ts            # Servicio principal
  │   ├── meta.controller.ts         # Webhook endpoint
  │   ├── meta-router.service.ts     # Router de mensajes
  │   ├── messenger/
  │   │   ├── messenger.service.ts
  │   │   └── messenger.handler.ts
  │   ├── instagram/
  │   │   ├── instagram.service.ts
  │   │   └── instagram.handler.ts
  │   └── dto/
  │       └── meta-webhook.dto.ts
  │
  ├── whatsapp/                       # EXISTENTE - NO TOCAR
  │   ├── whatsapp.service.ts        # Mantener como está
  │   └── whatsapp-web.service.ts    # Mantener como está
  │
  ├── meta-crm/                      # NUEVO MÓDULO
  │   ├── meta-crm.module.ts
  │   ├── meta-crm.service.ts        # Sincronización con CRM
  │   └── meta-crm-sync.service.ts   # Jobs de sincronización
```

**Ventaja:** Módulos nuevos, no modifican los existentes.

### **Paso 3: Extender AI Service (Sin romper)**

```typescript
// En ai.service.ts - EXTENDER, no reemplazar

async generateResponse(
  businessId: string,
  customerMessage: string,
  customerPhone?: string,
  context?: {
    platform?: 'WHATSAPP_API' | 'WHATSAPP_WEB' | 'MESSENGER' | 'INSTAGRAM';
    senderId?: string;
  }
): Promise<AIResponse> {
  // ... código existente (NO TOCAR)
  
  // NUEVO: Agregar contexto de plataforma al prompt (opcional)
  if (context?.platform) {
    const platformContext = this.getPlatformContext(context.platform);
    // Agregar al prompt sin modificar la lógica existente
    customPrompt += platformContext;
  }
  
  // ... resto del código existente (NO TOCAR)
}

// NUEVO método (no afecta métodos existentes)
private getPlatformContext(platform: string): string {
  switch (platform) {
    case 'MESSENGER':
      return '\n⚠️ CONTEXTO: Cliente escribiendo desde Facebook Messenger. Puedes usar botones interactivos.';
    case 'INSTAGRAM':
      return '\n⚠️ CONTEXTO: Cliente escribiendo desde Instagram. Sé más conciso (límite de caracteres).';
    default:
      return '';
  }
}
```

**Ventaja:** Método existente sigue funcionando igual, solo agregamos parámetro opcional.

### **Paso 4: Webhook Handler Unificado**

```typescript
// apps/backend/src/modules/meta/meta.controller.ts

@Controller('meta')
export class MetaController {
  constructor(
    private metaRouterService: MetaRouterService,
    private whatsappService: WhatsappService,      // Existente - mantener
    private whatsappWebService: WhatsappWebService, // Existente - mantener
  ) {}

  /**
   * Webhook para Meta (Messenger, Instagram)
   * NO interfiere con webhooks existentes de WhatsApp
   */
  @Post('webhook')
  async handleMetaWebhook(@Req() req: Request, @Res() res: Response) {
    // Verificación de webhook (Meta)
    if (req.query['hub.mode'] === 'subscribe') {
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (token === process.env.META_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }
    
    // Procesar eventos de Meta
    const body = req.body;
    
    if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry || []) {
        // Detectar plataforma
        const platform = entry.id ? 'INSTAGRAM' : 'MESSENGER';
        
        // Obtener businessId desde pageId
        const businessId = await this.getBusinessIdFromPageId(entry.id);
        
        // Procesar mensajes
        for (const event of entry.messaging || []) {
          await this.metaRouterService.routeIncomingMessage(
            businessId,
            platform,
            event
          );
        }
      }
    }
    
    return res.status(200).send('OK');
  }
}
```

**Ventaja:** Nuevo endpoint, no interfiere con webhooks existentes de WhatsApp.

---

## 🏢 GESTIÓN SAAS (Multi-Tenant)

### **1. Configuración por Negocio:**

```typescript
// Cada negocio puede tener diferentes plataformas habilitadas

Business A:
  - WhatsApp Web: ✅ Habilitado
  - Messenger: ✅ Habilitado
  - Instagram: ❌ No habilitado
  - Meta CRM: ✅ Habilitado

Business B:
  - WhatsApp API: ✅ Habilitado
  - WhatsApp Web: ❌ No habilitado
  - Messenger: ✅ Habilitado
  - Instagram: ✅ Habilitado
  - Meta CRM: ❌ No habilitado
```

### **2. Aislamiento de Datos:**

```typescript
// Todas las consultas filtran por businessId
async getMessages(businessId: string, platform?: string) {
  return await this.prisma.message.findMany({
    where: {
      businessId, // Siempre filtrar por negocio
      ...(platform && { platform }), // Filtro opcional por plataforma
    },
  });
}
```

### **3. Configuración Independiente:**

```typescript
// Cada negocio tiene su propia configuración de Meta
async getMetaConfig(businessId: string) {
  return await this.prisma.metaPlatformConnection.findUnique({
    where: { businessId },
  });
}
```

---

## 🔗 INTEGRACIÓN CON META CRM

### **1. Sincronización Automática:**

```typescript
// Cron job que sincroniza cada X minutos
@Cron('*/5 * * * *') // Cada 5 minutos
async syncAllBusinessesToCRM() {
  const businesses = await this.prisma.business.findMany({
    where: {
      metaPlatformConnection: {
        crmEnabled: true,
      },
    },
    include: {
      metaPlatformConnection: true,
    },
  });
  
  for (const business of businesses) {
    await this.syncBusinessToCRM(business.id);
  }
}
```

### **2. Etiquetas Automáticas:**

```typescript
// Cuando ocurre un evento, agregar etiqueta al CRM
async onEvent(event: string, data: any) {
  const businessId = data.businessId;
  const customer = await this.getCustomer(data.customerPhone, businessId);
  
  // Si el cliente está en Messenger/Instagram, agregar etiqueta
  if (customer.messengerId || customer.instagramId) {
    const labels = this.getLabelsForEvent(event, data);
    
    await this.metaCrmService.addLabels(
      businessId,
      customer.platformId,
      labels
    );
  }
}

private getLabelsForEvent(event: string, data: any): string[] {
  switch (event) {
    case 'PAYMENT_PENDING':
      return ['PAGO_PENDIENTE', 'REQUIERE_ATENCION'];
    case 'PAYMENT_VERIFIED':
      return ['PAGO_VERIFICADO', 'CLIENTE_ACTIVO'];
    case 'EVIDENCE_SENT':
      return ['EVIDENCIA_ENVIADA', 'REQUIERE_REVISION'];
    case 'APPOINTMENT_CREATED':
      return ['CITA_AGENDADA', 'CLIENTE_ACTIVO'];
    default:
      return [];
  }
}
```

### **3. Sincronización Bidireccional:**

```typescript
// Desde CRM a tu sistema
async syncFromCRM(businessId: string) {
  const conversations = await this.fetchCRMConversations(businessId);
  
  for (const conv of conversations) {
    // Si el mensaje no existe en tu BD, crearlo
    const exists = await this.prisma.message.findFirst({
      where: {
        businessId,
        platformMessageId: conv.messageId,
      },
    });
    
    if (!exists) {
      await this.createMessageFromCRM(businessId, conv);
    }
  }
}

// Desde tu sistema al CRM
async syncToCRM(businessId: string, messageId: string) {
  const message = await this.prisma.message.findUnique({
    where: { id: messageId },
    include: { business: true },
  });
  
  if (message.platform === 'MESSENGER' || message.platform === 'INSTAGRAM') {
    // El mensaje ya está en el CRM (vino de ahí)
    return;
  }
  
  // Si el mensaje es de WhatsApp pero el cliente también está en Messenger/Instagram
  const customer = await this.getCustomerByPhone(message.from, businessId);
  
  if (customer.messengerId || customer.instagramId) {
    // Sincronizar mensaje al CRM
    await this.sendMessageToCRM(businessId, customer.platformId, message);
  }
}
```

---

## 📱 FRONTEND - CONFIGURACIÓN SAAS

### **Nueva Sección: "Canales de Mensajería"**

```
┌─────────────────────────────────────────┐
│ 📱 Canales de Mensajería                 │
│ ─────────────────────────────────────── │
│                                         │
│ ✅ WhatsApp Business API                │
│    Estado: Conectado                    │
│    [Configurar] [Desconectar]           │
│                                         │
│ ✅ WhatsApp Web                         │
│    Estado: Conectado                    │
│    [Configurar] [Desconectar]           │
│                                         │
│ ⚪ Facebook Messenger                   │
│    Estado: No configurado               │
│    [Conectar con Messenger]             │
│                                         │
│ ⚪ Instagram Direct                     │
│    Estado: No configurado               │
│    [Conectar con Instagram]             │
│                                         │
│ ⚪ Meta CRM                             │
│    Estado: No configurado               │
│    [Conectar con Meta CRM]              │
└─────────────────────────────────────────┘
```

### **Configuración de Messenger (Modal/Página):**

```
┌─────────────────────────────────────────┐
│ 📘 Conectar Facebook Messenger          │
│ ─────────────────────────────────────── │
│                                         │
│ 1. Ve a Facebook Developers            │
│    [Abrir Facebook Developers]         │
│                                         │
│ 2. Crea una App o selecciona existente │
│                                         │
│ 3. Agrega el producto "Messenger"      │
│                                         │
│ 4. Configura Webhook:                  │
│    URL: https://tu-dominio.com/api/v1/meta/webhook│
│    Verify Token: [Generar token]       │
│                                         │
│ 5. Ingresa tus credenciales:           │
│    Page ID: [123456789]                │
│    Page Access Token: [••••••••]       │
│                                         │
│ [Conectar] [Cancelar]                   │
└─────────────────────────────────────────┘
```

### **Vista Unificada de Mensajes:**

```
┌─────────────────────────────────────────┐
│ 💬 Mensajes                             │
│ ─────────────────────────────────────── │
│                                         │
│ [Filtros]                               │
│ [Todos] [WhatsApp] [Messenger] [Instagram]│
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📱 Juan Pérez                        │ │
│ │    WhatsApp Web                      │ │
│ │    "Quiero agendar una cita"        │ │
│ │    Hace 5 minutos                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📘 María García                      │ │
│ │    Facebook Messenger                │ │
│ │    "¿Dónde está mi comprobante?"    │ │
│ │    Hace 10 minutos                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📷 Carlos López                      │ │
│ │    Instagram Direct                  │ │
│ │    "Tengo este malestar" + [imagen] │ │
│ │    Hace 15 minutos                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🔄 FLUJO DE MENSAJES MULTI-PLATAFORMA

### **Ejemplo Real: Cliente escribe desde 3 plataformas**

```
Cliente: Juan Pérez
  - WhatsApp: 51987654321
  - Messenger ID: 123456789
  - Instagram ID: @juanperez

1. Escribe por WhatsApp Web:
   → WhatsApp Web Service (existente)
   → Guarda: platform = 'WHATSAPP_WEB'
   → Responde por WhatsApp

2. Escribe por Messenger:
   → Meta Webhook → Meta Router
   → Messenger Service (nuevo)
   → Guarda: platform = 'MESSENGER'
   → Responde por Messenger
   → Sincroniza con CRM

3. Escribe por Instagram:
   → Meta Webhook → Meta Router
   → Instagram Service (nuevo)
   → Guarda: platform = 'INSTAGRAM'
   → Responde por Instagram
   → Sincroniza con CRM

Resultado: 
- 3 mensajes en tu BD (uno por plataforma)
- Cliente unificado en CustomerPlatform
- Historial completo visible en frontend
- Sincronizado con Meta CRM
```

---

## 🛡️ GARANTÍAS DE NO ROMPER NADA

### **1. Servicios Existentes:**
- ✅ `WhatsappService` - NO se modifica
- ✅ `WhatsappWebService` - NO se modifica
- ✅ `AiService` - Solo se extiende (parámetro opcional)
- ✅ `PaymentService` - NO se modifica
- ✅ `EvidenceService` - NO se modifica

### **2. Endpoints Existentes:**
- ✅ `/api/v1/whatsapp/*` - Siguen funcionando igual
- ✅ `/api/v1/ai/*` - Siguen funcionando igual
- ➕ `/api/v1/meta/*` - Nuevos endpoints

### **3. Base de Datos:**
- ✅ Tablas existentes - NO se modifican
- ✅ Campos existentes - NO se modifican
- ➕ Nuevas tablas - No afectan las existentes
- ➕ Campos opcionales en Message - No afectan consultas existentes

### **4. Frontend:**
- ✅ Páginas existentes - NO se modifican
- ✅ Componentes existentes - NO se modifican
- ➕ Nueva sección "Canales de Mensajería"
- ➕ Nueva vista unificada de mensajes

---

## 📋 PLAN DE IMPLEMENTACIÓN SEGURO

### **Fase 1: Preparación (Sin tocar nada)**
1. ✅ Crear nuevas tablas (MetaPlatformConnection, CustomerPlatform)
2. ✅ Agregar campos opcionales a Message
3. ✅ Ejecutar migración
4. ✅ Verificar que todo sigue funcionando

### **Fase 2: Módulo Meta (Nuevo)**
1. ✅ Crear módulo `meta/`
2. ✅ Crear servicios Messenger e Instagram
3. ✅ Crear Meta Router
4. ✅ Crear webhook handler
5. ✅ Probar sin afectar WhatsApp

### **Fase 3: Extensión AI Service (Mínima)**
1. ✅ Agregar parámetro opcional `context` a `generateResponse`
2. ✅ Agregar método `getPlatformContext` (nuevo)
3. ✅ Verificar que llamadas existentes siguen funcionando

### **Fase 4: Integración CRM (Nuevo)**
1. ✅ Crear módulo `meta-crm/`
2. ✅ Implementar sincronización bidireccional
3. ✅ Implementar etiquetas automáticas
4. ✅ Crear cron jobs de sincronización

### **Fase 5: Frontend (Nuevo)**
1. ✅ Agregar sección "Canales de Mensajería"
2. ✅ Formularios de configuración
3. ✅ Vista unificada de mensajes
4. ✅ Filtros por plataforma

### **Fase 6: Testing**
1. ✅ Probar que WhatsApp sigue funcionando
2. ✅ Probar que WhatsApp Web sigue funcionando
3. ✅ Probar Messenger (nuevo)
4. ✅ Probar Instagram (nuevo)
5. ✅ Probar sincronización con CRM

---

## 🎯 VENTAJAS DE ESTA ARQUITECTURA

### **1. No Rompe Nada:**
- ✅ Servicios existentes intactos
- ✅ Endpoints existentes funcionan igual
- ✅ Base de datos compatible hacia atrás
- ✅ Frontend existente no se modifica

### **2. SaaS Ready:**
- ✅ Cada negocio configura sus propias plataformas
- ✅ Aislamiento de datos por businessId
- ✅ Configuración independiente
- ✅ Escalable para múltiples negocios

### **3. Extensible:**
- ✅ Fácil agregar nuevas plataformas
- ✅ Fácil agregar nuevas funcionalidades
- ✅ Módulos independientes
- ✅ Bajo acoplamiento

### **4. Integración CRM:**
- ✅ Sincronización automática
- ✅ Etiquetas inteligentes
- ✅ Vista unificada
- ✅ Historial completo

---

## 🔐 SEGURIDAD Y AISLAMIENTO SAAS

### **1. Validación de BusinessId:**
```typescript
// Siempre validar que el businessId pertenece al usuario autenticado
async getMetaConfig(businessId: string, userId: string) {
  // Verificar que el usuario tiene acceso a este negocio
  const business = await this.prisma.business.findFirst({
    where: {
      id: businessId,
      ownerId: userId, // O verificar en tabla de permisos
    },
  });
  
  if (!business) {
    throw new ForbiddenException('No tienes acceso a este negocio');
  }
  
  return await this.prisma.metaPlatformConnection.findUnique({
    where: { businessId },
  });
}
```

### **2. Webhook Verification:**
```typescript
// Verificar que el webhook viene de Meta
@Post('webhook')
async handleWebhook(@Req() req: Request) {
  // Verificar firma del webhook
  const signature = req.headers['x-hub-signature-256'];
  const isValid = this.verifyWebhookSignature(req.body, signature);
  
  if (!isValid) {
    throw new UnauthorizedException('Invalid webhook signature');
  }
  
  // ... procesar webhook
}
```

### **3. Aislamiento de Tokens:**
```typescript
// Cada negocio tiene sus propios tokens
// No se comparten entre negocios
const connection = await this.prisma.metaPlatformConnection.findUnique({
  where: { businessId }, // Siempre filtrar por negocio
});
```

---

## 📊 RESUMEN DE CAMBIOS

### **✅ NO SE MODIFICA:**
- Servicios de WhatsApp (Business API y Web)
- Servicios de Pagos y Evidencias
- Estructura de base de datos existente
- Endpoints REST existentes
- Frontend existente

### **➕ SE AGREGA:**
- Nuevo módulo `meta/` (Messenger, Instagram)
- Nuevo módulo `meta-crm/` (sincronización CRM)
- Nuevas tablas (MetaPlatformConnection, CustomerPlatform)
- Campos opcionales en Message
- Nuevos endpoints `/api/v1/meta/*`
- Nueva sección en frontend
- Extensión mínima de AI Service (parámetro opcional)

### **🔄 SE EXTENDEN:**
- AI Service (parámetro opcional `context`)
- Message model (campos opcionales `platform`, etc.)
- BotConfig (ya tiene campos, solo usar)

---

## 🚀 CONCLUSIÓN

**Esta implementación:**
- ✅ No rompe nada existente
- ✅ Es compatible con SaaS (multi-tenant)
- ✅ Integra con Meta CRM
- ✅ Permite múltiples plataformas por negocio
- ✅ Es escalable y mantenible
- ✅ Mantiene aislamiento de datos
- ✅ Fácil de probar y verificar

**Cada negocio puede:**
- Elegir qué plataformas usar
- Configurar independientemente
- Tener sus propios tokens y credenciales
- Ver mensajes unificados en un solo lugar
- Sincronizar con Meta CRM si lo desea










