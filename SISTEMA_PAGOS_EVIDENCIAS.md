# 📋 SISTEMA DE PAGOS Y EVIDENCIAS MÉDICAS

## 🎯 FLUJO COMPLETO DEL SISTEMA

---

## 1️⃣ ENVÍO DE EVIDENCIAS MÉDICAS (Video/Imagen)

### Flujo:
```
Cliente: "Tengo este malestar" + [envía video/imagen]
    ↓
Sistema detecta evidencia médica
    ↓
Pregunta al cliente: "¿Quieres que evalúe estas evidencias el especialista? (Sí/No)"
    ↓
Si cliente responde "Sí":
    ↓
1. Guardar evidencia en BD (tabla: Evidence)
2. Enviar al número de destino configurado (botConfig.reviewerDestination)
3. Mensaje al especialista: "📋 Nueva evidencia médica de [Cliente] - [Descripción del malestar]"
4. Mensaje al cliente: "✅ Tus evidencias están siendo evaluadas por el especialista. Para más información, contacta con la asistencia médica al número: [NUMERO_ASISTENCIA]"
```

### Estructura de BD necesaria:
```sql
Table: Evidence
- id (UUID)
- businessId (UUID)
- customerPhone (String)
- customerName (String)
- evidenceType (ENUM: 'IMAGE', 'VIDEO', 'AUDIO')
- fileId (UUID) - referencia a File
- description (String) - descripción del malestar
- status (ENUM: 'PENDING', 'REVIEWED', 'ARCHIVED')
- reviewerDestination (String) - número donde se envió
- createdAt (DateTime)
- reviewedAt (DateTime)
```

---

## 2️⃣ VERIFICACIÓN DE COMPROBANTES DE PAGO

### Flujo Completo:

#### Paso 1: Cliente envía comprobante
```
Cliente: [envía imagen de comprobante de pago]
    ↓
Sistema detecta que es comprobante de pago
    ↓
1. Guardar comprobante en BD (tabla: PaymentReceipt)
2. Procesar imagen con OCR para extraer:
   - Monto pagado
   - Fecha de pago
   - Número de operación (si existe)
   - Código de seguridad (si es Yape/Plin)
   - Nombre del cliente (si aparece)
```

#### Paso 2: Obtener información de la cita/servicio
```
Sistema busca:
- Cita pendiente del cliente (appointments)
- Precio de la cita/servicio
- Comparar monto del comprobante con precio esperado
```

#### Paso 3: Verificación automática
```
Si monto coincide:
    ↓
Mensaje al cliente: "✅ Perfecto, tu pago se procesó con éxito. Monto verificado: S/ [MONTO]"
    ↓
Si es pago por Yape/Plin:
    ↓
Mensaje: "Por favor, envía el código de seguridad de tu comprobante para verificación final"
    ↓
Esperar código de seguridad del cliente
```

#### Paso 4: Verificación de código de seguridad (Yape/Plin)
```
Cliente envía código de seguridad
    ↓
Sistema:
1. Buscar en correo electrónico configurado (IMAP/POP3)
2. Buscar correos recientes (últimas 24 horas)
3. Buscar coincidencias:
   - Código de seguridad
   - Monto
   - Fecha (aproximada)
4. Si encuentra coincidencia:
    ↓
   - Marcar pago como VERIFICADO
   - Enviar mensaje: "✅ Tu pago fue realizado con éxito. Muchas gracias por elegir [NOMBRE_NEGOCIO]"
   - Generar boleta
   - Enviar boleta al cliente
```

---

## 3️⃣ GENERACIÓN Y ENVÍO DE BOLETA

### Flujo:
```
Pago verificado exitosamente
    ↓
Generar boleta PDF con:
- Logo del negocio (desde Business.logo o File con tag "logo")
- Datos del negocio (nombre, RUC, dirección)
- Datos del cliente (nombre, teléfono)
- Detalle del servicio/cita
- Monto pagado
- Fecha de pago
- Número de boleta (secuencial)
- Código QR de verificación (opcional)
    ↓
Guardar boleta en BD (tabla: Invoice)
    ↓
Enviar boleta PDF al cliente por WhatsApp
```

