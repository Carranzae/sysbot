# 🚀 IMPLEMENTACIÓN INTEGRADA COMPLETA
## Meta Graph API + Multi-CRM + Configuración Frontend

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Estructura de Base de Datos](#estructura-de-base-de-datos)
3. [Backend - Módulos Nuevos](#backend---módulos-nuevos)
4. [Frontend - Configuración](#frontend---configuración)
5. [Flujos Integrados](#flujos-integrados)
6. [Plan de Implementación](#plan-de-implementación)

---

## 🎯 RESUMEN EJECUTIVO

### **Objetivo:**
Agregar al proyecto existente:
1. ✅ **Meta Graph API** - Facebook Messenger e Instagram
2. ✅ **Multi-CRM** - Integración con múltiples CRM (Meta, HubSpot, Salesforce, etc.)
3. ✅ **Configuración Frontend** - Campos para pagos, evidencias y boletas

### **Principio Fundamental:**
**NO ROMPER NADA EXISTENTE** - Todo se agrega como módulos nuevos o extensiones opcionales.

---

## 📊 ESTRUCTURA DE BASE DE DATOS

### **1. Tabla: MetaPlatformConnection (Nueva)**

```prisma
model MetaPlatformConnection {
  id                    String   @id @default(uuid())
  businessId            String   @unique
  business              Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  // Configuración de plataformas
  messengerEnabled      Boolean  @default(false)
  messengerPageId       String?
  messengerAccessToken  String?
  messengerVerifyToken  String?
  
  instagramEnabled      Boolean  @default(false)
  instagramAccountId    String?
  instagramAccessToken  String?
  
  // Estado
  messengerConnected    Boolean  @default(false)
  instagramConnected    Boolean  @default(false)
  
  // Webhook
  webhookUrl            String?
  webhookVerified       Boolean  @default(false)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@map("meta_platform_connections")
}
```

### **2. Tabla: CRMConnection (Nueva)**

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
  business          Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  // Proveedor de CRM
  provider          CRMProvider @default(NONE)
  
  // Estado
  isActive          Boolean     @default(false)
  isConnected       Boolean     @default(false)
  
  // Credenciales (encriptadas)
  accessToken       String?
  refreshToken      String?
  apiKey            String?
  apiSecret         String?
  baseUrl           String?
  
  // Configuración específica
  config            Json?
  
  // Sincronización
  syncEnabled       Boolean     @default(true)
  syncDirection     String      @default('BIDIRECTIONAL') // 'TO_CRM', 'FROM_CRM', 'BIDIRECTIONAL'
  lastSyncAt        DateTime?
  syncInterval      Int         @default(5) // minutos
  
  // Metadata
  accountId         String?
  accountName       String?
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  labelMappings     CRMLabelMapping[]
  syncLogs          CRMSyncLog[]
  
  @@map("crm_connections")
}
```

### **3. Tabla: CRMLabelMapping (Nueva)**

```prisma
model CRMLabelMapping {
  id              String   @id @default(uuid())
  businessId      String
  business        Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  crmConnectionId String
  crmConnection   CRMConnection @relation(fields: [crmConnectionId], references: [id], onDelete: Cascade)
  
  // Mapeo de etiquetas
  systemLabel     String   // Etiqueta en tu sistema (ej: 'PAGO_PENDIENTE')
  crmLabel        String   // Etiqueta en el CRM (ej: 'Payment Pending')
  crmLabelId      String?
  
  // Auto-sincronización
  autoSync        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([businessId, crmConnectionId, systemLabel])
  @@map("crm_label_mappings")
}
```

### **4. Tabla: CRMSyncLog (Nueva)**

```prisma
model CRMSyncLog {
  id              String   @id @default(uuid())
  businessId      String
  business        Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  crmConnectionId String
  crmConnection   CRMConnection @relation(fields: [crmConnectionId], references: [id], onDelete: Cascade)
  
  // Tipo de sincronización
  syncType        String   // 'CONTACT', 'MESSAGE', 'DEAL', 'TASK', 'LABEL'
  direction       String   // 'TO_CRM', 'FROM_CRM'
  status          String   // 'SUCCESS', 'FAILED', 'PENDING'
  
  // Datos sincronizados
  entityType      String
  entityId        String
  crmEntityId     String?
  
  // Resultado
  errorMessage    String?
  syncedData      Json?
  
  createdAt       DateTime @default(now())
  
  @@index([businessId, crmConnectionId])
  @@index([businessId, syncType])
  @@map("crm_sync_logs")
}
```

### **5. Tabla: CustomerPlatform (Nueva)**

```prisma
model CustomerPlatform {
  id            String   @id @default(uuid())
  businessId   String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  
  // Identificadores en diferentes plataformas
  phone         String?
  messengerId   String?
  instagramId   String?
  whatsappId    String?
  
  // Información unificada
  unifiedName   String?
  unifiedEmail  String?
  unifiedPhone  String?
  
  // Relación con Contact existente (opcional)
  contactId     String?
  contact       Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)
  
  // Metadata
  preferredPlatform String?
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

### **6. Extender Tabla: Message (Sin romper)**

```prisma
model Message {
  // ... campos existentes (NO TOCAR)
  
  // Nuevos campos (opcionales)
  platform              String?  // 'WHATSAPP_API', 'WHATSAPP_WEB', 'MESSENGER', 'INSTAGRAM'
  platformMessageId     String?  // ID del mensaje en la plataforma original
  platformSenderId      String?  // ID del remitente en la plataforma
  
  @@index([businessId, platform]) // Nuevo índice
}
```

### **7. Extender Tabla: BotConfig (Ya existe, verificar campos)**

```prisma
model BotConfig {
  // ... campos existentes
  
  // Evidencias Médicas
  reviewerDestination  String?
  
  // Verificación de Pagos
  paymentEmail         String?
  paymentEmailPassword String?
  paymentEmailProvider String? // 'GMAIL' | 'OUTLOOK' | 'OTHER'
  
  // Configuración de Boletas
  businessLogoFileId   String?
  businessRUC          String?
  businessAddress      String?
  invoicePrefix        String?
  lastInvoiceNumber    Int?     @default(0)
  
  // ... otros campos existentes
}
```

---

## 🏗️ BACKEND - MÓDULOS NUEVOS

### **Estructura de Directorios:**

```
apps/backend/src/modules/
  ├── meta/                          # NUEVO - Meta Graph API
  │   ├── meta.module.ts
  │   ├── meta.service.ts
  │   ├── meta.controller.ts         # Webhook: POST /api/v1/meta/webhook
  │   ├── meta-router.service.ts
  │   ├── messenger/
  │   │   ├── messenger.service.ts
  │   │   └── messenger.handler.ts
  │   ├── instagram/
  │   │   ├── instagram.service.ts
  │   │   └── instagram.handler.ts
  │   └── dto/
  │       └── meta-webhook.dto.ts
  │
  ├── crm/                           # NUEVO - Multi-CRM
  │   ├── crm.module.ts
  │   ├── crm-factory.service.ts
  │   ├── crm-sync.service.ts
  │   ├── crm-sync.job.ts            # Cron jobs
  │   ├── interfaces/
  │   │   └── crm-adapter.interface.ts
  │   ├── adapters/
  │   │   ├── meta-crm.adapter.ts
  │   │   ├── hubspot.adapter.ts
  │   │   ├── salesforce.adapter.ts
  │   │   └── zoho.adapter.ts
  │   └── dto/
  │       └── crm-config.dto.ts
  │
  ├── whatsapp/                       # EXISTENTE - NO TOCAR
  │   ├── whatsapp.service.ts
  │   └── whatsapp-web.service.ts
  │
  ├── ai/                             # EXISTENTE - EXTENDER mínimamente
  │   └── ai.service.ts               # Agregar parámetro opcional context
  │
  ├── payment/                        # EXISTENTE - NO TOCAR
  ├── evidence/                       # EXISTENTE - NO TOCAR
  └── invoice/                        # EXISTENTE - NO TOCAR
```

---

## 🔧 IMPLEMENTACIÓN BACKEND

### **1. Meta Module (Nuevo)**

```typescript
// apps/backend/src/modules/meta/meta.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { MetaService } from './meta.service';
import { MetaController } from './meta.controller';
import { MetaRouterService } from './meta-router.service';
import { MessengerService } from './messenger/messenger.service';
import { InstagramService } from './instagram/instagram.service';
import { AiModule } from '../ai/ai.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AiModule),
    forwardRef(() => WhatsappModule),
  ],
  providers: [
    MetaService,
    MetaRouterService,
    MessengerService,
    InstagramService,
  ],
  controllers: [MetaController],
  exports: [MetaService, MetaRouterService],
})
export class MetaModule {}
```

### **2. Meta Router Service**

```typescript
// apps/backend/src/modules/meta/meta-router.service.ts

import { Injectable } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WhatsappWebService } from '../whatsapp/whatsapp-web.service';
import { MessengerService } from './messenger/messenger.service';
import { InstagramService } from './instagram/instagram.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class MetaRouterService {
  constructor(
    private whatsappService: WhatsappService,
    private whatsappWebService: WhatsappWebService,
    private messengerService: MessengerService,
    private instagramService: InstagramService,
    private aiService: AiService,
  ) {}

  async routeIncomingMessage(
    businessId: string,
    platform: 'WHATSAPP_API' | 'WHATSAPP_WEB' | 'MESSENGER' | 'INSTAGRAM',
    messageData: any,
  ) {
    switch (platform) {
      case 'WHATSAPP_API':
        return await this.whatsappService.handleIncomingMessage(messageData);
        
      case 'WHATSAPP_WEB':
        return await this.whatsappWebService.handleMessage(businessId, messageData);
        
      case 'MESSENGER':
        return await this.messengerService.handleIncomingMessage(businessId, messageData);
        
      case 'INSTAGRAM':
        return await this.instagramService.handleIncomingMessage(businessId, messageData);
    }
  }
}
```

### **3. Meta Controller (Webhook)**

```typescript
// apps/backend/src/modules/meta/meta.controller.ts

import { Controller, Post, Req, Res, Query } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetaService } from './meta.service';
import { MetaRouterService } from './meta-router.service';

@Controller('meta')
export class MetaController {
  constructor(
    private metaService: MetaService,
    private metaRouterService: MetaRouterService,
  ) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    // Verificación de webhook
    if (mode === 'subscribe' && token) {
      if (token === process.env.META_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }

    // Procesar eventos
    const body = req.body;
    
    if (body.object === 'page' || body.object === 'instagram') {
      for (const entry of body.entry || []) {
        const platform = entry.id ? 'INSTAGRAM' : 'MESSENGER';
        const businessId = await this.metaService.getBusinessIdFromPageId(entry.id);
        
        for (const event of entry.messaging || []) {
          await this.metaRouterService.routeIncomingMessage(
            businessId,
            platform,
            event,
          );
        }
      }
    }

    return res.status(200).send('OK');
  }
}
```

### **4. CRM Module (Nuevo)**

```typescript
// apps/backend/src/modules/crm/crm.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CRMFactoryService } from './crm-factory.service';
import { CRMSyncService } from './crm-sync.service';
import { CRMSyncJob } from './crm-sync.job';
import { MetaCrmAdapter } from './adapters/meta-crm.adapter';
import { HubspotAdapter } from './adapters/hubspot.adapter';
import { SalesforceAdapter } from './adapters/salesforce.adapter';
import { ZohoAdapter } from './adapters/zoho.adapter';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [
    CRMFactoryService,
    CRMSyncService,
    CRMSyncJob,
    MetaCrmAdapter,
    HubspotAdapter,
    SalesforceAdapter,
    ZohoAdapter,
  ],
  exports: [CRMFactoryService, CRMSyncService],
})
export class CRMModule {}
```

### **5. CRM Factory Service**

```typescript
// apps/backend/src/modules/crm/crm-factory.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CRMProvider } from '@prisma/client';
import { CRMAdapter } from './interfaces/crm-adapter.interface';
import { MetaCrmAdapter } from './adapters/meta-crm.adapter';
import { HubspotAdapter } from './adapters/hubspot.adapter';
import { SalesforceAdapter } from './adapters/salesforce.adapter';
import { ZohoAdapter } from './adapters/zoho.adapter';

@Injectable()
export class CRMFactoryService {
  constructor(
    private prisma: PrismaService,
    private metaCrmAdapter: MetaCrmAdapter,
    private hubspotAdapter: HubspotAdapter,
    private salesforceAdapter: SalesforceAdapter,
    private zohoAdapter: ZohoAdapter,
  ) {}

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
      default:
        throw new Error(`CRM provider ${provider} not supported`);
    }
  }

  async getAdapterForBusiness(businessId: string): Promise<CRMAdapter | null> {
    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
    });

    if (!connection || !connection.isActive || connection.provider === CRMProvider.NONE) {
      return null;
    }

    const adapter = this.createAdapter(connection.provider);
    
    await adapter.connect({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      apiKey: connection.apiKey,
      apiSecret: connection.apiSecret,
      baseUrl: connection.baseUrl,
      config: connection.config as any,
    });

    return adapter;
  }
}
```

### **6. CRM Sync Service**

```typescript
// apps/backend/src/modules/crm/crm-sync.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CRMFactoryService } from './crm-factory.service';

@Injectable()
export class CRMSyncService {
  constructor(
    private prisma: PrismaService,
    private crmFactory: CRMFactoryService,
  ) {}

  async onEvent(businessId: string, event: string, data: any) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    switch (event) {
      case 'PAYMENT_PENDING':
        await this.syncLabels(businessId, data.customerId, ['PAGO_PENDIENTE']);
        break;
      case 'PAYMENT_VERIFIED':
        await this.syncLabels(businessId, data.customerId, ['PAGO_VERIFICADO']);
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

  private async syncLabels(businessId: string, contactId: string, labels: string[]) {
    const adapter = await this.crmFactory.getAdapterForBusiness(businessId);
    if (!adapter) return;

    const connection = await this.prisma.cRMConnection.findUnique({
      where: { businessId },
      include: { labelMappings: true },
    });

    for (const label of labels) {
      const mapping = connection.labelMappings.find(
        m => m.systemLabel === label && m.autoSync,
      );

      if (mapping) {
        const crmContactId = await this.getCRMContactId(businessId, contactId);
        if (crmContactId) {
          await adapter.addLabel(crmContactId, mapping.crmLabel);
        }
      }
    }
  }

  private async getCRMContactId(businessId: string, contactId: string): Promise<string | null> {
    // Implementar lógica para obtener CRM contact ID
    return null;
  }
}
```

### **7. Extender AI Service (Mínimo)**

```typescript
// apps/backend/src/modules/ai/ai.service.ts

// ... código existente (NO TOCAR)

async generateResponse(
  businessId: string,
  customerMessage: string,
  customerPhone?: string,
  context?: {  // NUEVO: Parámetro opcional
    platform?: 'WHATSAPP_API' | 'WHATSAPP_WEB' | 'MESSENGER' | 'INSTAGRAM';
    senderId?: string;
  }
): Promise<AIResponse> {
  // ... código existente (NO TOCAR)
  
  // NUEVO: Agregar contexto de plataforma (opcional)
  if (context?.platform) {
    const platformContext = this.getPlatformContext(context.platform);
    customPrompt += platformContext;
  }
  
  // ... resto del código existente
}

// NUEVO método (no afecta métodos existentes)
private getPlatformContext(platform: string): string {
  switch (platform) {
    case 'MESSENGER':
      return '\n⚠️ CONTEXTO: Cliente escribiendo desde Facebook Messenger.';
    case 'INSTAGRAM':
      return '\n⚠️ CONTEXTO: Cliente escribiendo desde Instagram. Sé más conciso.';
    default:
      return '';
  }
}
```

---

## 🎨 FRONTEND - CONFIGURACIÓN

### **1. Actualizar Settings Page**

```typescript
// apps/frontend/src/app/(dashboard)/settings/page.tsx

// Agregar al initialConfig:
const initialConfig = {
  // ... campos existentes
  
  // Evidencias Médicas
  reviewerDestination: '',
  
  // Verificación de Pagos
  paymentEmail: '',
  paymentEmailPassword: '',
  paymentEmailProvider: 'GMAIL',
  
  // Configuración de Boletas
  businessLogoFileId: '',
  businessRUC: '',
  businessAddress: '',
  invoicePrefix: 'B001-',
  lastInvoiceNumber: 0,
};
```

### **2. Agregar Cards en Settings Page**

```tsx
// Después de la sección de Gmail API

{/* Evidencias Médicas */}
<Card>
  <CardHeader>
    <CardTitle>🏥 Evidencias Médicas</CardTitle>
    <CardDescription>
      Configura el destino de las evidencias médicas enviadas por los clientes.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <Label>Número de WhatsApp del especialista</Label>
      <Input
        value={botConfig.reviewerDestination}
        onChange={(e) => handleChange({ reviewerDestination: e.target.value })}
        placeholder="+51987654321"
      />
      <p className="text-xs text-gray-500">
        Número donde se enviarán las evidencias médicas (imágenes, videos)
      </p>
    </div>
  </CardContent>
</Card>

{/* Verificación de Pagos */}
<Card>
  <CardHeader>
    <CardTitle>💳 Verificación de Pagos</CardTitle>
    <CardDescription>
      Configura el correo donde llegan las notificaciones de pagos (Yape, Plin, etc.)
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Correo donde llegan notificaciones de pago</Label>
      <Input
        type="email"
        value={botConfig.paymentEmail}
        onChange={(e) => handleChange({ paymentEmail: e.target.value })}
        placeholder="pagos@tudominio.com"
      />
    </div>
    <div className="space-y-2">
      <Label>Contraseña del correo de pagos</Label>
      <Input
        type="password"
        value={botConfig.paymentEmailPassword}
        onChange={(e) => handleChange({ paymentEmailPassword: e.target.value })}
        placeholder="••••••••"
      />
    </div>
    <div className="space-y-2">
      <Label>Proveedor de correo</Label>
      <Select
        value={botConfig.paymentEmailProvider}
        onValueChange={(value) => handleChange({ paymentEmailProvider: value })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="GMAIL">Gmail</SelectItem>
          <SelectItem value="OUTLOOK">Outlook / Office 365</SelectItem>
          <SelectItem value="OTHER">Otro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </CardContent>
</Card>

{/* Configuración de Boletas */}
<Card>
  <CardHeader>
    <CardTitle>🧾 Configuración de Boletas</CardTitle>
    <CardDescription>
      Configura los datos que aparecerán en las boletas generadas automáticamente.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label>Logo del negocio (para boletas)</Label>
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => handleLogoUpload(e.target.files?.[0])}
      />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>RUC / Número de identificación</Label>
        <Input
          value={botConfig.businessRUC}
          onChange={(e) => handleChange({ businessRUC: e.target.value })}
          placeholder="20123456789"
        />
      </div>
      <div className="space-y-2">
        <Label>Prefijo de número de boleta</Label>
        <Input
          value={botConfig.invoicePrefix}
          onChange={(e) => handleChange({ invoicePrefix: e.target.value })}
          placeholder="B001-"
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label>Dirección completa</Label>
      <textarea
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
        value={botConfig.businessAddress}
        onChange={(e) => handleChange({ businessAddress: e.target.value })}
        placeholder="Av. Principal 123, Lima, Perú"
      />
    </div>
    <div className="space-y-2">
      <Label>Último número de boleta usado</Label>
      <Input
        type="number"
        value={botConfig.lastInvoiceNumber}
        readOnly
        disabled
      />
      <p className="text-xs text-gray-500">
        Solo lectura - Se actualiza automáticamente
      </p>
    </div>
  </CardContent>
</Card>
```

### **3. Nueva Página: Canales de Mensajería**

```tsx
// apps/frontend/src/app/(dashboard)/channels/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBusinessStore } from '@/store/business';
import { whatsappApi, metaApi } from '@/lib/api';

export default function ChannelsPage() {
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  const [whatsappWebStatus, setWhatsappWebStatus] = useState('');
  const [messengerStatus, setMessengerStatus] = useState('');
  const [instagramStatus, setInstagramStatus] = useState('');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📱 Canales de Mensajería</CardTitle>
          <CardDescription>
            Configura los canales de mensajería disponibles para tu negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* WhatsApp Business API */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">WhatsApp Business API</h3>
              <p className="text-sm text-gray-500">Estado: Conectado</p>
            </div>
            <Button variant="outline">Configurar</Button>
          </div>

          {/* WhatsApp Web */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">WhatsApp Web</h3>
              <p className="text-sm text-gray-500">Estado: {whatsappWebStatus || 'No configurado'}</p>
            </div>
            <Button variant="outline">Configurar</Button>
          </div>

          {/* Facebook Messenger */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Facebook Messenger</h3>
              <p className="text-sm text-gray-500">Estado: {messengerStatus || 'No configurado'}</p>
            </div>
            <Button variant="outline">Conectar con Messenger</Button>
          </div>

          {/* Instagram Direct */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Instagram Direct</h3>
              <p className="text-sm text-gray-500">Estado: {instagramStatus || 'No configurado'}</p>
            </div>
            <Button variant="outline">Conectar con Instagram</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### **4. Nueva Página: Integraciones CRM**

```tsx
// apps/frontend/src/app/(dashboard)/integrations/crm/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBusinessStore } from '@/store/business';
import { crmApi } from '@/lib/api';

const crmProviders = [
  { value: 'NONE', label: 'Ninguno' },
  { value: 'META_CRM', label: 'Meta CRM' },
  { value: 'HUBSPOT', label: 'HubSpot' },
  { value: 'SALESFORCE', label: 'Salesforce' },
  { value: 'ZOHO', label: 'Zoho CRM' },
  { value: 'PIPEDRIVE', label: 'Pipedrive' },
  { value: 'MONDAY', label: 'Monday.com' },
  { value: 'CUSTOM', label: 'CRM Personalizado' },
];

export default function CRMPage() {
  const selectedBusiness = useBusinessStore((state) => state.selectedBusiness);
  const [selectedCRM, setSelectedCRM] = useState('NONE');
  const [isConnected, setIsConnected] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔗 Integraciones CRM</CardTitle>
          <CardDescription>
            Conecta tu sistema con un CRM externo para sincronizar contactos, mensajes y etiquetas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecciona tu CRM</Label>
            <Select value={selectedCRM} onValueChange={setSelectedCRM}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {crmProviders.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCRM !== 'NONE' && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold">Configuración de {selectedCRM}</h3>
              {/* Formulario de configuración según el CRM seleccionado */}
              <Button>Conectar CRM</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🔄 FLUJOS INTEGRADOS

### **Flujo 1: Cliente envía evidencia por Messenger**

```
1. Cliente envía imagen en Messenger
   ↓
2. Webhook Meta recibe evento
   ↓
3. Meta Router detecta: platform = 'MESSENGER'
   ↓
4. Messenger Service procesa
   ↓
5. Detecta que es evidencia médica
   ↓
6. Crea Evidence en BD
   ↓
7. Envía al especialista (reviewerDestination de BotConfig)
   ↓
8. Si tiene CRM conectado:
   → CRMSyncService.onEvent('EVIDENCE_SENT')
   → Agrega etiqueta 'EVIDENCIA_ENVIADA' en CRM
```

### **Flujo 2: Cliente envía comprobante de pago por Instagram**

```
1. Cliente envía imagen de comprobante en Instagram
   ↓
2. Webhook Meta recibe evento
   ↓
3. Meta Router detecta: platform = 'INSTAGRAM'
   ↓
4. Instagram Service procesa
   ↓
5. Detecta que es comprobante de pago
   ↓
6. PaymentService.processReceipt()
   → OCR extrae monto, fecha, código
   → Verifica monto con precio de cita
   ↓
7. Si es Yape/Plin, pide código de seguridad
   ↓
8. Cliente envía código
   ↓
9. EmailPaymentService.verifyPaymentCode()
   → Busca en correo (paymentEmail de BotConfig)
   ↓
10. Si verificado:
    → InvoiceService.generateInvoice()
    → Envía boleta PDF al cliente
    ↓
11. Si tiene CRM conectado:
    → CRMSyncService.onEvent('PAYMENT_VERIFIED')
    → Agrega etiqueta 'PAGO_VERIFICADO' en CRM
    → Crea deal/oportunidad en CRM
```

### **Flujo 3: Sincronización automática con CRM**

```
Cron Job (cada 5 minutos):
  1. Obtener todos los negocios con CRM activo
   ↓
  2. Para cada negocio:
     → Obtener adapter del CRM
     → Sincronizar contactos (si bidireccional)
     → Sincronizar conversaciones (si bidireccional)
     → Actualizar lastSyncAt
```

---

## 📋 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Base de Datos (Sin romper nada)**
1. ✅ Crear migración con nuevas tablas
2. ✅ Agregar campos opcionales a Message
3. ✅ Verificar campos en BotConfig
4. ✅ Ejecutar `npx prisma migrate dev`
5. ✅ Verificar que todo sigue funcionando

### **Fase 2: Backend - Meta Module**
1. ✅ Crear módulo `meta/`
2. ✅ Implementar Messenger Service
3. ✅ Implementar Instagram Service
4. ✅ Crear Meta Router
5. ✅ Crear Webhook Controller
6. ✅ Probar sin afectar WhatsApp

### **Fase 3: Backend - CRM Module**
1. ✅ Crear interfaz CRMAdapter
2. ✅ Crear CRM Factory
3. ✅ Implementar adapters (Meta, HubSpot, etc.)
4. ✅ Crear CRM Sync Service
5. ✅ Crear cron jobs
6. ✅ Probar sincronización

### **Fase 4: Backend - Extensión AI Service**
1. ✅ Agregar parámetro opcional `context`
2. ✅ Agregar método `getPlatformContext`
3. ✅ Verificar que llamadas existentes funcionan

### **Fase 5: Frontend - Configuración**
1. ✅ Agregar campos a Settings page
2. ✅ Crear página "Canales de Mensajería"
3. ✅ Crear página "Integraciones CRM"
4. ✅ Agregar upload de logo
5. ✅ Probar guardado de configuración

### **Fase 6: Integración y Testing**
1. ✅ Probar flujo completo de evidencias
2. ✅ Probar flujo completo de pagos
3. ✅ Probar sincronización con CRM
4. ✅ Verificar que WhatsApp sigue funcionando
5. ✅ Testing end-to-end

---

## 🔐 VARIABLES DE ENTORNO

```env
# Meta Graph API
META_APP_ID=tu_app_id
META_APP_SECRET=tu_app_secret
META_VERIFY_TOKEN=tu_verify_token

# Webhook URL
META_WEBHOOK_URL=https://tu-dominio.com/api/v1/meta/webhook
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Backend:**
- [ ] Crear tablas en Prisma schema
- [ ] Ejecutar migración
- [ ] Crear Meta Module
- [ ] Crear CRM Module
- [ ] Extender AI Service (mínimo)
- [ ] Crear endpoints API
- [ ] Implementar cron jobs
- [ ] Testing de servicios

### **Frontend:**
- [ ] Agregar campos a Settings
- [ ] Crear página Canales
- [ ] Crear página Integraciones CRM
- [ ] Implementar upload de logo
- [ ] Agregar validaciones
- [ ] Testing de UI

### **Integración:**
- [ ] Probar flujos completos
- [ ] Verificar que no se rompe nada existente
- [ ] Documentar cambios
- [ ] Deploy a staging
- [ ] Testing en producción

---

## 🎯 RESUMEN

**Esta implementación agrega:**
- ✅ Meta Graph API (Messenger + Instagram)
- ✅ Multi-CRM (Meta, HubSpot, Salesforce, etc.)
- ✅ Configuración completa en frontend
- ✅ Sincronización automática
- ✅ Sin romper nada existente

**Cada negocio puede:**
- Elegir qué plataformas usar
- Elegir qué CRM usar
- Configurar independientemente
- Ver todo unificado en el frontend










