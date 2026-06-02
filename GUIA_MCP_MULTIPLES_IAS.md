# 🤖 Guía MCP - Múltiples IAs Soportadas

## 🎯 **Ahora Soportamos 6 Plataformas IA**

Tu sistema MCP ahora funciona con **ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity y cualquier IA personalizada**.

---

## 🚀 **Flujo Mejorado Multi-IA**

### Paso 1: Selecciona tu IA Preferida
1. Ve a **Redes** → **"Conectar IA (MCP)"**
2. Click en **"Seleccionar Plataforma"** (nuevo botón con ícono de engranaje)
3. Elige entre:
   - 🤖 **ChatGPT** - Creatividad y conversación
   - 🧠 **Claude** - Análisis profundo y razonamiento
   - ✨ **Gemini** - Contenido visual y multimedia
   - ⚡ **Microsoft Copilot** - Entorno corporativo
   - 🔍 **Perplexity** - Datos en tiempo real
   - ⚙️ **Personalizado** - Configuración custom

### Paso 2: Genera Código Específico
El sistema genera un código único **optimizado para la IA seleccionada**.

### Paso 3: Conecta y Envía Prompts
Copia el código y pégalo en tu IA elegida con tus instrucciones.

---

## 🎭 **Características Únicas por Plataforma**

### 🤖 **ChatGPT (OpenAI)**
```typescript
platformConfig: {
  style: 'conversacional y creativo',
  capabilities: ['generación de contenido', 'análisis de tendencias', 'optimización de hashtags'],
  promptPrefix: 'Actúa como un experto en marketing digital con acceso a ChatGPT-4.',
  optimization: 'foco en virality y engagement'
}
```

**✨ Ideal para:**
- Creatividad y contenido viral
- Conversaciones naturales
- Tendencias y hashtags
- Contenido emocional

**📝 Prompt Ejemplo:**
```
Código MCP: A1B2C3D4E5F6G7H8
Actúa como un experto en TikTok. Necesito un caption que haga viral mi nuevo producto de belleza.
Incluye hooks potentes, emojis trending, y hashtags que exploten el algoritmo.
Haz que la gente sienta FOMO inmediata.
```

### 🧠 **Claude (Anthropic)**
```typescript
platformConfig: {
  style: 'analítico y detallado',
  capabilities: ['análisis profundo', 'razonamiento complejo', 'contenido educativo'],
  promptPrefix: 'Actúa como un estratega de contenido con capacidades analíticas avanzadas de Claude.',
  optimization: 'foco en precisión y valor educativo'
}
```

**✨ Ideal para:**
- Análisis detallado de mercado
- Contenido educativo
- Estrategias complejas
- Razonamiento paso a paso

**📝 Prompt Ejemplo:**
```
Código MCP: A1B2C3D4E5F6G7H8
Analiza mi industria de tecnología B2B y genera 3 posts educativos que posicionen mi empresa como líder.
Cada post debe incluir datos, estadísticas y llamados a la acción profesionales.
Explica tu razonamiento estratégico.
```

### ✨ **Gemini (Google)**
```typescript
platformConfig: {
  style: 'visual y multimedia',
  capabilities: ['generación multimedia', 'análisis visual', 'tendencias visuales'],
  promptPrefix: 'Actúa como un creativo digital con acceso a las capacidades multimodales de Gemini.',
  optimization: 'foco en contenido visual y trending visual'
}
```

**✨ Ideal para:**
- Contenido visual y multimedia
- Análisis de imágenes y videos
- Tendencias visuales
- Contenido Instagram/TikTok

**📝 Prompt Ejemplo:**
```
Código MCP: A1B2C3D4E5F6G7H8
Crea contenido visual para mi marca de moda. Analiza las tendencias de colores y estilos actuales.
Genera ideas para 5 videos cortos con descripciones visuales detalladas.
Incluye sugerencias de edición y efectos trending.
```

### ⚡ **Microsoft Copilot**
```typescript
platformConfig: {
  style: 'profesional y corporativo',
  capabilities: ['integración Microsoft', 'productividad', 'contenido B2B'],
  promptPrefix: 'Actúa como un consultor de marketing empresarial con acceso a Microsoft Copilot.',
  optimization: 'foco en profesionalismo y ROI'
}
```

