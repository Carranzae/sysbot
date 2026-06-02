# 🤖 Guía de Uso - MCP para Redes Sociales

## 📋 ¿Qué es MCP (Model Context Protocol)?

MCP es un protocolo que permite conectar ChatGPT u otras IAs directamente con tu sistema de publicaciones de redes sociales. Esto significa que puedes modificar captions, programar posts y analizar rendimiento usando prompts naturales.

---

## 🚀 Flujo de Conexión

### Paso 1: Generar Código de Conexión
1. Ve a la sección **Redes** del dashboard
2. Haz clic en el botón **"Conectar IA (MCP)"**
3. Haz clic en **"Generar Código de Conexión"**
4. El sistema generará un código único como: `A1B2C3D4E5F6G7H8`

### Paso 2: Conectar con ChatGPT
1. Abre ChatGPT (o cualquier IA compatible)
2. Pega el código generado junto con tu instrucción
3. La IA se conectará automáticamente a tu sistema

### Paso 3: Enviar Prompts
Una vez conectado, puedes enviar prompts como:

```
Código MCP: A1B2C3D4E5F6G7H8
Modifica el caption para que sea más viral en Instagram y TikTok. 
Añade hashtags trending y un CTA potente.
```

---

## 📝 Ejemplos de Prompts

### 🎯 Modificar Caption
```
Código MCP: A1B2C3D4E5F6G7H8
Tengo este caption: "Ofrecemos los mejores servicios de salud en nuestra clínica"
Mejóralo para Instagram y TikTok con:
- Hook potente al inicio
- Hashtags relevantes
- Llamado a la acción claro
- Tono más juvenil y cercano
```

### 📅 Programar Publicaciones
```
Código MCP: A1B2C3D4E5F6G7H8
Programa 3 posts para esta semana:
1. Lunes: Promoción de consulta general
2. Miércoles: Tip de salud preventiva  
3. Viernes: Testimonio de paciente
Usa los mejores horarios para cada red
```

### 🔄 Cambiar Plataformas
```
Código MCP: A1B2C3D4E5F6G7H8
Quiero publicar este contenido en:
- Instagram: Formato Reels
- TikTok: Video corto con música trendy
- LinkedIn: Tono profesional
- Facebook: Comunidad local
Adapta el caption para cada plataforma
```

### 📊 Análisis de Rendimiento
```
Código MCP: A1B2C3D4E5F6G7H8
Analiza el rendimiento de mis últimas 5 publicaciones y dame:
- Mejor horario de publicación
- Plataforma con más engagement
- Tipo de contenido más efectivo
- Recomendaciones para mejorar
```

---

## 🔧 Endpoints de la API

### Generar Código
```http
POST /api/v1/mcp/generate-code
Content-Type: application/json

{
  "businessId": "tu-business-id",
  "expiresIn": 3600
}
```

**Respuesta:**
```json
{
  "success": true,
  "code": "A1B2C3D4E5F6G7H8",
  "expiresAt": "2026-04-11T09:47:00.000Z",
  "instructions": {
    "step1": "Copia este código",
    "step2": "Pégalo en ChatGPT con el prompt de tu publicación",
    "step3": "El sistema aplicará automáticamente los cambios",
    "note": "El código expira en 1 hora por seguridad"
  }
}
```

### Conectar Sesión
```http
POST /api/v1/mcp/connect
Content-Type: application/json

{
  "code": "A1B2C3D4E5F6G7H8",
  "businessId": "tu-business-id",
  "platform": "chatgpt"
}
```

### Procesar Prompt
```http
POST /api/v1/mcp/prompt
Content-Type: application/json

{
  "sessionId": "session-id-unico",
  "prompt": "Modifica este caption para que sea más viral...",
  "context": {
    "targetPlatforms": ["instagram", "tiktok"],
    "currentCaption": "Texto actual",
    "businessName": "Mi Negocio",
    "industryType": "salud"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "modifications": [
    {
      "type": "caption_update",
      "description": "Actualización de caption/texto de publicación",
      "applied": true
    }
  ],
  "newCaption": "🔥 ¡ATENCIÓN! ¿Buscas los mejores servicios de salud? 🏥✨",
  "scheduledPosts": [],
  "analysis": {
    "predictedReach": "25K - 45K",
    "predictedEngagement": "6.2% - 8.9%",
    "bestPostingTime": "Hoy, 19:30",
    "contentScore": 85
  },
  "appliedAt": "2026-04-11T08:47:00.000Z"
}
```

---

## 🔐 Seguridad

### ✅ Características de Seguridad
- **Códigos Temporales**: Expiran en 1 hora por defecto
- **Autenticación por Código**: Solo sesiones autorizadas
- **Aislamiento por Negocio**: Cada código solo funciona para un negocio específico
- **Logs Completo**: Todas las acciones quedan registradas
- **Sin Datos Persistentes**: Los códigos no se reutilizan

