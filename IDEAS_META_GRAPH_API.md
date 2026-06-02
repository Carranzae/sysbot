# 🚀 IDEAS PARA INTEGRAR META GRAPH API
## Facebook Messenger, Instagram, TikTok y CRM de Meta

---

## 🎯 ¿QUÉ ES META GRAPH API?

Meta Graph API es la API oficial de Facebook/Meta que permite integrar tu bot con:
- **Facebook Messenger** - Mensajes directos en Facebook
- **Instagram Direct** - Mensajes directos en Instagram
- **WhatsApp Business API** - Ya lo tienes parcialmente
- **Meta CRM** - Gestión de clientes unificada

---

## 📱 PLATAFORMAS DISPONIBLES

### **1. Facebook Messenger**
- ✅ Disponible vía Graph API
- ✅ Webhooks para mensajes entrantes
- ✅ Envío de mensajes, imágenes, videos
- ✅ Botones interactivos, respuestas rápidas
- ✅ Integración con páginas de Facebook

### **2. Instagram Direct**
- ✅ Disponible vía Graph API
- ✅ Mensajes directos de Instagram
- ✅ Stories (comentarios y respuestas)
- ✅ Requiere cuenta Business/Creator

### **3. TikTok**
- ⚠️ API limitada (no hay mensajería directa oficial)
- ⚠️ Solo comentarios y engagement
- ⚠️ No hay webhook para mensajes directos
- 💡 Alternativa: Usar API de terceros o esperar a que TikTok lance API oficial

### **4. WhatsApp Business API**
- ✅ Ya lo tienes implementado
- ✅ Puede unificarse con Graph API
- ✅ Mismo sistema de respuestas

---

## 🏗️ ARQUITECTURA SUGERIDA

### **Estructura Multi-Plataforma:**

```
┌─────────────────────────────────────────┐
│         META GRAPH API                  │
│  (Facebook, Instagram, WhatsApp)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Webhook Handler                    │
│  (Detecta plataforma y canaliza)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Message Router                     │
│  (Distribuye según plataforma)          │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬───────────┐
       ▼               ▼           ▼
┌──────────┐   ┌──────────┐  ┌──────────┐
│ Messenger│   │ Instagram │  │ WhatsApp │
│ Handler  │   │  Handler  │  │  Handler │
└────┬─────┘   └─────┬─────┘  └─────┬────┘
     │               │              │
     └───────────────┴──────────────┘
                     │
                     ▼
          ┌──────────────────┐
          │   AI Service      │
          │ (Respuestas unificadas)│
          └──────────┬─────────┘
                     │
                     ▼
          ┌──────────────────┐
          │ Response Sender   │
          │ (Envía según plataforma)│
          └───────────────────┘
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### **1. Nuevo Módulo: Meta Integration**

```
apps/backend/src/modules/
  ├── meta/
  │   ├── meta.module.ts
  │   ├── meta.service.ts          # Servicio principal
  │   ├── meta.controller.ts       # Webhook endpoint
  │   ├── messenger/
  │   │   ├── messenger.service.ts
  │   │   └── messenger.handler.ts
  │   ├── instagram/
  │   │   ├── instagram.service.ts
  │   │   └── instagram.handler.ts
  │   └── dto/
  │       └── meta-webhook.dto.ts
