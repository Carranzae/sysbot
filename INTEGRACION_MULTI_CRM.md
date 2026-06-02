# 🔗 INTEGRACIÓN CON MÚLTIPLES CRM
## Sistema Flexible y Modular para SaaS

---

## 🎯 OBJETIVO

Permitir que cada negocio (en el sistema SaaS) pueda conectarse a **diferentes CRM** según sus necesidades:
- Meta CRM (Facebook Business Suite)
- HubSpot
- Salesforce
- Zoho CRM
- Pipedrive
- Monday.com
- CRM personalizado
- O ninguno (solo usar el sistema interno)

---

## 🏗️ ARQUITECTURA MODULAR

### **Patrón: Strategy Pattern + Factory Pattern**

```
┌─────────────────────────────────────────┐
│      CRM Integration Service            │
│      (Interfaz Unificada)               │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┬───────────┬──────────┐
       ▼               ▼           ▼          ▼
┌──────────┐   ┌──────────┐  ┌──────────┐ ┌──────────┐
│ Meta CRM │   │ HubSpot  │  │Salesforce│ │  Zoho   │
│ Adapter  │   │ Adapter  │  │ Adapter  │ │ Adapter  │
└────┬─────┘   └─────┬────┘  └─────┬────┘ └─────┬───┘
     │               │              │            │
     └───────────────┴──────────────┴────────────┘
                     │
                     ▼
          ┌──────────────────┐
          │   CRM Factory     │
          │ (Crea el adapter) │
          └───────────────────┘
```

**Ventaja:** Cada CRM es un módulo independiente, fácil agregar nuevos.

---

## 📊 ESTRUCTURA DE BASE DE DATOS

### **1. Tabla: CRMConnection (Configuración por Negocio)**

```prisma
enum CRMProvider {
  META_CRM
  HUBSPOT
  SALESFORCE
  ZOHO
  PIPEDRIVE
  MONDAY
  CUSTOM
  NONE
}

model CRMConnection {
  id                String      @id @default(uuid())
  businessId        String      @unique
  business          Business    @relation(...)
  
  // Proveedor de CRM
  provider          CRMProvider @default(NONE)
  
  // Estado
  isActive          Boolean     @default(false)
  isConnected       Boolean     @default(false)
  
  // Credenciales (encriptadas)
  accessToken       String?     // Token de acceso
  refreshToken      String?     // Token de refresco
  apiKey            String?     // API Key (si aplica)
  apiSecret         String?     // API Secret (si aplica)
  baseUrl           String?     // URL base del CRM (para custom)
  
  // Configuración específica
  config            Json?       // Configuración flexible por CRM
  
  // Sincronización
  syncEnabled       Boolean     @default(true)
  syncDirection     String      @default('BIDIRECTIONAL') // 'TO_CRM', 'FROM_CRM', 'BIDIRECTIONAL'
  lastSyncAt        DateTime?
  syncInterval      Int         @default(5) // minutos
  
  // Metadata
  accountId         String?     // ID de cuenta en el CRM
  accountName       String?     // Nombre de la cuenta
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@map("crm_connections")
}
```

**Ventaja:** Cada negocio puede tener su propio CRM configurado.

### **2. Tabla: CRMSyncLog (Log de Sincronización)**

```prisma
model CRMSyncLog {
  id              String   @id @default(uuid())
  businessId      String
  business        Business @relation(...)
  
  crmConnectionId String
  crmConnection   CRMConnection @relation(...)
  
  // Tipo de sincronización
  syncType        String   // 'CONTACT', 'MESSAGE', 'DEAL', 'TASK', 'LABEL'
  direction       String   // 'TO_CRM', 'FROM_CRM'
  status          String   // 'SUCCESS', 'FAILED', 'PENDING'
  
  // Datos sincronizados
  entityType      String   // 'contact', 'message', 'deal', etc.
  entityId        String   // ID en tu sistema
  crmEntityId     String?  // ID en el CRM
  
  // Resultado
  errorMessage    String?
  syncedData      Json?    // Datos que se sincronizaron
  
  createdAt       DateTime @default(now())
  
  @@index([businessId, crmConnectionId])
  @@index([businessId, syncType])
  @@map("crm_sync_logs")
}
```