### 🛡️ Buenas Prácticas
1. **No compartas códigos**: Son personales y temporales
2. **Revisa las modificaciones**: La IA sugiere, tú apruebas
3. **Usa prompts específicos**: Más detalles = mejores resultados
4. **Monitorea la actividad**: Revisa el historial de cambios

---

## 📱 Integración con el Frontend

### Componente MCP Connector
El sistema incluye un componente React completo:

```tsx
import { McpConnector } from '@/components/social/mcp-connector';

<McpConnector
  open={mcpOpen}
  onOpenChange={setMcpOpen}
  businessId={selectedBusiness.id}
  businessName={selectedBusiness.name}
/>
```

### Estados del Componente
- **Generando**: Creando código único
- **Activo**: Código generado y listo para usar
- **Conectado**: Sesión MCP establecida
- **Expirado**: Código ya no válido

---

## 🎛️ Configuración Avanzada

### Personalizar Tiempo de Expiración
```typescript
// En mcp.service.ts
const expiresInMinutes = 120; // 2 horas en lugar de 1
```

### Modificar Plataformas Soportadas
```typescript
// En mcp.controller.ts
platform: { type: 'string', enum: ['chatgpt', 'claude', 'gemini', 'copilot'] }
```

### Personalizar Capacidades
```typescript
// En mcp.controller.ts
capabilities: [
  'modify_publications',
  'generate_content',
  'schedule_posts',
  'analyze_performance',
  'manage_campaigns',
  'optimize_hashtags'
]
```

---

## 🚨 Solución de Problemas

### Error: "Código MCP inválido o expirado"
- **Causa**: El código expiró o ya fue usado
- **Solución**: Genera un nuevo código

### Error: "Sesión MCP inválida"
- **Causa**: La sesión expiró por inactividad
- **Solución**: Vuelve a conectar con un nuevo código

### Error: "Negocio no encontrado"
- **Causa**: El businessId es incorrecto
- **Solución**: Verifica el ID del negocio seleccionado

### Error: "AI bot is disabled"
- **Causa**: El bot está desactivado para ese negocio
- **Solución**: Activa el bot en la configuración del negocio

---

## 📈 Métricas y Monitoreo

El sistema registra automáticamente:
- **Conexiones MCP**: Quién se conecta y cuándo
- **Prompts Procesados**: Qué se solicita modificar
- **Modificaciones Aplicadas**: Cambios realizados
- **Tiempo de Procesamiento**: Rendimiento del sistema

### Acceso a Métricas
```typescript
// Endpoint interno para monitoreo
GET /api/v1/mcp/metrics
```

---

## 🔄 Flujo Completo de Ejemplo

1. **Usuario**: "Quiero mejorar mis posts de Instagram"
2. **Sistema**: Genera código `X9Y8Z7W6V5U4T3S2`
3. **ChatGPT**: 
   ```
   Código MCP: X9Y8Z7W6V5U4T3S2
   Analiza mi último post y dame 3 ideas para mejorar el engagement
   ```
4. **Sistema**: 
   - Conecta sesión
   - Procesa prompt con IA local
   - Aplica modificaciones sugeridas
   - Devuelve resultados optimizados

---

## 🎯 Tips para Máximo Rendimiento

### Prompts Efectivos
- **Sé específico**: "Añade emojis de salud" vs "Mejora el texto"
- **Incluye contexto**: "Para clínica dental en Lima" vs "Para negocio"
- **Define audiencia**: "Para jóvenes 18-25" vs "General"

### Integración con Workflow Existente
- Usa MCP para **brainstorming** de contenido
- Combina con **programación automática**
- Aplica **análisis de rendimiento** posterior

### Automatización
```typescript
// Ejemplo: Generar código automáticamente
const mcpCode = await mcpService.generateConnectionCode(
  businessId, 
  180 // 3 horas para sesiones largas
);
```

---

## 📞 Soporte

Si tienes problemas con MCP:
1. **Revisa los logs** del backend
2. **Verifica la configuración** del negocio
3. **Valida los permisos** del usuario
4. **Contacta soporte** con el código de error

---

## 🚀 Próximas Mejoras

- [ ] Integración con más plataformas IA (Claude, Gemini, Copilot)
- [ ] Modo batch para múltiples publicaciones
- [ ] Plantillas de prompts predefinidas
- [ ] Análisis de competencia vía MCP
- [ ] Generación automática de hashtags trending
- [ ] Integración con calendario de contenido

---

**🎉 ¡Listo! Ahora puedes conectar ChatGPT directamente con tus redes sociales y modificar publicaciones usando prompts naturales.**