**✨ Ideal para:**
- Entornos corporativos
- Integración con Office 365
- Contenido B2B profesional
- Productividad y ROI

**📝 Prompt Ejemplo:**
```
Código MCP: A1B2C3D4E5F6G7H8
Genera contenido para LinkedIn que posicione nuestra empresa como líder en soluciones empresariales.
Crea un post para cada día de la semana con enfoque en diferentes aspectos de nuestro software.
Incluye métricas y casos de éxito profesionales.
```

### 🔍 **Perplexity**
```typescript
platformConfig: {
  style: 'investigativo y actualizado',
  capabilities: ['búsqueda en tiempo real', 'tendencias actuales', 'datos frescos'],
  promptPrefix: 'Actúa como un analista de tendencias con acceso a información en tiempo real vía Perplexity.',
  optimization: 'foco en actualidad y datos frescos'
}
```

**✨ Ideal para:**
- Noticias y tendencias actuales
- Datos en tiempo real
- Contenido noticioso
- Análisis de mercado fresco

**📝 Prompt Ejemplo:**
```
Código MCP: A1B2C3D4E5F6G7H8
Investiga las últimas noticias sobre sostenibilidad y crea 3 posts que conecten nuestra marca eco-friendly
con las tendencias actuales. Incluye datos y estadísticas recientes.
```

### ⚙️ **Personalizado (Custom)**
```typescript
platformConfig: {
  style: 'personalizado',
  capabilities: ['personalización completa', 'adaptación total'],
  promptPrefix: 'Actúa como un asistente de IA personalizado para este negocio.',
  optimization: 'foco en personalización total'
}
```

**✨ Ideal para:**
- IAs internas o personalizadas
- Casos especiales
- Integraciones custom
- Requerimientos únicos

---

## 🔧 **Configuración por Plataforma**

### Detección Automática
El sistema detecta automáticamente qué IA estás usando:

```typescript
// En mcp.service.ts
const platformDetection = {
  userAgent: req.headers['user-agent'],
  referrer: req.headers.referer,
  prompt: prompt.toLowerCase()
};

// Detección por palabras clave en el prompt
if (prompt.includes('chatgpt') || prompt.includes('gpt')) platform = 'chatgpt';
if (prompt.includes('claude') || prompt.includes('anthropic')) platform = 'claude';
if (prompt.includes('gemini') || prompt.includes('google')) platform = 'gemini';
// ... etc
```

### Optimización Específica
Cada plataforma recibe prompts optimizados:

```typescript
const enhancedPrompt = `${config.promptPrefix}\n\n${userPrompt}\n\nInstrucciones específicas para ${platform}:\n${platformInstructions}`;
```

---

## 📱 **Interfaz Mejorada**

### Selector de Plataforma
Nuevo componente `PlatformSelector` con:
- 🎨 **Visual moderno** con cards por plataforma
- 📊 **Información detallada** de capacidades
- 🎯 **Recomendaciones** por tipo de contenido
- 🔗 **Acceso directo** a cada plataforma

### Estado de Conexión
- ✅ **Indicador visual** de plataforma conectada
- 🕐 **Temporizador** de expiración
- 🔄 **Re-generación** con un click
- 📈 **Métricas** de uso por plataforma

---

## 🎯 **Casos de Uso por Plataforma**

### 🎯 **Para Creatividad Viral → ChatGPT**
```
Código MCP: [CÓDIGO]
Quiero crear un challenge viral para TikTok sobre mi producto.
Necesita:
- Hook potente en 2 segundos
- Música trending
- Efectos visuales atractivos
- Hashtag único que trendee
- CTA para participar
```

### 🧠 **Para Análisis Estratégico → Claude**
```
Código MCP: [CÓDIGO]
Analiza mi competencia directa en el sector de SaaS.
Identifica:
- Fortalezas y debilidades de su contenido
- Estrategias que usan
- Oportunidades que dejan pasar
- 3 recomendaciones estratégicas para diferenciarnos
```

### ✨ **Para Contenido Visual → Gemini**
```
Código MCP: [CÓDIGO]
Necesito ideas para 5 Reels de mi restaurante.
Para cada video incluye:
- Concepto visual detallado
- Paleta de colores sugerida
- Angulos de cámara recomendados
- Efectos de edición trending
- Música de fondo ideal
```