**Ventaja:** Auditoría completa de sincronizaciones.

### **3. Tabla: CRMLabelMapping (Mapeo de Etiquetas)**

```prisma
model CRMLabelMapping {
  id              String   @id @default(uuid())
  businessId      String
  business        Business @relation(...)
  
  crmConnectionId String
  crmConnection   CRMConnection @relation(...)
  
  // Mapeo de etiquetas
  systemLabel     String   // Etiqueta en tu sistema (ej: 'PAGO_PENDIENTE')
  crmLabel        String   // Etiqueta en el CRM (ej: 'Payment Pending')
  crmLabelId      String?  // ID de la etiqueta en el CRM
  
  // Auto-sincronización
  autoSync        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([businessId, crmConnectionId, systemLabel])
  @@map("crm_label_mappings")
}
```

**Ventaja:** Mapeo flexible de etiquetas entre sistemas.

---

## 🔌 INTERFAZ UNIFICADA DE CRM

### **Interfaz Base (TypeScript):**

```typescript
// apps/backend/src/modules/crm/interfaces/crm-adapter.interface.ts

export interface CRMAdapter {
  // Conexión
  connect(config: CRMConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  
  // Contactos
  createContact(contact: ContactData): Promise<string>; // Retorna ID del CRM
  updateContact(contactId: string, data: ContactData): Promise<void>;
  getContact(contactId: string): Promise<ContactData>;
  searchContacts(query: string): Promise<ContactData[]>;
  
  // Mensajes/Conversaciones
  createConversation(conversation: ConversationData): Promise<string>;
  sendMessage(conversationId: string, message: MessageData): Promise<string>;
  getConversations(filters?: ConversationFilters): Promise<ConversationData[]>;
  
  // Etiquetas
  addLabel(contactId: string, label: string): Promise<void>;
  removeLabel(contactId: string, label: string): Promise<void>;
  getLabels(contactId: string): Promise<string[]>;
  createLabel(label: string): Promise<string>;
  
  // Deals/Oportunidades (si el CRM lo soporta)
  createDeal(deal: DealData): Promise<string>;
  updateDeal(dealId: string, data: DealData): Promise<void>;
  
  // Tareas/Notas
  createTask(task: TaskData): Promise<string>;
  createNote(contactId: string, note: string): Promise<string>;
  
  // Sincronización
  syncContacts(filters?: SyncFilters): Promise<SyncResult>;
  syncConversations(filters?: SyncFilters): Promise<SyncResult>;
}
```

**Ventaja:** Misma interfaz para todos los CRM, fácil intercambiar.

---

## 🏭 FACTORY PATTERN - CREAR ADAPTERS

### **CRM Factory:**

```typescript
// apps/backend/src/modules/crm/crm-factory.service.ts

@Injectable()
export class CRMFactoryService {
  constructor(
    private metaCrmAdapter: MetaCrmAdapter,
    private hubspotAdapter: HubspotAdapter,
    private salesforceAdapter: SalesforceAdapter,
    private zohoAdapter: ZohoAdapter,
    // ... otros adapters
  ) {}

  /**
   * Crea el adapter apropiado según el proveedor
   */
  createAdapter(provider: CRMProvider): CRMAdapter {
    switch (provider) {
      case CRMProvider.META_CRM:
        return this.metaCrmAdapter;
      case CRMProvider.HUBSPOT:
        return this.hubspotAdapter;
      case CRMProvider.SALESFORCE:
        return this.salesforceAdapter;
      case CRMProvider.ZOHO:
        return this.zohoAdapter;
      // ... otros casos
      default:
        throw new Error(`CRM provider ${provider} not supported`);
    }
  }

  /**
   * Obtiene adapter para un negocio específico
   */
  async getAdapterForBusiness(businessId: string): Promise<CRMAdapter | null> {
    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
    });

    if (!connection || !connection.isActive || connection.provider === CRMProvider.NONE) {
      return null;
    }

    const adapter = this.createAdapter(connection.provider);
    
    // Configurar adapter con credenciales del negocio
    await adapter.connect({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl,
      config: connection.config,
    });

    return adapter;
  }
}
```

