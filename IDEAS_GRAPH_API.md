# 🚀 IDEAS PARA IMPLEMENTAR GRAPH API (GraphQL)

## 🎯 ¿QUÉ ES GRAPH API Y POR QUÉ IMPLEMENTARLO?

GraphQL es un lenguaje de consulta que permite al frontend solicitar exactamente los datos que necesita, en una sola petición. Es más flexible y eficiente que REST API.

---

## 📊 VENTAJAS PARA TU SISTEMA

### 1. **Consultas Flexibles**
- El frontend puede pedir solo los campos que necesita
- Una sola petición puede traer datos de múltiples tablas relacionadas
- Menos sobrecarga de datos

### 2. **Ideal para Dashboard**
- Consultas complejas en una sola petición
- Estadísticas combinadas (pagos, evidencias, citas)
- Filtros y búsquedas avanzadas

### 3. **Mejor para Pagos y Evidencias**
- Consultar pagos con sus boletas relacionadas
- Evidencias con información del cliente
- Estadísticas de pagos por fecha, estado, método

---

## 🏗️ ESTRUCTURA SUGERIDA

### **1. QUERIES (Consultas - Lectura de datos)**

#### **Pagos y Comprobantes:**
```graphql
# Obtener todos los comprobantes de pago
query GetPaymentReceipts($businessId: ID!, $status: PaymentReceiptStatus, $limit: Int) {
  paymentReceipts(businessId: $businessId, status: $status, limit: $limit) {
    id
    customerName
    customerPhone
    amount
    expectedAmount
    paymentMethod
    status
    verifiedAt
    createdAt
    receiptFile {
      id
      originalName
      url
    }
    appointment {
      id
      customerName
      appointmentDate
      specialty
    }
    invoices {
      id
      invoiceNumber
      amount
      createdAt
    }
  }
}

# Obtener un comprobante específico con todos sus detalles
query GetPaymentReceipt($id: ID!) {
  paymentReceipt(id: $id) {
    id
    customerName
    customerPhone
    amount
    securityCode
    paymentMethod
    status
    ocrData
    receiptFile {
      id
      originalName
      url
    }
    appointment {
      id
      customerName
      appointmentDate
      specialty
      price
    }
    invoices {
      id
      invoiceNumber
      invoiceFile {
        url
      }
    }
  }
}

# Estadísticas de pagos
query GetPaymentStats($businessId: ID!, $startDate: DateTime, $endDate: DateTime) {
  paymentStats(businessId: $businessId, startDate: $startDate, endDate: $endDate) {
    totalPayments
    totalAmount
    verifiedPayments
    pendingPayments
    rejectedPayments
    byMethod {
      method
      count
      totalAmount
    }
    byDate {
      date
      count
      totalAmount
    }
  }
}
```

#### **Evidencias Médicas:**
```graphql
# Obtener evidencias médicas
query GetEvidences($businessId: ID!, $status: EvidenceStatus, $limit: Int) {
  evidences(businessId: $businessId, status: $status, limit: $limit) {
    id
    customerName
    customerPhone
    evidenceType
    description
    status
    reviewedAt
    createdAt
    file {
      id
      originalName
      url
      mimeType
    }
  }
}

# Obtener evidencias de un cliente específico
query GetCustomerEvidences($businessId: ID!, $customerPhone: String!) {
  customerEvidences(businessId: $businessId, customerPhone: $customerPhone) {
    id
    evidenceType
    description
    status
    createdAt
    file {
      url
    }
  }
}
```

#### **Boletas:**
```graphql
# Obtener boletas
query GetInvoices($businessId: ID!, $limit: Int, $offset: Int) {
  invoices(businessId: $businessId, limit: $limit, offset: $offset) {
    id
    invoiceNumber
    customerName
    customerPhone
    amount
    createdAt
    paymentReceipt {
      id
      paymentMethod
      verifiedAt
    }
    appointment {
      id
      specialty
      appointmentDate
    }
    invoiceFile {
      id
      url
      originalName
    }
  }
}

# Obtener una boleta específica
query GetInvoice($id: ID!) {
  invoice(id: $id) {
    id
    invoiceNumber
    customerName
    customerPhone
    amount
    createdAt
    invoiceFile {
      url
    }
    paymentReceipt {
      id
      amount
      paymentMethod
    }
    appointment {
      id
      specialty
      appointmentDate
      price
    }
  }
}
```