### ⚡ **Para Contenido B2B → Copilot**
```
Código MCP: [CÓDIGO]
Genera una campaña completa para LinkedIn sobre nuestro nuevo software.
Incluye:
- 5 posts para la semana
- Estadísticas y métricas relevantes
- Enfoque en diferentes decision makers
- CTA para demostraciones
- Integración con Microsoft Teams
```

### 🔍 **Para Noticias y Tendencias → Perplexity**
```
Código MCP: [CÓDIGO]
Busca las últimas 5 noticias sobre IA en marketing.
Crea posts que conecten nuestra herramienta con estas tendencias.
Incluye datos reales y fuentes citadas.
```

---

## 🔄 **Migración entre Plataformas**

Puedes cambiar de IA fácilmente:

1. **Genera nuevo código** para otra plataforma
2. **El código anterior** se invalida automáticamente
3. **Mantienes el mismo** businessId y contexto
4. **Sin pérdida de datos** ni configuración

```typescript
// Cambio automático de plataforma
const switchPlatform = async (oldSessionId, newPlatform) => {
  await mcpService.disconnect(oldSessionId);
  const newCode = await mcpService.generateConnectionCode(businessId, 3600, newPlatform);
  return newCode;
};
```

---

## 📊 **Métricas Multi-Plataforma**

El sistema registra por separado:

```typescript
interface PlatformMetrics {
  chatgpt: {
    connections: number,
    promptsProcessed: number,
    averageResponseTime: number,
    successRate: number
  },
  claude: { /* ... */ },
  gemini: { /* ... */ },
  // ... etc
}
```

### Dashboard de Métricas
- 📈 **Uso por plataforma** (gráfico de barras)
- ⏱️ **Tiempo de respuesta** promedio
- ✅ **Tasa de éxito** por tipo de prompt
- 🎯 **Prompts más efectivos** por plataforma

---

## 🛡️ **Seguridad Mejorada**

### Aislamiento por Plataforma
- Cada código solo funciona para **una plataforma específica**
- No puedes usar un código de ChatGPT en Claude
- **Validación cruzada** de plataforma y código

### Límites de Uso
```typescript
const platformLimits = {
  chatgpt: { maxPrompts: 100, timeWindow: '1h' },
  claude: { maxPrompts: 50, timeWindow: '1h' },
  gemini: { maxPrompts: 75, timeWindow: '1h' },
  // ... configurables por plataforma
};
```

---

## 🚀 **Proximas Mejoras**

### 📅 Roadmap Multi-IA
- [ ] **Integración con más IAs** (Llama, Mistral, Grok)
- [ ] **Traducción automática** entre plataformas
- [ ] **Comparación de resultados** entre IAs
- [ ] **A/B testing** de prompts por plataforma
- [ ] **Plantillas específicas** por industria y plataforma
- [ ] **API para desarrolladores** de cada plataforma

### 🎨 Mejoras UI/UX
- [ ] **Dark mode** para selector de plataformas
- [ ] **Atajos de teclado** para selección rápida
- [ ] **Historial de plataformas** usadas
- [ ] **Favoritos** por plataforma
- [ ] **Integración con escritorio** (Electron app)

---

## 📞 **Soporte por Plataforma**

### ChatGPT: `support@openai.com`
### Claude: `support@anthropic.com`
### Gemini: `support@google.com`
### Copilot: `support@microsoft.com`
### Perplexity: `support@perplexity.ai`

### Soporte Nuestro
Para problemas con **nuestra integración MCP**:
- 📧 Email: `mcp@tusistema.com`
- 💬 Chat: `/mcp-support`
- 📚 Docs: `docs.tusistema.com/mcp`

---

## 🎉 **¡Listo para Multi-IA!**

Ahora tienes un sistema MCP completo que soporta **6 plataformas IA diferentes** con:

✅ **Detección automática** de plataforma  
✅ **Optimización específica** por IA  
✅ **Selector visual** intuitivo  
✅ **Métricas detalladas** por plataforma  
✅ **Seguridad mejorada** con aislamiento  
✅ **Documentación completa** para cada IA  

**Elige tu IA favorita y empieza a crear contenido increíble hoy mismo!** 🚀