```

### **2. Tabla en BD para Plataformas:**

```prisma
model MessagePlatform {
  id          String   @id @default(uuid())
  platform    String   // 'MESSENGER', 'INSTAGRAM', 'WHATSAPP', 'TIKTOK'
  platformId  String   // ID del mensaje en la plataforma
  senderId    String   // ID del remitente en la plataforma
  businessId  String
  business    Business @relation(...)
  messages    Message[]
  
  @@unique([platform, platformId])
  @@index([businessId, platform])
}
```

### **3. Actualizar Modelo Message:**

```prisma
model Message {
  // ... campos existentes
  platform      String?  // 'MESSENGER', 'INSTAGRAM', 'WHATSAPP', 'TIKTOK'
  platformId    String?  // ID específico de la plataforma
  senderPlatformId String? // ID del remitente en la plataforma
}
```

---

## 📨 WEBHOOK HANDLER UNIFICADO

### **Endpoint: POST /api/v1/meta/webhook**

```typescript
@Post('webhook')
async handleWebhook(@Req() req: Request, @Res() res: Response) {
  const body = req.body;
  
  // Verificación de webhook (Facebook/Instagram)
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token']) {
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }
  
  // Procesar eventos
  if (body.object === 'page' || body.object === 'instagram') {
    body.entry?.forEach((entry: any) => {
      entry.messaging?.forEach((event: any) => {
        // Detectar plataforma
        const platform = entry.id ? 'INSTAGRAM' : 'MESSENGER';
        
        // Procesar mensaje según plataforma
        this.processMessage(platform, event);
      });
    });
  }
  
  return res.status(200).send('OK');
}
```

---

## 🎨 DETECCIÓN Y RESPUESTA POR PLATAFORMA

### **1. Detectar Plataforma:**

```typescript
private detectPlatform(event: any): 'MESSENGER' | 'INSTAGRAM' | 'WHATSAPP' | 'TIKTOK' {
  // Facebook Messenger
  if (event.sender && event.recipient && !event.instagram_username) {
    return 'MESSENGER';
  }
  
  // Instagram
  if (event.instagram_username || event.instagram_user_id) {
    return 'INSTAGRAM';
  }
  
  // WhatsApp (ya implementado)
  if (event.whatsapp_business_account_id) {
    return 'WHATSAPP';
  }
  
  // TikTok (futuro)
  if (event.tiktok_user_id) {
    return 'TIKTOK';
  }
  
  return 'MESSENGER'; // Default
}
```

### **2. Procesar Mensaje Según Plataforma:**

```typescript
async processMessage(platform: string, event: any) {
  const senderId = this.getSenderId(platform, event);
  const messageText = this.getMessageText(platform, event);
  const businessId = await this.getBusinessIdFromPage(event);
  
  // Obtener información del cliente según plataforma
  const customerInfo = await this.getCustomerInfo(platform, senderId, businessId);
  
  // Generar respuesta con contexto de plataforma
  const response = await this.aiService.generateResponse(
    businessId,
    messageText,
    customerInfo.phone,
    {
      platform, // Contexto de plataforma
      senderId,
      customerInfo,
    }
  );
  
  // Enviar respuesta según plataforma
  await this.sendResponse(platform, senderId, response, businessId);
}
```

### **3. Respuestas Personalizadas por Plataforma:**

```typescript
// En AI Service, adaptar respuestas según plataforma
async generateResponse(
  businessId: string,
  message: string,
  customerPhone?: string,
  context?: {
    platform?: 'MESSENGER' | 'INSTAGRAM' | 'WHATSAPP' | 'TIKTOK';
    senderId?: string;
  }
) {
  // Agregar contexto de plataforma al prompt
  let platformContext = '';
  
  if (context?.platform === 'MESSENGER') {
    platformContext = '\n⚠️ CONTEXTO: El cliente está escribiendo desde Facebook Messenger.';
  } else if (context?.platform === 'INSTAGRAM') {
    platformContext = '\n⚠️ CONTEXTO: El cliente está escribiendo desde Instagram Direct.';
    platformContext += '\n⚠️ IMPORTANTE: Instagram tiene límites de caracteres, sé más conciso.';
  } else if (context?.platform === 'TIKTOK') {
    platformContext = '\n⚠️ CONTEXTO: El cliente está escribiendo desde TikTok.';
  }
  
  // ... resto del código de generación de respuesta
}
```

---

## 💬 CARACTERÍSTICAS ESPECÍFICAS POR PLATAFORMA

### **Facebook Messenger:**

**Características:**
- ✅ Botones interactivos
- ✅ Respuestas rápidas (Quick Replies)
- ✅ Plantillas de mensajes
- ✅ Persistent Menu
- ✅ Webview para formularios
- ✅ Envío de archivos

**Ejemplo de Respuesta con Botones:**
```typescript
await this.messengerService.sendMessage(senderId, {
  text: '¿Cómo puedo ayudarte?',
  quick_replies: [
    {
      content_type: 'text',
      title: '📅 Agendar cita',
      payload: 'AGENDAR_CITA'
    },
    {
      content_type: 'text',
      title: '💳 Información de pago',
      payload: 'INFO_PAGO'
    },
    {
      content_type: 'text',
      title: '📋 Ver mis citas',
      payload: 'VER_CITAS'
    }
  ]
});
```

### **Instagram Direct:**

**Características:**
- ✅ Mensajes directos
- ✅ Stories (comentarios y respuestas)
- ✅ Límite de caracteres más estricto
- ✅ Enfoque visual (más imágenes/videos)
- ✅ Respuestas rápidas

**Ejemplo de Respuesta:**
```typescript
await this.instagramService.sendMessage(senderId, {
  text: '¡Hola! 👋 ¿En qué puedo ayudarte?',
  // Instagram es más visual, enviar imagen si es posible
  attachment: {
    type: 'image',
    payload: {
      url: 'https://...' // URL de imagen de bienvenida
    }
  }
});
```

### **TikTok (Limitado):**

**Características:**
- ⚠️ API muy limitada
- ⚠️ Solo comentarios públicos
- ⚠️ No hay mensajería directa oficial
- 💡 Alternativa: Usar API de terceros o esperar API oficial

**Si hay API disponible:**
```typescript
// Comentarios en videos
await this.tiktokService.replyToComment(videoId, commentId, {
  text: 'Gracias por tu comentario! Escríbeme por Instagram o Facebook para más info 📱'
});
```

---

## 🔗 INTEGRACIÓN CON META CRM

### **Meta Business Suite / CRM:**

**Ventajas:**
- ✅ Vista unificada de todos los mensajes
- ✅ Historial de conversaciones
- ✅ Etiquetas y segmentación
- ✅ Respuestas automáticas
- ✅ Análisis y métricas

**Cómo Integrar:**

1. **Conectar con Meta Business API:**
```typescript
// Obtener conversaciones del CRM
async getConversationsFromCRM(businessId: string) {
  const accessToken = await this.getMetaAccessToken(businessId);
  
  const response = await axios.get(
    `https://graph.facebook.com/v18.0/${pageId}/conversations`,
    {
      params: {
        access_token: accessToken,
        fields: 'id,participants,messages{id,message,from,created_time}'
      }
    }
  );
  
  return response.data;
}
```

2. **Sincronizar con tu BD:**
```typescript
// Sincronizar conversaciones del CRM con tu BD
async syncCRMConversations(businessId: string) {
  const conversations = await this.getConversationsFromCRM(businessId);
  
  for (const conversation of conversations) {
    // Guardar en tu BD
    await this.prisma.message.createMany({
      data: conversation.messages.map(msg => ({
        businessId,
        platform: 'MESSENGER',
        platformId: msg.id,
        content: msg.message,
        from: msg.from.id,
        // ...
      }))
    });
  }
}
```

3. **Etiquetas y Segmentación:**
```typescript
// Agregar etiquetas desde tu sistema al CRM
async addLabelToConversation(conversationId: string, label: string) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${conversationId}/labels`,
    {
      access_token: accessToken,
      name: label // Ej: 'PAGO_PENDIENTE', 'CITA_AGENDADA'
    }
  );
}
```