**Ventaja:** Un solo punto para crear y configurar adapters.

---

## 🔧 IMPLEMENTACIÓN POR CRM

### **1. Meta CRM Adapter:**

```typescript
// apps/backend/src/modules/crm/adapters/meta-crm.adapter.ts

@Injectable()
export class MetaCrmAdapter implements CRMAdapter {
  private accessToken: string;
  private pageId: string;

  async connect(config: CRMConfig): Promise<boolean> {
    this.accessToken = config.accessToken;
    this.pageId = config.config?.pageId;
    
    // Verificar conexión
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${this.pageId}`,
      { params: { access_token: this.accessToken } }
    );
    
    return response.status === 200;
  }

  async createContact(contact: ContactData): Promise<string> {
    // Meta CRM no tiene API directa para crear contactos
    // Se crean automáticamente cuando hay conversación
    // Retornar ID de conversación o usuario
    return contact.platformId || contact.phone;
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    await axios.post(
      `https://graph.facebook.com/v18.0/${contactId}/labels`,
      {
        access_token: this.accessToken,
        name: label,
      }
    );
  }

  async getConversations(filters?: ConversationFilters): Promise<ConversationData[]> {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${this.pageId}/conversations`,
      {
        params: {
          access_token: this.accessToken,
          fields: 'id,participants,messages{id,message,from,created_time}',
        },
      }
    );
    
    return this.mapToConversationData(response.data);
  }

  // ... otros métodos
}
```

### **2. HubSpot Adapter:**

```typescript
// apps/backend/src/modules/crm/adapters/hubspot.adapter.ts

@Injectable()
export class HubspotAdapter implements CRMAdapter {
  private apiKey: string;
  private baseUrl = 'https://api.hubapi.com';

  async connect(config: CRMConfig): Promise<boolean> {
    this.apiKey = config.apiKey;
    
    // Verificar conexión
    const response = await axios.get(
      `${this.baseUrl}/contacts/v1/lists/all/contacts/all`,
      {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        params: { count: 1 },
      }
    );
    
    return response.status === 200;
  }

  async createContact(contact: ContactData): Promise<string> {
    const response = await axios.post(
      `${this.baseUrl}/crm/v3/objects/contacts`,
      {
        properties: {
          email: contact.email,
          phone: contact.phone,
          firstname: contact.firstName,
          lastname: contact.lastName,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.id;
  }

  async addLabel(contactId: string, label: string): Promise<void> {
    // En HubSpot se usan "properties" o "tags"
    await axios.patch(
      `${this.baseUrl}/crm/v3/objects/contacts/${contactId}`,
      {
        properties: {
          hs_lead_status: label, // O usar tags
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // ... otros métodos
}
```

### **3. Salesforce Adapter:**

```typescript
// apps/backend/src/modules/crm/adapters/salesforce.adapter.ts

@Injectable()
export class SalesforceAdapter implements CRMAdapter {
  private accessToken: string;
  private instanceUrl: string;

  async connect(config: CRMConfig): Promise<boolean> {
    // Salesforce usa OAuth2
    const tokenResponse = await axios.post(
      'https://login.salesforce.com/services/oauth2/token',
      {
        grant_type: 'password',
        client_id: config.apiKey,
        client_secret: config.apiSecret,
        username: config.config?.username,
        password: config.config?.password,
      }
    );
    
    this.accessToken = tokenResponse.data.access_token;
    this.instanceUrl = tokenResponse.data.instance_url;
    
    return true;
  }

  async createContact(contact: ContactData): Promise<string> {
    const response = await axios.post(
      `${this.instanceUrl}/services/data/v58.0/sobjects/Contact`,
      {
        FirstName: contact.firstName,
        LastName: contact.lastName,
        Email: contact.email,
        Phone: contact.phone,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.id;
  }

  // ... otros métodos
}
```

---

## 🔄 SERVICIO DE SINCRONIZACIÓN UNIFICADO

### **CRM Sync Service:**

```typescript
// apps/backend/src/modules/crm/crm-sync.service.ts

@Injectable()
export class CRMSyncService {
  constructor(
    private crmFactory: CRMFactoryService,
    private prisma: PrismaService,
  ) {}

  /**
   * Sincronizar contactos desde CRM a tu sistema
   */
  async syncContactsFromCRM(businessId: string) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
    });

    if (connection.syncDirection !== 'FROM_CRM' && 
        connection.syncDirection !== 'BIDIRECTIONAL') {
      return;
    }

    // Obtener contactos del CRM
    const crmContacts = await adapter.getContacts();

    for (const crmContact of crmContacts) {
      // Buscar o crear contacto en tu sistema
      await this.syncContactToSystem(businessId, crmContact);
    }
  }

  /**
   * Sincronizar contactos desde tu sistema al CRM
   */
  async syncContactsToCRM(businessId: string) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
    });

    if (connection.syncDirection !== 'TO_CRM' && 
        connection.syncDirection !== 'BIDIRECTIONAL') {
      return;
    }

    // Obtener contactos de tu sistema
    const contacts = await this.prisma.contact.findMany({
      where: { businessId },
    });

    for (const contact of contacts) {
      // Buscar o crear contacto en CRM
      await this.syncContactToCRM(businessId, contact, adapter);
    }
  }

  /**
   * Sincronizar etiquetas automáticamente
   */
  async syncLabels(businessId: string, contactId: string, labels: string[]) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
      include: { labelMappings: true },
    });

    // Obtener mapeo de etiquetas
    for (const label of labels) {
      const mapping = connection.labelMappings.find(
        m => m.systemLabel === label && m.autoSync
      );

      if (mapping) {
        // Obtener CRM contact ID
        const crmContactId = await this.getCRMContactId(businessId, contactId);
        
        if (crmContactId) {
          await adapter.addLabel(crmContactId, mapping.crmLabel);
        }
      }
    }
  }

  /**
   * Sincronizar cuando ocurre un evento
   */
  async onEvent(businessId: string, event: string, data: any) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    switch (event) {
      case 'PAYMENT_PENDING':
        await this.syncLabels(businessId, data.customerId, ['PAGO_PENDIENTE']);
        break;
      case 'PAYMENT_VERIFIED':
        await this.syncLabels(businessId, data.customerId, ['PAGO_VERIFICADO']);
        // Crear deal/oportunidad en CRM si está disponible
        if (adapter.createDeal) {
          await adapter.createDeal({
            name: `Pago verificado - ${data.customerName}`,
            amount: data.amount,
            contactId: data.customerId,
            stage: 'Won',
          });
        }
        break;
      case 'EVIDENCE_SENT':
        await this.syncLabels(businessId, data.customerId, ['EVIDENCIA_ENVIADA']);
        break;
      case 'APPOINTMENT_CREATED':
        await this.syncLabels(businessId, data.customerId, ['CITA_AGENDADA']);
        // Crear tarea en CRM
        if (adapter.createTask) {
          await adapter.createTask({
            title: `Cita agendada - ${data.customerName}`,
            dueDate: data.appointmentDate,
            contactId: data.customerId,
          });
        }
        break;
    }
  }
}
```

---

## 🎯 FLUJO COMPLETO MULTI-CRM

### **Ejemplo: Negocio A usa HubSpot, Negocio B usa Meta CRM**

```
Negocio A (HubSpot):
  1. Cliente envía mensaje → Tu sistema
  2. Se crea pago pendiente → Tu sistema
  3. CRMSyncService detecta evento 'PAYMENT_PENDING'
  4. Obtiene HubSpot adapter para Negocio A
  5. Agrega etiqueta 'Payment Pending' en HubSpot
  6. Crea nota en HubSpot: "Pago pendiente de S/ 150"

Negocio B (Meta CRM):
  1. Cliente envía mensaje → Tu sistema
  2. Se crea pago pendiente → Tu sistema
  3. CRMSyncService detecta evento 'PAYMENT_PENDING'
  4. Obtiene Meta CRM adapter para Negocio B
  5. Agrega etiqueta 'PAGO_PENDIENTE' en Meta CRM
  6. Sincroniza conversación con Meta CRM
```

**Ventaja:** Mismo evento, diferentes CRM, misma lógica.

---

## 📱 FRONTEND - CONFIGURACIÓN DE CRM

### **Nueva Sección: "Integraciones CRM"**

```
┌─────────────────────────────────────────┐
│ 🔗 Integraciones CRM                    │
│ ─────────────────────────────────────── │
│                                         │
│ CRM Actual:                             │
│ ⚪ Ninguno                               │
│ ✅ Meta CRM                              │
│ ⚪ HubSpot                                │
│ ⚪ Salesforce                             │
│ ⚪ Zoho CRM                               │
│ ⚪ Pipedrive                              │
│ ⚪ Monday.com                             │
│ ⚪ CRM Personalizado                      │
│                                         │
│ [Conectar CRM]                          │
└─────────────────────────────────────────┘
```

### **Modal de Configuración (Genérico):**

```
┌─────────────────────────────────────────┐
│ Conectar con [NOMBRE_CRM]              │
│ ───────────────────────────────────── │
│                                         │
│ 1. Obtén tus credenciales:              │
│    [Ver instrucciones]                  │
│                                         │
│ 2. Ingresa tus credenciales:            │
│    API Key: [••••••••]                  │
│    API Secret: [••••••••] (si aplica)   │
│    Base URL: [https://...] (si custom)  │
│                                         │
│ 3. Configuración de sincronización:    │
│    Dirección: [Bidireccional ▼]        │
│    Intervalo: [5] minutos               │
│    [✓] Sincronizar contactos            │
│    [✓] Sincronizar conversaciones       │
│    [✓] Sincronizar etiquetas            │
│                                         │
│ [Probar Conexión] [Conectar] [Cancelar]│
└─────────────────────────────────────────┘
```

### **Configuración de Mapeo de Etiquetas:**

```
┌─────────────────────────────────────────┐
│ 🏷️ Mapeo de Etiquetas                  │
│ ─────────────────────────────────────── │
│                                         │
│ Etiqueta en tu sistema → Etiqueta en CRM│
│                                         │
│ PAGO_PENDIENTE → Payment Pending        │
│ [Editar]                                │
│                                         │
│ PAGO_VERIFICADO → Payment Verified      │
│ [Editar]                                │
│                                         │
│ EVIDENCIA_ENVIADA → Evidence Sent      │
│ [Editar]                                │
│                                         │
│ CITA_AGENDADA → Appointment Scheduled  │
│ [Editar]                                │
│                                         │
│ [Agregar Mapeo]                         │
└─────────────────────────────────────────┘
```

---

## 🔄 SINCRONIZACIÓN AUTOMÁTICA

### **Cron Jobs por Negocio:**

```typescript
// apps/backend/src/modules/crm/crm-sync.job.ts

@Injectable()
export class CRMSyncJob {
  constructor(
    private crmSyncService: CRMSyncService,
    private prisma: PrismaService,
  ) {}

  /**
   * Sincronizar todos los negocios con CRM activo
   */
  @Cron('*/5 * * * *') // Cada 5 minutos
  async syncAllBusinesses() {
    const connections = await this.prisma.cRMConnection.findMany({
      where: {
        isActive: true,
        isConnected: true,
        syncEnabled: true,
      },
    });

    for (const connection of connections) {
      try {
        // Sincronizar según dirección configurada
        if (connection.syncDirection === 'FROM_CRM' || 
            connection.syncDirection === 'BIDIRECTIONAL') {
          await this.crmSyncService.syncContactsFromCRM(connection.businessId);
          await this.crmSyncService.syncConversationsFromCRM(connection.businessId);
        }

        if (connection.syncDirection === 'TO_CRM' || 
            connection.syncDirection === 'BIDIRECTIONAL') {
          await this.crmSyncService.syncContactsToCRM(connection.businessId);
        }

        // Actualizar última sincronización
        await this.prisma.cRMConnection.update({
          where: { id: connection.id },
          data: { lastSyncAt: new Date() },
        });
      } catch (error) {
        // Log error pero continuar con otros negocios
        this.logger.error(`Error syncing CRM for business ${connection.businessId}:`, error);
      }
    }
  }
}
```

---

## 🎨 VENTAJAS DE ESTA ARQUITECTURA

### **1. Modularidad:**
- ✅ Cada CRM es un módulo independiente
- ✅ Fácil agregar nuevos CRM
- ✅ Fácil quitar CRM que no se usa
- ✅ No afecta otros CRM

### **2. Flexibilidad:**
- ✅ Cada negocio elige su CRM
- ✅ Puede cambiar de CRM sin perder datos
- ✅ Puede usar múltiples CRM (futuro)
- ✅ Puede no usar ningún CRM

### **3. Escalabilidad:**
- ✅ Fácil agregar nuevos adapters
- ✅ Misma interfaz para todos
- ✅ Código reutilizable
- ✅ Testing independiente

### **4. Mantenibilidad:**
- ✅ Cambios en un CRM no afectan otros
- ✅ Bugs aislados por CRM
- ✅ Actualizaciones independientes
- ✅ Documentación por CRM

---

## 📋 CRM SOPORTADOS (Ejemplos)

### **1. Meta CRM (Facebook Business Suite)**
- ✅ Conversaciones unificadas
- ✅ Etiquetas
- ✅ Mensajes de Messenger/Instagram
- ✅ Integración nativa con Meta

### **2. HubSpot**
- ✅ Contactos
- ✅ Deals/Oportunidades
- ✅ Tareas
- ✅ Notas
- ✅ Etiquetas/Tags

### **3. Salesforce**
- ✅ Contactos
- ✅ Leads
- ✅ Opportunities
- ✅ Tasks
- ✅ Cases

### **4. Zoho CRM**
- ✅ Contacts
- ✅ Deals
- ✅ Tasks
- ✅ Notes
- ✅ Custom Fields

### **5. Pipedrive**
- ✅ Persons
- ✅ Deals
- ✅ Activities
- ✅ Notes

### **6. Monday.com**
- ✅ Boards
- ✅ Items
- ✅ Updates
- ✅ Columns

### **7. CRM Personalizado**
- ✅ API REST personalizada
- ✅ Configuración flexible
- ✅ Mapeo de campos personalizado

---

## 🔧 IMPLEMENTACIÓN PASO A PASO

### **Paso 1: Crear Interfaz Base**
1. ✅ Definir `CRMAdapter` interface
2. ✅ Definir tipos de datos comunes
3. ✅ Definir tipos de configuración

### **Paso 2: Crear Factory**
1. ✅ Implementar `CRMFactoryService`
2. ✅ Registrar todos los adapters
3. ✅ Método para obtener adapter por negocio

### **Paso 3: Implementar Adapters**
1. ✅ Meta CRM Adapter
2. ✅ HubSpot Adapter
3. ✅ Salesforce Adapter
4. ✅ ... otros según necesidad

### **Paso 4: Servicio de Sincronización**
1. ✅ `CRMSyncService` unificado
2. ✅ Sincronización bidireccional
3. ✅ Manejo de eventos
4. ✅ Logs de sincronización

### **Paso 5: Cron Jobs**
1. ✅ Sincronización automática
2. ✅ Por negocio y por intervalo
3. ✅ Manejo de errores

### **Paso 6: Frontend**
1. ✅ Selección de CRM
2. ✅ Configuración de credenciales
3. ✅ Mapeo de etiquetas
4. ✅ Estado de sincronización

---

## 🎯 CASOS DE USO

### **Caso 1: Negocio pequeño - Solo Meta CRM**
```
Configuración:
  - CRM: Meta CRM
  - Sincronización: Solo etiquetas
  - Dirección: TO_CRM (solo enviar al CRM)

Flujo:
  Cliente escribe → Tu sistema → 
  Evento (pago, cita, etc.) → 
  Agregar etiqueta en Meta CRM
```

### **Caso 2: Negocio mediano - HubSpot**
```
Configuración:
  - CRM: HubSpot
  - Sincronización: Completa
  - Dirección: BIDIRECTIONAL

Flujo:
  Cliente escribe → Tu sistema → 
  Crear/actualizar contacto en HubSpot →
  Agregar etiquetas →
  Crear deal cuando hay pago →
  Sincronizar conversaciones
```

### **Caso 3: Negocio grande - Salesforce**
```
Configuración:
  - CRM: Salesforce
  - Sincronización: Completa + Custom Fields
  - Dirección: BIDIRECTIONAL

Flujo:
  Cliente escribe → Tu sistema →
  Crear Lead/Contact en Salesforce →
  Crear Opportunity cuando hay pago →
  Crear Case cuando hay evidencia →
  Sincronizar todo bidireccionalmente
```

### **Caso 4: Sin CRM**
```
Configuración:
  - CRM: NONE
  - Sincronización: Deshabilitada

Flujo:
  Cliente escribe → Tu sistema →
  Todo funciona normalmente →
  Sin sincronización externa
```

---

## 🔐 SEGURIDAD Y CREDENCIALES

### **1. Encriptación de Credenciales:**

```typescript
// Encriptar tokens antes de guardar
async saveCRMCredentials(businessId: string, credentials: CRMCredentials) {
  const encrypted = await this.encryptService.encrypt(
    JSON.stringify(credentials)
  );
  
  await this.prisma.cRMConnection.update({
    where: { businessId },
    data: {
      accessToken: encrypted.accessToken,
      refreshToken: encrypted.refreshToken,
      apiKey: encrypted.apiKey,
    },
  });
}

// Desencriptar al usar
async getCRMCredentials(businessId: string): Promise<CRMCredentials> {
  const connection = await this.prisma.cRMConnection.findUnique({
    where: { businessId },
  });
  
  return {
    accessToken: await this.encryptService.decrypt(connection.accessToken),
    refreshToken: await this.encryptService.decrypt(connection.refreshToken),
    apiKey: await this.encryptService.decrypt(connection.apiKey),
  };
}
```

### **2. Refresh Tokens:**

```typescript
// Renovar tokens automáticamente
async refreshTokenIfNeeded(businessId: string) {
  const connection = await this.prisma.cRMConnection.findUnique({
    where: { businessId },
  });
  
  // Verificar si el token expiró
  if (this.isTokenExpired(connection.accessToken)) {
    const adapter = this.crmFactory.createAdapter(connection.provider);
    const newToken = await adapter.refreshToken(connection.refreshToken);
    
    await this.saveCRMCredentials(businessId, {
      accessToken: newToken.accessToken,
      refreshToken: newToken.refreshToken,
    });
  }
}
```

---

## 📊 DASHBOARD DE SINCRONIZACIÓN

### **Vista en Frontend:**

```
┌─────────────────────────────────────────┐
│ 🔄 Estado de Sincronización             │
│ ─────────────────────────────────────── │
│                                         │
│ CRM: HubSpot                            │
│ Estado: ✅ Conectado                    │
│ Última sync: Hace 2 minutos             │
│                                         │
│ Estadísticas:                           │
│ • Contactos sincronizados: 245          │
│ • Conversaciones sincronizadas: 1,234   │
│ • Etiquetas mapeadas: 12                │
│                                         │
│ Sincronización:                        │
│ [🔄 Sincronizar Ahora]                   │
│ [⏸️ Pausar] [▶️ Reanudar]                │
│                                         │
│ Logs recientes:                         │
│ ✅ Contacto sincronizado - Hace 1 min   │
│ ✅ Etiqueta agregada - Hace 2 min       │
│ ⚠️ Error en sync - Hace 5 min           │
│                                         │
│ [Ver todos los logs]                    │
└─────────────────────────────────────────┘
```

---

## 🚀 CONCLUSIÓN

**Esta arquitectura permite:**
- ✅ Conectar con múltiples CRM
- ✅ Cada negocio elige su CRM
- ✅ Fácil agregar nuevos CRM
- ✅ Sincronización automática
- ✅ Mapeo flexible de etiquetas
- ✅ Sin romper lo existente
- ✅ Compatible con SaaS
- ✅ Seguro (credenciales encriptadas)

**Cada negocio puede:**
- Elegir el CRM que prefiera
- Configurar sincronización según sus necesidades
- Cambiar de CRM sin perder datos
- Usar múltiples CRM (futuro)
- O no usar ningún CRM










