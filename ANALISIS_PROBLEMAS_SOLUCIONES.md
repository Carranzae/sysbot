# 🔍 ANÁLISIS DE PROBLEMAS Y SOLUCIONES

## 📋 PROBLEMAS IDENTIFICADOS

### 1. ❌ QR DE PAGO NO SE ENVÍA CORRECTAMENTE

**Problema:**
- Cuando el cliente pide "QR de pago" o "número de pago", la IA no envía el QR de forma precisa
- El sistema busca archivos pero puede que no encuentre el archivo correcto

**Causas identificadas:**
1. La IA puede no estar generando el comando `[SEND_FILE:...]` correctamente
2. El archivo QR puede no tener los tags correctos (`qr`, `pago`, `payment`, `yape`, `plin`)
3. La búsqueda de archivos puede fallar si el nombre no coincide exactamente

**Solución propuesta:**
1. **Mejorar la búsqueda de archivos QR:**
   - Priorizar archivos con tags específicos: `qr`, `pago`, `payment`, `yape`, `plin`
   - Buscar por descripción que contenga "QR", "pago", "código de pago"
   - Buscar por nombre de archivo que contenga "qr", "pago", "payment"
   - Si no se encuentra, buscar cualquier imagen con esos términos

2. **Mejorar el prompt de la IA:**
   - Instrucciones más claras para que la IA siempre genere `[SEND_FILE:qr:image:QR de Pago]` cuando se pida el QR
   - Agregar ejemplos específicos en el prompt

3. **Validación y logging:**
   - Agregar logs cuando se busca un QR de pago
   - Si no se encuentra, informar al cliente y sugerir subir el QR

---

### 2. ❌ PDFs NO SE LEEN (RAG NO FUNCIONA)

**Problema:**
- Los PDFs subidos no se procesan correctamente
- La IA no puede leer información de los archivos
- Logs muestran: `📚 Chunks en BD: NO` y `📚 Total de chunks disponibles: 0`

**Causa principal identificada:**
```
[RAG] Error creating embedding: 401 Incorrect API key provided: sk-your-***************here
```

**Causas:**
1. **API Key de OpenAI inválida:** La clave está configurada como `sk-your-***************here` (placeholder)
2. **RAG falla silenciosamente:** Cuando falla el embedding, el sistema marca el archivo como procesado pero no crea chunks
3. **Fallback a Hugging Face no funciona:** Aunque implementamos fallback, parece que no se está usando correctamente

**Soluciones propuestas:**

#### Solución 1: Configurar API Key correctamente (RECOMENDADO)
1. **Obtener API Key válida:**
   - Si quieres usar OpenAI: Obtener una API key válida de https://platform.openai.com/account/api-keys
   - Si quieres usar Hugging Face (gratis): Obtener token de https://huggingface.co/settings/tokens

2. **Configurar en el sistema:**
   - Ir a Configuración → Configuración del Bot
   - Actualizar `OPENAI_API_KEY` con la clave válida
   - O configurar `HUGGINGFACE_API_KEY` si prefieres usar Hugging Face

#### Solución 2: Usar Hugging Face como predeterminado (ALTERNATIVA GRATIS)
- Hugging Face ofrece embeddings gratuitos
- Modificar el código para usar Hugging Face por defecto si OpenAI no está configurado
- Ventaja: No requiere API key de pago

#### Solución 3: Reprocesar archivos existentes
- Una vez configurada la API key correcta, reprocesar todos los archivos
- Usar el endpoint: `POST /api/v1/files/reprocess/:fileId?businessId=xxx`
- O crear un endpoint para reprocesar todos los archivos de un negocio

**Implementación sugerida:**
1. Validar API key al iniciar el servicio
2. Si OpenAI falla, usar Hugging Face automáticamente
3. No marcar archivos como procesados si no se crearon chunks
4. Agregar endpoint para verificar estado de RAG: `GET /api/v1/files/test/rag-status?businessId=xxx`

---

### 3. ❌ EVIDENCIAS MÉDICAS NO SE REENVÍAN AL ESPECIALISTA

**Problema:**
- Cuando el cliente envía una foto/evidencia para el especialista, no se reenvía al número asignado
- El código muestra que se llama a `sendToReviewer` pero el archivo no llega

**Causas identificadas:**
1. **`reviewerDestination` no configurado:** El número de destino del especialista no está configurado en `botConfig.reviewerDestination`
2. **`media` no disponible:** El objeto `media` puede no estar disponible cuando se intenta enviar
3. **Error silencioso:** El error se captura pero no se informa al cliente

**Soluciones propuestas:**

#### Solución 1: Validar configuración antes de enviar
```typescript
// Verificar que reviewerDestination esté configurado
if (!evidenceData.reviewerDestination) {
  await this.sendMessage(businessId, fromJid, 
    '⚠️ No hay número de especialista configurado. Por favor, configura el número en Configuración → Evidencias Médicas.'
  );
  return;
}
```

