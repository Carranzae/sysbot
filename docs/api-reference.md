# API Reference - SYST

Base URL: `http://localhost:3001/api/v1`

## Authentication

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

## Business

### Create Business

```http
POST /business
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Mi Restaurante",
  "description": "Restaurante de comida italiana",
  "industryType": "RESTAURANT",
  "phone": "+1234567890",
  "email": "info@mirestaurante.com",
  "address": "Calle Principal 123"
}
```

### Get All Businesses

```http
GET /business
Authorization: Bearer {token}
```

### Get Business by ID

```http
GET /business/{id}
Authorization: Bearer {token}
```

### Update Business

```http
PATCH /business/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Nuevo Nombre",
  "isActive": true
}
```

### Get Business Metrics

```http
GET /business/{id}/metrics
Authorization: Bearer {token}
```

**Response:**
```json
{
  "totalMessages": 1250,
  "messagesHandledByAI": 1100,
  "averageResponseTime": 850,
  "activeConversations": 15,
  "appointmentsToday": 8,
  "ordersToday": 23,
  "leadsGenerated": 45
}
```

### Update Bot Config

```http
PATCH /business/{id}/bot-config
Authorization: Bearer {token}
Content-Type: application/json

{
  "welcomeMessage": "¡Hola! Bienvenido a nuestro restaurante",
  "fallbackMessage": "Un momento, te contacto con un asesor",
  "autoReply": true,
  "temperature": 0.7,
  "maxTokens": 500
}
```

## Files

### Upload File

```http
POST /files/upload/{businessId}
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary]
```

### Get Business Files

```http
GET /files/business/{businessId}
Authorization: Bearer {token}
```

### Delete File

```http
DELETE /files/{id}
Authorization: Bearer {token}
```

## Messages

### Get Business Messages

```http
GET /messages/business/{businessId}?limit=50
Authorization: Bearer {token}
```

### Get Message Stats

```http
GET /messages/business/{businessId}/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "total": 1250,
  "aiHandled": 1100,
  "avgProcessingTime": 850,
  "aiPercentage": 88
}
```

### Get Conversation History

```http
GET /messages/business/{businessId}/conversation/{phoneNumber}?limit=10
Authorization: Bearer {token}
```

## Appointments

### Create Appointment

```http
POST /appointments/{businessId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "customerName": "Juan Pérez",
  "customerPhone": "+1234567890",
  "customerEmail": "juan@example.com",
  "appointmentDate": "2024-01-15T10:00:00Z",
  "duration": 60,
  "notes": "Consulta general"
}
```

### Get Business Appointments

```http
GET /appointments/business/{businessId}
Authorization: Bearer {token}
```

### Get Upcoming Appointments

```http
GET /appointments/business/{businessId}/upcoming
Authorization: Bearer {token}
```

### Update Appointment

```http
PATCH /appointments/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "CONFIRMED",
  "notes": "Confirmado por teléfono"
}
```

## Orders

### Create Order

```http
POST /orders/{businessId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "customerName": "María García",
  "customerPhone": "+1234567890",
  "items": [
    {
      "name": "Pizza Margherita",
      "quantity": 2,
      "price": 12.99
    }
  ],
  "totalAmount": 25.98,
  "deliveryDate": "2024-01-15T19:00:00Z"
}
```

### Get Business Orders

```http
GET /orders/business/{businessId}
Authorization: Bearer {token}
```

### Get Order Stats

```http
GET /orders/business/{businessId}/stats
Authorization: Bearer {token}
```

### Update Order

```http
PATCH /orders/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "IN_PROGRESS"
}
```

## Leads

### Create Lead

```http
POST /leads/{businessId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Carlos López",
  "phone": "+1234567890",
  "email": "carlos@example.com",
  "source": "WhatsApp",
  "notes": "Interesado en servicios premium"
}
```

### Get Business Leads

```http
GET /leads/business/{businessId}
Authorization: Bearer {token}
```

### Update Lead

```http
PATCH /leads/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "QUALIFIED",
  "notes": "Contactado y calificado"
}
```

## Notifications

### Create Notification

```http
POST /notifications/{businessId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "APPOINTMENT_REMINDER",
  "recipient": "+1234567890",
  "subject": "Recordatorio de Cita",
  "message": "Tienes una cita mañana a las 10:00 AM",
  "scheduledAt": "2024-01-14T18:00:00Z"
}
```

### Get Business Notifications

```http
GET /notifications/business/{businessId}
Authorization: Bearer {token}
```

### Get Pending Notifications

```http
GET /notifications/business/{businessId}/pending
Authorization: Bearer {token}
```

## WhatsApp

### Webhook Verification

```http
GET /whatsapp/webhook?hub.mode=subscribe&hub.verify_token={token}&hub.challenge={challenge}
```

### Webhook Handler

```http
POST /whatsapp/webhook
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [...]
}
```

## WebSocket Events

### Connect

```javascript
const socket = io('http://localhost:3001');
```

### Join Business Room

```javascript
socket.emit('joinBusiness', businessId);
```

### Listen for New Messages

```javascript
socket.on('newMessage', (message) => {
  console.log('New message:', message);
});
```

### Listen for New Orders

```javascript
socket.on('newOrder', (order) => {
  console.log('New order:', order);
});
```

### Listen for New Appointments

```javascript
socket.on('newAppointment', (appointment) => {
  console.log('New appointment:', appointment);
});
```

## Error Responses

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "email must be a valid email"
  ]
}
```

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 404 Not Found

```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## Rate Limiting

- **Límite:** 100 requests por minuto por IP
- **Header:** `X-RateLimit-Remaining`
- **Reset:** `X-RateLimit-Reset`

## Pagination

Para endpoints que retornan listas:

```http
GET /resource?page=1&limit=20
```

**Response:**
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```