#### **Consultas Combinadas (Dashboard):**
```graphql
# Dashboard completo con todas las métricas
query GetDashboard($businessId: ID!) {
  dashboard(businessId: $businessId) {
    payments {
      total
      verified
      pending
      rejected
      totalAmount
    }
    evidences {
      total
      pending
      reviewed
    }
    invoices {
      total
      totalAmount
      thisMonth
    }
    recentPayments(limit: 5) {
      id
      customerName
      amount
      status
      createdAt
    }
    recentEvidences(limit: 5) {
      id
      customerName
      evidenceType
      status
      createdAt
    }
  }
}
```

---

### **2. MUTATIONS (Modificaciones - Escritura de datos)**

#### **Pagos:**
```graphql
# Procesar un comprobante de pago
mutation ProcessPaymentReceipt($input: ProcessReceiptInput!) {
  processPaymentReceipt(input: $input) {
    receipt {
      id
      amount
      status
    }
    needsSecurityCode
    message
  }
}

# Verificar código de seguridad
mutation VerifySecurityCode($receiptId: ID!, $securityCode: String!) {
  verifySecurityCode(receiptId: $receiptId, securityCode: $securityCode) {
    receipt {
      id
      status
      verifiedAt
    }
    message
  }
}

# Aprobar pago manualmente (admin)
mutation ApprovePayment($receiptId: ID!) {
  approvePayment(receiptId: $receiptId) {
    receipt {
      id
      status
      verifiedAt
    }
    invoice {
      id
      invoiceNumber
    }
    message
  }
}

# Rechazar pago
mutation RejectPayment($receiptId: ID!, $reason: String) {
  rejectPayment(receiptId: $receiptId, reason: $reason) {
    receipt {
      id
      status
    }
    message
  }
}
```

#### **Evidencias:**
```graphql
# Crear evidencia médica
mutation CreateEvidence($input: CreateEvidenceInput!) {
  createEvidence(input: $input) {
    id
    customerName
    evidenceType
    status
    file {
      id
      url
    }
  }
}

# Enviar evidencia al especialista
mutation SendEvidenceToReviewer($evidenceId: ID!) {
  sendEvidenceToReviewer(evidenceId: $evidenceId) {
    evidence {
      id
      status
    }
    reviewerDestination
    message
  }
}

# Marcar evidencia como revisada
mutation MarkEvidenceAsReviewed($evidenceId: ID!) {
  markEvidenceAsReviewed(evidenceId: $evidenceId) {
    id
    status
    reviewedAt
  }
}
```

#### **Boletas:**
```graphql
# Generar boleta
mutation GenerateInvoice($paymentReceiptId: ID!) {
  generateInvoice(paymentReceiptId: $paymentReceiptId) {
    invoice {
      id
      invoiceNumber
      amount
      invoiceFile {
        url
      }
    }
    message
  }
}

# Enviar boleta al cliente
mutation SendInvoiceToCustomer($invoiceId: ID!) {
  sendInvoiceToCustomer(invoiceId: $invoiceId) {
    invoice {
      id
    }
    message
  }
}
```

---

## 📱 CASOS DE USO EN EL FRONTEND

### **1. Página de Pagos Pendientes:**
```graphql
query GetPendingPayments($businessId: ID!) {
  paymentReceipts(businessId: $businessId, status: PENDING) {
    id
    customerName
    amount
    expectedAmount
    paymentMethod
    createdAt
    receiptFile {
      url
    }
    appointment {
      specialty
      appointmentDate
    }
  }
}
```
**Ventaja:** Una sola petición trae todo lo necesario para mostrar la lista

### **2. Detalle de Pago (Modal/Página):**
```graphql
query GetPaymentDetail($id: ID!) {
  paymentReceipt(id: $id) {
    id
    customerName
    customerPhone
    amount
    expectedAmount
    securityCode
    paymentMethod
    status
    ocrData
    receiptFile {
      url
      originalName
    }
    appointment {
      id
      customerName
      appointmentDate
      specialty
      price
    }
    invoices {
      id
      invoiceNumber
      invoiceFile {
        url
      }
    }
  }
}
```
**Ventaja:** Todo en una petición, sin múltiples llamadas REST