#### Solución 2: Mejorar el envío de evidencias
1. **Guardar el archivo antes de enviar:**
   - Asegurar que el archivo esté guardado en BD antes de intentar enviarlo
   - Usar `fileId` para obtener el archivo completo

2. **Reintentar envío si falla:**
   - Si falla el envío, guardar en una cola de reintentos
   - Informar al cliente del error

3. **Mejorar logging:**
   - Agregar logs detallados del proceso de envío
   - Log del número de destino, estado del envío, errores

#### Solución 3: Enviar archivo desde BD en lugar de `media` en memoria
```typescript
// En lugar de usar `media` directamente, obtener el archivo desde BD
const file = await this.prisma.file.findUnique({
  where: { id: evidence.fileId },
});

if (file && existsSync(file.url)) {
  const fileBuffer = readFileSync(file.url);
  await sock.sendMessage(reviewerJid, {
    image: fileBuffer, // o video/document según el tipo
    caption: evidenceData.message,
  });
}
```

---

## 🛠️ IMPLEMENTACIÓN DE SOLUCIONES

### Prioridad 1: ARREGLAR RAG (PDFs)
1. Configurar API key válida (OpenAI o Hugging Face)
2. Reprocesar archivos existentes
3. Validar que se creen chunks antes de marcar como procesado

### Prioridad 2: ARREGLAR QR DE PAGO
1. Mejorar búsqueda de archivos QR
2. Mejorar prompt de IA para generar comando correcto
3. Agregar validación y mensajes de error claros

### Prioridad 3: ARREGLAR EVIDENCIAS
1. Validar configuración de `reviewerDestination`
2. Mejorar envío de archivos desde BD
3. Agregar logging y manejo de errores

---

## 📝 ALTERNATIVAS Y MEJORAS ADICIONALES

### Alternativa 1: Sistema de notificaciones para evidencias
- En lugar de reenviar directamente, crear una notificación en el dashboard
- El especialista puede ver las evidencias pendientes y descargarlas

### Alternativa 2: Webhook para evidencias
- Enviar webhook a un sistema externo cuando se recibe evidencia
- Permite integración con sistemas de gestión médica

### Alternativa 3: Almacenamiento en la nube
- Subir archivos a S3/Cloud Storage
- Mejorar disponibilidad y rendimiento

### Alternativa 4: Procesamiento asíncrono
- Procesar archivos en background jobs
- No bloquear la respuesta al cliente

---

## 🔧 CÓDIGO SUGERIDO PARA IMPLEMENTAR

### 1. Validar API Key al iniciar
```typescript
// En ai.service.ts constructor
async validateEmbeddingService() {
  try {
    await this.embeddingService.createEmbedding('test');
    this.logger.log('✅ Embedding service configured correctly');
  } catch (error) {
    this.logger.error('❌ Embedding service not configured. RAG will not work.');
    this.logger.error('Please configure OPENAI_API_KEY or HUGGINGFACE_API_KEY');
  }
}
```

### 2. Mejorar búsqueda de QR
```typescript
// Priorizar archivos con tags específicos
const qrFiles = files.filter(f => 
  f.tags?.some(tag => 
    ['qr', 'pago', 'payment', 'yape', 'plin'].includes(tag.toLowerCase())
  )
);

if (qrFiles.length > 0) {
  return qrFiles[0].id; // Priorizar el primero con tags
}
```

### 3. Mejorar envío de evidencias
```typescript
// Obtener archivo desde BD
const file = await this.prisma.file.findUnique({
  where: { id: evidence.fileId },
  include: { evidence: true },
});

if (!file || !existsSync(file.url)) {
  throw new Error('File not found or not accessible');
}

const fileBuffer = readFileSync(file.url);
const mimeType = file.mimeType || 'image/jpeg';

// Determinar tipo de mensaje según mimeType
let messageType: 'image' | 'video' | 'document' = 'image';
if (mimeType.startsWith('video/')) messageType = 'video';
else if (mimeType === 'application/pdf' || mimeType.startsWith('application/')) messageType = 'document';

await sock.sendMessage(reviewerJid, {
  [messageType]: fileBuffer,
  mimetype: mimeType,
  caption: evidenceData.message,
});
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Configurar API key válida (OpenAI o Hugging Face)
- [ ] Reprocesar archivos PDF existentes
- [ ] Validar que se crean chunks antes de marcar como procesado
- [ ] Mejorar búsqueda de archivos QR
- [ ] Mejorar prompt de IA para QR de pago
- [ ] Validar `reviewerDestination` antes de enviar evidencias
- [ ] Mejorar envío de evidencias usando archivos desde BD
- [ ] Agregar logging detallado para debugging
- [ ] Agregar mensajes de error claros para el usuario
- [ ] Probar flujo completo: QR, PDFs, Evidencias

---

## 📞 PRÓXIMOS PASOS

1. **Inmediato:** Configurar API key válida para RAG
2. **Corto plazo:** Implementar mejoras en búsqueda de QR y envío de evidencias
3. **Mediano plazo:** Agregar sistema de notificaciones y webhooks
4. **Largo plazo:** Migrar a procesamiento asíncrono y almacenamiento en la nube