---

## 🎯 FLUJO COMPLETO MULTI-PLATAFORMA

### **Ejemplo: Cliente pregunta por pago desde Instagram**

```
1. Cliente escribe en Instagram: "¿Dónde está mi comprobante?"
   ↓
2. Webhook recibe evento de Instagram
   ↓
3. Sistema detecta: platform = 'INSTAGRAM'
   ↓
4. Busca cliente por Instagram ID
   ↓
5. AI genera respuesta adaptada para Instagram (más concisa)
   ↓
6. Busca comprobante en BD
   ↓
7. Envía respuesta por Instagram:
   "Aquí está tu comprobante 📄 [imagen del comprobante]"
   ↓
8. Opcional: Sincroniza con Meta CRM
```

### **Ejemplo: Cliente envía evidencia desde Messenger**

```
1. Cliente envía foto en Messenger: "Tengo este malestar"
   ↓
2. Webhook recibe evento de Messenger
   ↓
3. Sistema detecta: platform = 'MESSENGER'
   ↓
4. Descarga imagen
   ↓
5. Crea Evidence en BD
   ↓
6. Envía al especialista (número configurado)
   ↓
7. Responde en Messenger con botones:
   "✅ Evidencia recibida. ¿Quieres que la evalúe el especialista?"
   [Botón: Sí] [Botón: No]
```

