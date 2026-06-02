# Arquitectura de SYST

## Visión General

SYST es un sistema multi-tenant de bots inteligentes diseñado para automatizar la atención al cliente mediante IA y WhatsApp Business API.

## Capas del Sistema

### 1. Frontend (Next.js)

**Tecnologías:**
- Next.js 14 con App Router
- TypeScript
- Tailwind CSS + Headless UI
- React Query para estado del servidor
- Zustand para estado global
- Socket.io Client para tiempo real

**Responsabilidades:**
- Panel de administración de negocios
- Dashboard con métricas en tiempo real
- Gestión de archivos de conocimiento
- Configuración de bots
- Visualización de conversaciones
- Gestión de citas, pedidos y leads

### 2. Backend (NestJS)

**Tecnologías:**
- NestJS con TypeScript
- GraphQL + REST API
- WebSockets (Socket.io)
- BullMQ para jobs
- Prisma ORM
- Passport JWT para autenticación

**Módulos Principales:**

#### Auth Module
- Registro y login de usuarios
- JWT authentication
- Role-based access control

#### Business Module
- CRUD de negocios
- Configuración por rubro
- Métricas y dashboards

#### WhatsApp Module
- Integración con WhatsApp Business API
- Webhook handler
- Envío de mensajes

#### Messages Module
- Almacenamiento de mensajes
- Historial de conversaciones
- Estadísticas

#### AI Module
- Integración con OpenAI
- Procesamiento RAG
- Gestión de embeddings

#### Files Module
- Subida de archivos
- Procesamiento de documentos
- Extracción de texto

#### Appointments Module
- Gestión de citas
- Recordatorios automáticos

#### Orders Module
- Gestión de pedidos
- Tracking de estados

#### Leads Module
- Captura de leads
- Seguimiento

#### Notifications Module
- Notificaciones programadas
- Recordatorios

#### WebSocket Module
- Comunicación en tiempo real
- Eventos del sistema

#### Jobs Module
- Procesamiento asíncrono
- Colas de tareas

### 3. Base de Datos

**PostgreSQL:**
- Datos estructurados
- Relaciones entre entidades
- Transacciones ACID

**Redis:**
- Cache de sesiones
- Estados de bots
- Rate limiting
- Colas de jobs (BullMQ)

**Qdrant (Vector DB):**
- Almacenamiento de embeddings
- Búsqueda semántica
- Aislamiento por negocio

### 4. Motor de IA

**Componentes:**

#### OpenAI Service
- Generación de respuestas con GPT-4
- Creación de embeddings
- Gestión de prompts por rubro

#### Vector Service
- Interfaz con Qdrant
- CRUD de vectores
- Búsqueda semántica

#### RAG Service
- Retrieval-Augmented Generation
- Contextualización de respuestas
- Procesamiento de conocimiento

**Flujo RAG:**
1. Cliente envía mensaje
2. Mensaje se convierte en embedding
3. Búsqueda en Vector DB del negocio
4. Recuperación de contexto relevante
5. Construcción de prompt con contexto
6. Generación de respuesta con GPT-4
7. Envío de respuesta al cliente

### 5. Integraciones

**WhatsApp Business API:**
- Recepción de mensajes (webhook)
- Envío de mensajes
- Estados de mensajes
- Plantillas de mensajes

**Almacenamiento de Archivos:**
- Local (desarrollo)
- AWS S3 / Cloudflare R2 (producción)

## Flujo de Datos

### Mensaje Entrante de WhatsApp

```
WhatsApp → Webhook → Backend
                      ↓
                  Identificar Negocio
                      ↓
                  Guardar Mensaje
                      ↓
                  Motor IA (RAG)
                      ↓
                  Generar Respuesta
                      ↓
                  Enviar a WhatsApp
                      ↓
                  WebSocket → Frontend
```

### Subida de Archivo

```
Frontend → Backend → Guardar Archivo
                      ↓
                  Procesar Documento
                      ↓
                  Extraer Texto
                      ↓
                  Chunking
                      ↓
                  Crear Embeddings
                      ↓
                  Guardar en Vector DB
                      ↓
                  Actualizar Estado
```

## Seguridad

### Autenticación
- JWT tokens con expiración
- Refresh tokens
- Password hashing con bcrypt

### Autorización
- Role-based access control (RBAC)
- Aislamiento por business_id
- Validación de permisos en cada request

### Datos
- Encriptación en tránsito (HTTPS/WSS)
- Encriptación en reposo (base de datos)
- Sanitización de inputs
- Rate limiting

## Escalabilidad

### Horizontal

**Backend:**
- Múltiples instancias detrás de Load Balancer
- Sesiones en Redis (stateless)
- Jobs distribuidos con BullMQ

**Base de Datos:**
- PostgreSQL con réplicas de lectura
- Redis Cluster
- Qdrant escalable

**Vector DB:**
- Colecciones por negocio
- Sharding automático

### Vertical

- Optimización de queries
- Índices en base de datos
- Cache de resultados frecuentes
- Compresión de respuestas

## Monitoreo y Observabilidad

### Métricas
- Tiempo de respuesta de IA
- Tasa de éxito de mensajes
- Uso de recursos
- Errores y excepciones

### Logs
- Logs estructurados (JSON)
- Niveles: error, warn, info, debug
- Correlación con request ID

### Alertas
- Errores críticos
- Latencia alta
- Uso excesivo de recursos
- Fallos en integraciones

## Patrones de Diseño

### Backend
- Dependency Injection (NestJS)
- Repository Pattern (Prisma)
- Factory Pattern (AI Services)
- Observer Pattern (WebSockets)
- Queue Pattern (BullMQ)

### Frontend
- Component Composition
- Custom Hooks
- Context API
- Server State Management (React Query)

## Consideraciones de Rendimiento

### Backend
- Conexión pool de base de datos
- Cache de queries frecuentes
- Procesamiento asíncrono de archivos
- Paginación de resultados

### Frontend
- Code splitting
- Lazy loading
- Image optimization
- Virtual scrolling para listas largas

### IA
- Batch processing de embeddings
- Cache de respuestas similares
- Timeout en llamadas a OpenAI
- Fallback a respuestas predefinidas

## Disaster Recovery

### Backup
- Backup diario de PostgreSQL
- Backup de archivos en S3
- Snapshots de Vector DB

### Recuperación
- Restore desde backup
- Réplicas de base de datos
- Redundancia geográfica (opcional)

## Roadmap Técnico

### Fase 1 (Actual)
- ✅ Arquitectura base
- ✅ Integración WhatsApp
- ✅ Motor RAG
- ✅ Panel de administración

### Fase 2
- Multi-canal (Telegram, Instagram)
- IA conversacional avanzada
- Analytics predictivo
- Integraciones CRM

### Fase 3
- Voice AI
- Video llamadas
- Chatbot visual
- Marketplace de integraciones