### Estructura de BD necesaria:
```sql
Table: PaymentReceipt
- id (UUID)
- businessId (UUID)
- customerPhone (String)
- customerName (String)
- appointmentId (UUID, nullable) - si está relacionado con una cita
- amount (Decimal) - monto extraído del comprobante
- expectedAmount (Decimal) - monto esperado
- receiptFileId (UUID) - referencia a File (imagen del comprobante)
- securityCode (String, nullable) - código de seguridad (Yape/Plin)
- paymentMethod (ENUM: 'YAPE', 'PLIN', 'TRANSFER', 'CASH', 'OTHER')
- status (ENUM: 'PENDING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW')
- verifiedAt (DateTime, nullable)
- verifiedBy (UUID, nullable) - admin que verificó manualmente
- emailVerified (Boolean) - si se verificó por correo
- createdAt (DateTime)

Table: Invoice
- id (UUID)
- businessId (UUID)
- customerPhone (String)
- customerName (String)
- appointmentId (UUID, nullable)
- paymentReceiptId (UUID) - referencia a PaymentReceipt
- invoiceNumber (String) - número secuencial
- amount (Decimal)
- invoiceFileId (UUID) - referencia a File (PDF de la boleta)
- createdAt (DateTime)
```

---

## 4️⃣ CONFIGURACIÓN NECESARIA

### En BotConfig:
```typescript
{
  // ... campos existentes
  reviewerDestination: string; // Número donde enviar evidencias
  paymentEmail: string; // Correo donde llegan notificaciones de pago
  paymentEmailPassword: string; // Contraseña del correo
  paymentEmailProvider: 'GMAIL' | 'OUTLOOK' | 'OTHER'; // Proveedor de correo
  businessLogoFileId: string; // ID del archivo con el logo
  businessRUC: string; // RUC del negocio
  businessAddress: string; // Dirección del negocio
  invoicePrefix: string; // Prefijo para números de boleta (ej: "B001-")
  lastInvoiceNumber: number; // Último número de boleta usado
}
```

---

## 5️⃣ PROCESO DE OCR Y EXTRACCIÓN DE DATOS

### Para comprobantes de pago:
```
1. Usar servicio de OCR (Tesseract, Google Vision API, o similar)
2. Extraer texto de la imagen
3. Buscar patrones:
   - Monto: "S/ 150.00", "150.00", "S/. 150"
   - Fecha: "03/01/2026", "03-01-2026"
   - Código: "Código: 123456", "Cód. 123456"
   - Operación: "Operación: 789012", "N° Op: 789012"
4. Validar formato y extraer valores
```

### Librerías sugeridas:
- **Tesseract.js** (OCR gratuito)
- **Google Cloud Vision API** (OCR de pago, más preciso)
- **AWS Textract** (OCR de pago, muy preciso)

---

## 6️⃣ INTEGRACIÓN CON CORREO ELECTRÓNICO

### Para verificar pagos de Yape/Plin:
```
1. Conectar a correo usando IMAP
2. Buscar correos recientes (últimas 24 horas)
3. Buscar en asunto/cuerpo:
   - Código de seguridad
   - Monto
   - Nombre del cliente (opcional)
4. Si encuentra coincidencia, marcar como verificado
```

### Librerías sugeridas:
- **node-imap** (para IMAP)
- **nodemailer** (para SMTP/IMAP)
- **mailparser** (para parsear correos)

---

## 7️⃣ GENERACIÓN DE BOLETA PDF

### Usando librerías:
- **PDFKit** (Node.js, gratuito)
- **Puppeteer** (generar HTML y convertir a PDF)
- **jsPDF** (alternativa)

### Template de boleta:
```
┌─────────────────────────────────────┐
│  [LOGO DEL NEGOCIO]                 │
│                                     │
│  [NOMBRE DEL NEGOCIO]              │
│  RUC: [RUC]                         │
│  [DIRECCIÓN]                        │
│                                     │
│  ─────────────────────────────────  │
│  BOLETA DE VENTA                    │
│  N°: [NÚMERO]                       │
│  Fecha: [FECHA]                     │
│  ─────────────────────────────────  │
│                                     │
│  Cliente: [NOMBRE]                  │
│  Teléfono: [TELÉFONO]               │
│                                     │
│  ─────────────────────────────────  │
│  DETALLE:                           │
│  [SERVICIO/CITA]                    │
│  Monto: S/ [MONTO]                  │
│  ─────────────────────────────────  │
│                                     │
│  Total: S/ [MONTO]                  │
│                                     │
│  [CÓDIGO QR DE VERIFICACIÓN]       │
│                                     │
│  Gracias por su compra              │
└─────────────────────────────────────┘
```

