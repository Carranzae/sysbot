# Mejoras Recomendadas para el Sistema RAG e IA

## Análisis de los Logs del Sistema

Después de analizar los logs del sistema, se identificaron **5 problemas críticos** que están afectando el funcionamiento del RAG y la capacidad de la IA para responder basándose en los archivos:

---

## 🔴 PROBLEMA 1: RAG No Está Funcionando

### Situación Actual:
- ✅ Hay **6 archivos procesados**
- ❌ **0 chunks en la base de datos**
- ❌ **0 chunks en Qdrant** (vector DB)
- ❌ El RAG falla con error: `401 Incorrect API key provided: sk-your-***************here`

### Causa Raíz:
El sistema está intentando usar embeddings de OpenAI con una API key inválida, y **NO está usando el fallback de Hugging Face** que debería activarse automáticamente.

### Mejoras Necesarias:

1. **Mejorar el manejo de errores en embeddings:**
   - Cuando falla OpenAI embeddings, debe usar Hugging Face automáticamente
   - No debe fallar silenciosamente - debe loguear el error y continuar con Hugging Face
   - Verificar que el servicio de embeddings esté correctamente inicializado

2. **Verificar que los archivos se procesen correctamente:**
   - Los archivos están marcados como "procesados" pero no tienen chunks
   - Necesita verificar que el proceso de chunking y almacenamiento funcione
   - Agregar validación: si un archivo se marca como procesado, debe tener al menos 1 chunk

3. **Mejorar el diagnóstico:**
   - El endpoint `/api/v1/files/test/rag-status` debe mostrar claramente por qué no hay chunks
   - Debe indicar si el problema es en la extracción de texto, chunking, embeddings o almacenamiento

---

## 🔴 PROBLEMA 2: Detección de Comando CREATE_APPOINTMENT Falla

### Situación Actual:
- ✅ El AI **SÍ genera** el comando: `CREATE_APPOINTMENT:Auner Bravo delgado:989353316:2026-01-04:09:00:60:Cardiología:`
- ❌ El sistema **NO lo detecta** y dice: `❌ El AI NO generó el comando [CREATE_APPOINTMENT]`
- ❌ Luego intenta extraer datos del contexto pero falla: `❌ No se pudieron extraer todos los datos necesarios. Faltan: nombre`

### Causa Raíz:
El método de detección usa `includes('[CREATE_APPOINTMENT')` pero el comando puede estar en una línea diferente o con formato ligeramente diferente. Además, el comando aparece en el texto pero se pierde durante el procesamiento.

### Mejoras Necesarias:

1. **Mejorar la detección del comando:**
   ```typescript
   // Usar regex más robusto que busque el comando en cualquier parte del texto
   const appointmentRegex = /\[CREATE_APPOINTMENT:([^\]]+)\]/gi;
   const matches = response.match(appointmentRegex);
   ```

2. **Extraer el comando ANTES de procesar/limpiar el texto:**
   - El comando debe extraerse inmediatamente después de recibir la respuesta del AI
   - No debe procesarse/limpiarse antes de extraer comandos
   - Guardar el comando en una variable separada antes de limpiar el texto

3. **Mejorar la extracción de datos del contexto:**
   - El nombre "Auner Bravo" está claramente en el mensaje: "mi nombre es auner bravo"
   - Mejorar el regex para extraer nombres del contexto
   - Buscar en el historial completo, no solo en el último mensaje

---

## 🔴 PROBLEMA 3: Límite de Tokens Excedido (Error 413)

### Situación Actual:
- ❌ Error: `Request too large for model llama-3.1-8b-instant`
- ❌ Límite: **6000 tokens**, Requested: **6002 tokens**
- ❌ El prompt es demasiado largo debido al historial de conversación

### Causa Raíz:
El historial de conversación crece indefinidamente (últimos 10 mensajes de los últimos 10 minutos), y con cada mensaje el prompt se hace más largo. Además, el prompt base ya es muy extenso con todas las instrucciones.

### Mejoras Necesarias:

1. **Limitar el tamaño del historial:**
   - En lugar de "últimos 10 mensajes", usar "últimos 5 mensajes" o limitar por tokens
   - Calcular el tamaño aproximado del historial en tokens antes de incluirlo
   - Si el historial es muy largo, truncar o resumir los mensajes más antiguos

2. **Optimizar el prompt base:**
   - Reducir instrucciones redundantes
   - Consolidar instrucciones similares
   - Mover instrucciones menos críticas a un prompt secundario si es necesario

3. **Implementar truncamiento inteligente:**
   - Si el prompt total excede un límite (ej: 5500 tokens), truncar el historial
   - Mantener siempre los mensajes más recientes
   - Resumir mensajes antiguos en lugar de eliminarlos completamente

4. **Manejar el error 413 gracefully:**
   - Si se recibe error 413, automáticamente reducir el historial y reintentar
   - Implementar retry con historial reducido

---

## 🔴 PROBLEMA 4: Extracción de Datos de Citas Falla