### **3. Dashboard de Estadísticas:**
```graphql
query GetDashboard($businessId: ID!) {
  dashboard(businessId: $businessId) {
    payments {
      total
      verified
      pending
      totalAmount
      byMethod {
        method
        count
        totalAmount
      }
    }
    evidences {
      total
      pending
      reviewed
    }
    invoices {
      total
      totalAmount
    }
  }
}
```
**Ventaja:** Una petición trae todas las métricas del dashboard

### **4. Historial de Cliente:**
```graphql
query GetCustomerHistory($businessId: ID!, $customerPhone: String!) {
  customerPayments(businessId: $businessId, customerPhone: $customerPhone) {
    id
    amount
    status
    createdAt
    invoices {
      invoiceNumber
    }
  }
  customerEvidences(businessId: $businessId, customerPhone: $customerPhone) {
    id
    evidenceType
    status
    createdAt
  }
  customerAppointments(businessId: $businessId, customerPhone: $customerPhone) {
    id
    appointmentDate
    specialty
    status
  }
}
```
**Ventaja:** Historial completo del cliente en una sola petición

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### **1. Librerías Necesarias:**
```bash
# Backend (NestJS)
pnpm add @nestjs/graphql @nestjs/apollo graphql apollo-server-express

# Frontend (Next.js)
pnpm add @apollo/client graphql
```

### **2. Estructura de Archivos:**
```
apps/backend/src/modules/
  ├── payment/
  │   ├── payment.resolver.ts      # GraphQL Resolver
  │   ├── payment.service.ts       # Lógica de negocio
  │   └── dto/
  │       └── payment.input.ts     # Input types GraphQL
  ├── evidence/
  │   ├── evidence.resolver.ts
  │   └── evidence.service.ts
  └── invoice/
      ├── invoice.resolver.ts
      └── invoice.service.ts
```

### **3. Tipos GraphQL Sugeridos:**

```typescript
// Enums
enum PaymentReceiptStatus {
  PENDING
  VERIFIED
  REJECTED
  MANUAL_REVIEW
}

enum PaymentMethod {
  YAPE
  PLIN
  TRANSFER
  CASH
  OTHER
}

enum EvidenceStatus {
  PENDING
  REVIEWED
  ARCHIVED
}

enum EvidenceType {
  IMAGE
  VIDEO
  AUDIO
}

// Types
type PaymentReceipt {
  id: ID!
  customerName: String
  customerPhone: String!
  amount: Float!
  expectedAmount: Float
  securityCode: String
  paymentMethod: PaymentMethod
  status: PaymentReceiptStatus!
  ocrData: JSON
  receiptFile: File!
  appointment: Appointment
  invoices: [Invoice!]!
  createdAt: DateTime!
  verifiedAt: DateTime
}

type Evidence {
  id: ID!
  customerName: String
  customerPhone: String!
  evidenceType: EvidenceType!
  description: String
  status: EvidenceStatus!
  file: File!
  reviewerDestination: String
  createdAt: DateTime!
  reviewedAt: DateTime
}

type Invoice {
  id: ID!
  invoiceNumber: String!
  customerName: String
  customerPhone: String!
  amount: Float!
  invoiceFile: File!
  paymentReceipt: PaymentReceipt!
  appointment: Appointment
  createdAt: DateTime!
}

type PaymentStats {
  totalPayments: Int!
  totalAmount: Float!
  verifiedPayments: Int!
  pendingPayments: Int!
  rejectedPayments: Int!
  byMethod: [PaymentMethodStats!]!
  byDate: [PaymentDateStats!]!
}

type PaymentMethodStats {
  method: PaymentMethod!
  count: Int!
  totalAmount: Float!
}

type PaymentDateStats {
  date: DateTime!
  count: Int!
  totalAmount: Float!
}

// Inputs
input ProcessReceiptInput {
  businessId: ID!
  customerPhone: String!
  customerName: String
  receiptFileId: ID!
  appointmentId: ID
}

input CreateEvidenceInput {
  businessId: ID!
  customerPhone: String!
  customerName: String
  evidenceType: EvidenceType!
  fileId: ID!
  description: String
}
```