---

## 📊 VENTAJAS DE INTEGRACIÓN MULTI-PLATAFORMA

### **1. Un Solo Bot para Todas las Plataformas:**
- ✅ Misma lógica de negocio
- ✅ Mismo AI y conocimiento
- ✅ Respuestas consistentes
- ✅ Menos código duplicado

### **2. Vista Unificada:**
- ✅ Todos los mensajes en un solo lugar
- ✅ Historial completo del cliente
- ✅ No importa desde dónde escriba

### **3. CRM Integrado:**
- ✅ Etiquetas automáticas
- ✅ Segmentación de clientes
- ✅ Métricas unificadas
- ✅ Respuestas más inteligentes

### **4. Escalabilidad:**
- ✅ Fácil agregar nuevas plataformas
- ✅ Mismo sistema de pagos y evidencias
- ✅ Mismo sistema de citas

---

## 🔐 CONFIGURACIÓN NECESARIA

### **1. Meta App Setup:**

**En Facebook Developers:**
1. Crear App de tipo "Business"
2. Agregar productos:
   - Messenger
   - Instagram
   - WhatsApp (si no lo tienes)
3. Configurar Webhooks
4. Obtener Access Tokens
5. Configurar permisos

### **2. Variables de Entorno:**

```env
# Meta Graph API
META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret
META_VERIFY_TOKEN=tu_verify_token
META_ACCESS_TOKEN=tu_access_token

# Facebook Messenger
MESSENGER_PAGE_ID=tu_page_id
MESSENGER_PAGE_ACCESS_TOKEN=tu_page_token

# Instagram
INSTAGRAM_BUSINESS_ACCOUNT_ID=tu_instagram_id
INSTAGRAM_ACCESS_TOKEN=tu_instagram_token

# Webhook
META_WEBHOOK_URL=https://tu-dominio.com/api/v1/meta/webhook
```

### **3. Permisos Necesarios:**

```
pages_messaging          # Enviar/recibir mensajes en Messenger
instagram_basic          # Acceso básico a Instagram
instagram_manage_messages # Gestionar mensajes de Instagram
pages_read_engagement    # Leer engagement de páginas
business_management       # Gestionar negocio en Meta
```

---

## 🎨 INTERFAZ EN EL FRONTEND

### **Nueva Sección: "Canales de Mensajería"**

```
┌─────────────────────────────────────────┐
│ 📱 Canales de Mensajería                │
│ ─────────────────────────────────────── │
│                                         │
│ ✅ WhatsApp Business API                │
│    Estado: Conectado                    │
│                                         │
│ ✅ Facebook Messenger                   │
│    Estado: Conectado                    │
│    Página: Mi Negocio                   │
│                                         │
│ ✅ Instagram Direct                     │
│    Estado: Conectado                    │
│    Cuenta: @minegocio                   │
│                                         │
│ ⚠️ TikTok                               │
│    Estado: No disponible                │
│    (API limitada)                       │
│                                         │
│ [Configurar Messenger]                  │
│ [Configurar Instagram]                  │
└─────────────────────────────────────────┘
```

### **Configuración de Messenger:**

```
┌─────────────────────────────────────────┐
│ 📘 Facebook Messenger                   │
│ ─────────────────────────────────────── │
│                                         │
│ Page ID: [123456789]                    │
│ Page Access Token: [••••••••]           │
│                                         │
│ Webhook URL:                            │
│ https://tu-dominio.com/api/v1/meta/webhook│
│                                         │
│ [Verificar Webhook]                     │
│ [Probar Conexión]                       │
│                                         │
│ ✅ Webhook verificado                   │
│ ✅ Conexión exitosa                     │
└─────────────────────────────────────────┘
```

### **Vista de Mensajes Multi-Plataforma:**