### Situación Actual:
- ✅ El mensaje contiene: "mi nombre es auner bravo"
- ❌ El sistema no extrae el nombre correctamente
- ❌ Dice: `❌ No se pudieron extraer todos los datos necesarios. Faltan: nombre`

### Causa Raíz:
La función de extracción de datos del contexto no está buscando correctamente en el formato natural del lenguaje. Busca patrones específicos pero no maneja variaciones como "mi nombre es X", "me llamo X", etc.

### Mejoras Necesarias:

1. **Mejorar regex para extraer nombres:**
   ```typescript
   // Patrones más flexibles
   const namePatterns = [
     /(?:mi nombre es|me llamo|soy|nombre:)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
     /nombre[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
   ];
   ```

2. **Buscar en todo el historial, no solo en el último mensaje:**
   - El nombre puede estar en mensajes anteriores
   - Buscar en todos los mensajes del historial de conversación
   - Priorizar información más reciente pero usar información anterior si falta

3. **Mejorar la extracción de teléfonos:**
   - El teléfono "989353316" está en el mensaje pero se está usando el teléfono del JID
   - Debe priorizar el teléfono mencionado en el mensaje sobre el teléfono del JID

---

## 🔴 PROBLEMA 5: Archivos Procesados Sin Chunks

### Situación Actual:
- ✅ 6 archivos marcados como `isProcessed: true`
- ❌ 0 chunks en la base de datos
- ❌ El sistema asume que hay conocimiento pero no hay chunks para buscar

### Causa Raíz:
El procesamiento de archivos está fallando silenciosamente. Los archivos se marcan como procesados incluso cuando falla la creación de chunks o embeddings.

### Mejoras Necesarias:

1. **No marcar como procesado si falla:**
   - Solo marcar `isProcessed: true` si TODOS los pasos fueron exitosos:
     - ✅ Extracción de texto
     - ✅ Chunking
     - ✅ Creación de embeddings
     - ✅ Almacenamiento en Qdrant
     - ✅ Almacenamiento en BD

2. **Mejorar el logging:**
   - Loggear cada paso del procesamiento
   - Si falla algún paso, loggear el error específico
   - No continuar si un paso crítico falla

3. **Implementar reintentos:**
   - Si falla el procesamiento, permitir reintentar
   - El endpoint `/api/v1/files/reprocess/:fileId` debe funcionar correctamente

---

## 📋 RESUMEN DE MEJORAS PRIORITARIAS

### Prioridad ALTA (Crítico):
1. ✅ **Arreglar RAG para que use Hugging Face cuando OpenAI falla**
2. ✅ **Mejorar detección de comando CREATE_APPOINTMENT con regex robusto**
3. ✅ **Limitar tamaño del historial para evitar error 413**

### Prioridad MEDIA (Importante):
4. ✅ **Mejorar extracción de datos del contexto (nombres, teléfonos)**
5. ✅ **No marcar archivos como procesados si no tienen chunks**

### Prioridad BAJA (Mejoras):
6. ✅ **Optimizar prompt base para reducir tokens**
7. ✅ **Implementar truncamiento inteligente del historial**
8. ✅ **Mejorar manejo de errores 413 con retry automático**

---

## 🛠️ IMPLEMENTACIÓN SUGERIDA

### Paso 1: Arreglar RAG (Más Crítico)
- Verificar que Hugging Face embeddings se inicialice correctamente
- Agregar try-catch en el procesamiento de archivos
- No marcar como procesado si falla

### Paso 2: Arreglar Detección de Comandos
- Extraer comandos ANTES de procesar texto
- Usar regex más robusto
- Guardar comandos en variable separada

### Paso 3: Limitar Historial
- Reducir a últimos 5 mensajes
- Calcular tokens antes de incluir
- Truncar si excede límite

### Paso 4: Mejorar Extracción
- Mejorar regex para nombres y teléfonos
- Buscar en todo el historial
- Priorizar información más reciente

---

## 📊 IMPACTO ESPERADO

Después de implementar estas mejoras:

- ✅ **RAG funcionará correctamente** y la IA podrá responder basándose en los archivos
- ✅ **Las citas se crearán automáticamente** cuando el AI genere el comando
- ✅ **No habrá errores 413** por límite de tokens
- ✅ **Los datos se extraerán correctamente** del contexto
- ✅ **Los archivos se procesarán completamente** con chunks en BD y Qdrant

---

## 🔍 VERIFICACIÓN

Para verificar que las mejoras funcionan:

1. **Verificar RAG:**
   ```bash
   GET /api/v1/files/test/rag-status?businessId=xxx
   # Debe mostrar chunks > 0 en BD y Qdrant
   ```

2. **Probar con mensaje:**
   - Enviar: "Dame información sobre precios"
   - La IA debe responder con información de los archivos subidos

3. **Probar creación de cita:**
   - Enviar: "Quiero una cita de Cardiología el lunes a las 9 am, mi nombre es Juan Pérez, mi teléfono es 999999999"
   - Debe crear la cita automáticamente sin preguntar más

4. **Verificar que no hay error 413:**
   - Enviar varios mensajes seguidos
   - No debe aparecer error 413