---

## 🎨 VENTAJAS ESPECÍFICAS PARA TU SISTEMA

### **1. Consultas Optimizadas:**
- En lugar de 3-4 llamadas REST para ver un pago completo, una sola query GraphQL
- El frontend decide qué datos necesita
- Menos datos transferidos = más rápido

### **2. Filtros Avanzados:**
```graphql
query GetPayments(
  $businessId: ID!
  $status: PaymentReceiptStatus
  $paymentMethod: PaymentMethod
  $startDate: DateTime
  $endDate: DateTime
  $minAmount: Float
  $maxAmount: Float
) {
  paymentReceipts(
    businessId: $businessId
    status: $status
    paymentMethod: $paymentMethod
    startDate: $startDate
    endDate: $endDate
    minAmount: $minAmount
    maxAmount: $maxAmount
  ) {
    id
    customerName
    amount
    status
  }
}
```

### **3. Subscripciones en Tiempo Real:**
```graphql
subscription OnPaymentStatusChanged($businessId: ID!) {
  paymentStatusChanged(businessId: $businessId) {
    receipt {
      id
      status
    }
    event
  }
}
```
**Ventaja:** El frontend se actualiza automáticamente cuando cambia el estado de un pago

### **4. Búsqueda Inteligente:**
```graphql
query SearchPayments($businessId: ID!, $search: String!) {
  searchPayments(businessId: $businessId, search: $search) {
    receipts {
      id
      customerName
      amount
    }
    invoices {
      id
      invoiceNumber
    }
  }
}
```

---

## 📊 COMPARACIÓN: REST vs GraphQL

### **REST API (Actual):**
```
GET /api/v1/payment-receipts?businessId=xxx
GET /api/v1/payment-receipts/123
GET /api/v1/payment-receipts/123/invoice
GET /api/v1/appointments/456
```
**Total:** 4 peticiones HTTP

### **GraphQL:**
```graphql
query {
  paymentReceipt(id: "123") {
    id
    amount
    invoice {
      invoiceNumber
    }
    appointment {
      id
      specialty
    }
  }
}
```
**Total:** 1 petición HTTP

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Setup Básico**
1. Instalar dependencias GraphQL
2. Configurar Apollo Server en NestJS
3. Crear schema básico

### **Fase 2: Queries Principales**
1. Query de pagos pendientes
2. Query de evidencias
3. Query de boletas
4. Query de dashboard

### **Fase 3: Mutations**
1. Procesar comprobante
2. Aprobar/Rechazar pago
3. Enviar evidencia
4. Generar boleta

### **Fase 4: Frontend**
1. Configurar Apollo Client
2. Crear hooks para queries
3. Actualizar componentes para usar GraphQL

### **Fase 5: Avanzado**
1. Subscripciones en tiempo real
2. Caché inteligente
3. Optimistic updates

---

## 💡 IDEAS ADICIONALES

### **1. GraphQL Playground:**
- Interfaz web para probar queries
- Documentación automática
- Disponible en: `http://localhost:3001/graphql`

### **2. Batching y DataLoader:**
- Agrupar múltiples queries en una sola petición
- Reducir consultas a la BD
- Mejor rendimiento

### **3. Fragmentos Reutilizables:**
```graphql
fragment PaymentReceiptBasic on PaymentReceipt {
  id
  customerName
  amount
  status
}

query {
  paymentReceipts {
    ...PaymentReceiptBasic
  }
}
```

### **4. Validación Automática:**
- GraphQL valida tipos automáticamente
- Menos errores en runtime
- Mejor experiencia de desarrollo

---

## 🎯 CONCLUSIÓN

**GraphQL es ideal para tu sistema porque:**
- ✅ Consultas complejas de pagos, evidencias y boletas
- ✅ Dashboard con múltiples métricas
- ✅ Menos peticiones HTTP = mejor rendimiento
- ✅ Frontend más flexible y eficiente
- ✅ Subscripciones en tiempo real
- ✅ Mejor experiencia de desarrollo

**Recomendación:** Implementar GraphQL como complemento a REST API, no como reemplazo. Usar GraphQL para consultas complejas y REST para operaciones simples.