---

## 8️⃣ MENSAJES AL CLIENTE

### Cuando envía evidencia:
```
"📋 He recibido tu evidencia médica. ¿Quieres que la evalúe el especialista? (Sí/No)"
```

### Cuando confirma envío de evidencia:
```
"✅ Tus evidencias están siendo evaluadas por el especialista. Para más información, contacta con la asistencia médica al número: [NUMERO_ASISTENCIA]"
```

### Cuando envía comprobante:
```
"📸 Comprobante recibido. Estoy verificando el monto..."
```

### Si monto coincide:
```
"✅ Perfecto, tu pago se procesó con éxito. Monto verificado: S/ [MONTO]"
```

### Si es Yape/Plin y necesita código:
```
"Por favor, envía el código de seguridad de tu comprobante para verificación final"
```

### Cuando código es verificado:
```
"✅ Tu pago fue realizado con éxito. Muchas gracias por elegir [NOMBRE_NEGOCIO]. Te estoy enviando tu boleta..."
```

### Cuando se envía boleta:
```
"📄 Aquí está tu boleta de pago. Gracias por tu compra."
```

---

## 9️⃣ IMPLEMENTACIÓN TÉCNICA

### Nuevos servicios necesarios:

1. **EvidenceService**
   - `createEvidence()` - Crear evidencia
   - `sendToReviewer()` - Enviar al especialista
   - `getPendingEvidence()` - Obtener evidencias pendientes

2. **PaymentService**
   - `processReceipt()` - Procesar comprobante con OCR
   - `verifyAmount()` - Verificar monto
   - `requestSecurityCode()` - Pedir código de seguridad
   - `verifySecurityCode()` - Verificar código en correo
   - `approvePayment()` - Aprobar pago

3. **InvoiceService**
   - `generateInvoice()` - Generar boleta PDF
   - `sendInvoice()` - Enviar boleta al cliente
   - `getNextInvoiceNumber()` - Obtener siguiente número

4. **EmailService**
   - `connectToEmail()` - Conectar a correo
   - `searchPayments()` - Buscar pagos en correo
   - `verifyPaymentCode()` - Verificar código en correo

5. **OCRService**
   - `extractTextFromImage()` - Extraer texto de imagen
   - `extractAmount()` - Extraer monto
   - `extractSecurityCode()` - Extraer código de seguridad
   - `extractDate()` - Extraer fecha

---

## 🔟 FLUJO COMPLETO RESUMIDO

### Evidencias Médicas:
```
Cliente envía evidencia → Sistema pregunta confirmación → 
Cliente confirma → Enviar a especialista → Notificar al cliente
```

### Pagos:
```
Cliente envía comprobante → OCR extrae monto → 
Verificar monto → Si coincide: pedir código (si Yape/Plin) → 
Verificar código en correo → Aprobar pago → 
Generar boleta → Enviar boleta al cliente
```

---

## 📝 NOTAS IMPORTANTES

1. **Seguridad**: Los códigos de seguridad deben verificarse de forma segura
2. **Privacidad**: Las evidencias médicas deben manejarse con confidencialidad
3. **Backup**: Guardar todos los comprobantes y boletas en BD
4. **Logs**: Registrar todas las acciones para auditoría
5. **Notificaciones**: Notificar al administrador cuando se requiera aprobación manual

---

## 🚀 PRÓXIMOS PASOS

1. Crear tablas en Prisma Schema
2. Implementar servicios (Evidence, Payment, Invoice, Email, OCR)
3. Integrar con WhatsApp para detectar evidencias y comprobantes
4. Configurar correo para verificación de pagos
5. Implementar generación de boletas PDF
6. Crear endpoints de API para administrador
7. Implementar panel de administración para revisar pagos pendientes