```
┌─────────────────────────────────────────┐
│ 💬 Mensajes                             │
│ ─────────────────────────────────────── │
│                                         │
│ [Filtros: Todos | Messenger | Instagram]│
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📘 Juan Pérez                        │ │
│ │    Facebook Messenger                │ │
│ │    "Quiero agendar una cita"        │ │
│ │    Hace 5 minutos                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📷 María García                      │ │
│ │    Instagram Direct                  │ │
│ │    "¿Dónde está mi comprobante?"    │ │
│ │    Hace 10 minutos                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Facebook Messenger**
1. Crear Meta App
2. Configurar Webhook
3. Implementar Messenger Service
4. Integrar con AI Service
5. Probar envío/recepción

### **Fase 2: Instagram Direct**
1. Conectar cuenta Business de Instagram
2. Configurar permisos
3. Implementar Instagram Service
4. Adaptar respuestas (más concisas)
5. Probar integración

### **Fase 3: Meta CRM**
1. Conectar con Meta Business API
2. Sincronizar conversaciones
3. Implementar etiquetas
4. Vista unificada en frontend

### **Fase 4: Optimización**
1. Caché de información de clientes
2. Respuestas personalizadas por plataforma
3. Analytics y métricas
4. Dashboard multi-plataforma

---

## 💡 IDEAS ADICIONALES

### **1. Respuestas Adaptadas por Plataforma:**

```typescript
// Messenger: Puede ser más largo, con botones
const messengerResponse = {
  text: 'Aquí está la información completa...',
  buttons: [...]
};

// Instagram: Más conciso, más visual
const instagramResponse = {
  text: 'Info aquí 📋',
  image: 'https://...'
};

// WhatsApp: Ya implementado
const whatsappResponse = {
  text: 'Información...',
  media: [...]
};
```

### **2. Identificación Unificada de Clientes:**

```typescript
// Un cliente puede escribir desde múltiples plataformas
// Necesitamos identificarlo de forma unificada

model Customer {
  id          String
  // IDs en diferentes plataformas
  messengerId String?
  instagramId String?
  whatsappId  String?
  tiktokId    String?
  // Información unificada
  name        String?
  email       String?
  phone       String?
  // Historial unificado
  messages    Message[]
}
```

### **3. Notificaciones Multi-Plataforma:**

```typescript
// Enviar notificación en todas las plataformas donde el cliente esté activo
async sendNotificationToAllPlatforms(customerId: string, message: string) {
  const customer = await this.getCustomer(customerId);
  
  if (customer.messengerId) {
    await this.messengerService.sendMessage(customer.messengerId, message);
  }
  
  if (customer.instagramId) {
    await this.instagramService.sendMessage(customer.instagramId, message);
  }
  
  if (customer.whatsappId) {
    await this.whatsappService.sendMessage(customer.whatsappId, message);
  }
}
```

### **4. Analytics Multi-Plataforma:**

```typescript
// Métricas por plataforma
type PlatformStats = {
  messenger: {
    totalMessages: number;
    responseTime: number;
    satisfaction: number;
  };
  instagram: {
    totalMessages: number;
    responseTime: number;
    satisfaction: number;
  };
  whatsapp: {
    totalMessages: number;
    responseTime: number;
    satisfaction: number;
  };
};
```

---

## 📋 RESUMEN DE IMPLEMENTACIÓN

### **Backend:**
- ✅ Nuevo módulo `meta/` para Graph API
- ✅ Servicios: `messenger.service.ts`, `instagram.service.ts`
- ✅ Webhook handler unificado
- ✅ Detección de plataforma
- ✅ Respuestas adaptadas

### **Base de Datos:**
- ✅ Campo `platform` en `Message`
- ✅ Tabla `Customer` con IDs multi-plataforma
- ✅ Sincronización con Meta CRM

### **Frontend:**
- ✅ Sección "Canales de Mensajería"
- ✅ Configuración de Messenger/Instagram
- ✅ Vista unificada de mensajes
- ✅ Filtros por plataforma

### **Integración:**
- ✅ Meta App configurada
- ✅ Webhooks funcionando
- ✅ Access Tokens configurados
- ✅ Sincronización con CRM

---

## 🎯 CONCLUSIÓN

**Meta Graph API te permite:**
- ✅ Unificar todas las plataformas en un solo bot
- ✅ Misma lógica de negocio (pagos, evidencias, citas)
- ✅ Vista unificada de conversaciones
- ✅ Integración con Meta CRM
- ✅ Escalable para nuevas plataformas
- ✅ Mejor experiencia para el cliente (puede escribir desde donde quiera)

**Recomendación:** Empezar con Facebook Messenger (más fácil), luego Instagram, y finalmente integrar con Meta CRM para gestión unificada.










