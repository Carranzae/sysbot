# SYST - Sistema Inteligente de Bots para Negocios

## 🎯 Objetivo
Automatizar atención, pedidos, citas, información y notificaciones para distintos negocios y rubros mediante bots de IA adaptables, panel web elegante y escalable horizontalmente.

## 🏗️ Arquitectura

### Capas Principales
1. **Frontend** - Panel de control (Next.js + TypeScript + Tailwind)
2. **Backend** - API y lógica (NestJS + TypeScript)
3. **Base de Datos** - PostgreSQL + Prisma + Redis
4. **Motor IA** - RAG + Embeddings + Vector DB
5. **Integraciones** - WhatsApp Business API + Webhooks

## 📁 Estructura del Proyecto

```
SYSTINF/
├── apps/
│   ├── frontend/          # Next.js Panel Web
│   └── backend/           # NestJS API
├── packages/
│   ├── shared/            # Tipos compartidos
│   ├── ai-engine/         # Motor IA y RAG
│   └── database/          # Prisma schemas
├── docker/                # Configuraciones Docker
├── docs/                  # Documentación
└── scripts/               # Scripts de despliegue
```

## 🚀 Tecnologías

### Frontend
- Next.js 14 + TypeScript
- Tailwind CSS + Headless UI
- React Query + Zustand
- Recharts (dashboards)

### Backend
- NestJS + TypeScript
- GraphQL + REST API
- WebSockets (tiempo real)
- BullMQ + Redis (jobs)

### Base de Datos
- PostgreSQL (datos estructurados)
- Prisma ORM
- Redis (cache y sesiones)
- Qdrant/Pinecone (Vector DB)

### IA
- OpenAI GPT-4 API
- Embeddings API
- RAG (Retrieval-Augmented Generation)

### Integraciones
- WhatsApp Business API
- Amazon S3 / Cloudflare R2

## 🔄 Flujo del Sistema

1. **Registro** → Negocio crea cuenta y selecciona rubro
2. **Configuración** → Sube archivos de conocimiento
3. **Procesamiento IA** → Chunking → Embeddings → Vector DB
4. **Conexión WhatsApp** → Integración con Business API
5. **Automatización** → Bot responde según rubro y contexto
6. **Panel** → Métricas en tiempo real (ventas, citas, leads)

## 📊 Rubros Soportados

- 🍽️ Restaurantes (menú, pedidos, QR)
- 🏥 Clínicas (citas, recordatorios)
- 🏢 Inmobiliarias (propiedades, visitas)
- 🎓 Academias (cursos, inscripciones)
- 🛍️ Retail (productos, ventas)
- ⚙️ Personalizable para otros rubros

## 🔐 Seguridad

- JWT Authentication
- Role-based access control
- Aislamiento por business_id
- Encriptación de datos sensibles

## 📈 Escalabilidad

- Arquitectura de microservicios
- Docker + Load Balancer
- Redis para estados distribuidos
- PostgreSQL en clúster
- Vector DB escalable

## 🛠️ Instalación

Ver documentación detallada en `/docs/installation.md`

## 📝 Licencia

Propietario - Todos los derechos reservados
