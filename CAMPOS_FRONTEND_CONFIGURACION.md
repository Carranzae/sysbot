# 📋 CAMPOS QUE DEBERÍAN IR EN EL FRONTEND - CONFIGURACIÓN

## 🎯 SECCIÓN: PAGOS Y EVIDENCIAS MÉDICAS

### 📍 Ubicación sugerida:
Después de la sección de "Gmail API" y antes de "WhatsApp Business API", o como una nueva sección al final.

---

## 1️⃣ CONFIGURACIÓN DE EVIDENCIAS MÉDICAS

### Card: "Evidencias Médicas"
**Título:** 🏥 Evidencias Médicas  
**Descripción:** Configura el destino de las evidencias médicas enviadas por los clientes.

**Campos:**

1. **Número de destino para especialista**
   - **Label:** "Número de WhatsApp del especialista"
   - **Tipo:** Input (teléfono)
   - **Placeholder:** "+51987654321" o "51987654321"
   - **Descripción:** "Número donde se enviarán las evidencias médicas (imágenes, videos) que los clientes compartan"
   - **Campo BD:** `reviewerDestination`
   - **Requerido:** No (opcional)

---

## 2️⃣ CONFIGURACIÓN DE VERIFICACIÓN DE PAGOS

### Card: "Verificación de Pagos"
**Título:** 💳 Verificación de Pagos  
**Descripción:** Configura el correo electrónico donde llegan las notificaciones de pagos (Yape, Plin, etc.) para verificación automática.

**Campos:**

1. **Correo de verificación de pagos**
   - **Label:** "Correo donde llegan notificaciones de pago"
   - **Tipo:** Input (email)
   - **Placeholder:** "pagos@tudominio.com"
   - **Descripción:** "Correo donde Yape/Plin envían las notificaciones de pago. El sistema verificará códigos de seguridad aquí."
   - **Campo BD:** `paymentEmail`
   - **Requerido:** No (opcional, solo si usas Yape/Plin)

2. **Contraseña del correo**
   - **Label:** "Contraseña del correo de pagos"
   - **Tipo:** Input (password)
   - **Placeholder:** "••••••••"
   - **Descripción:** "Contraseña o contraseña de aplicación del correo de pagos"
   - **Campo BD:** `paymentEmailPassword`
   - **Requerido:** No (solo si configuraste paymentEmail)

3. **Proveedor de correo**
   - **Label:** "Proveedor de correo"
   - **Tipo:** Select
   - **Opciones:**
     - "Gmail" (valor: GMAIL)
     - "Outlook / Office 365" (valor: OUTLOOK)
     - "Otro" (valor: OTHER)
   - **Descripción:** "Selecciona el proveedor de tu correo de pagos"
   - **Campo BD:** `paymentEmailProvider`
   - **Requerido:** No (solo si configuraste paymentEmail)
   - **Valor por defecto:** GMAIL

---

## 3️⃣ CONFIGURACIÓN DE BOLETAS

### Card: "Configuración de Boletas"
**Título:** 🧾 Configuración de Boletas  
**Descripción:** Configura los datos que aparecerán en las boletas generadas automáticamente.

**Campos:**

1. **Logo del negocio**
   - **Label:** "Logo del negocio (para boletas)"
   - **Tipo:** File Upload (imagen)
   - **Descripción:** "Sube el logo de tu negocio que aparecerá en las boletas PDF"
   - **Campo BD:** `businessLogoFileId` (ID del archivo subido)
   - **Requerido:** No (opcional, pero recomendado)
   - **Nota:** Debe permitir subir una imagen y guardar el ID del archivo

2. **RUC del negocio**
   - **Label:** "RUC / Número de identificación"
   - **Tipo:** Input (texto)
   - **Placeholder:** "20123456789"
   - **Descripción:** "RUC o número de identificación fiscal que aparecerá en las boletas"
   - **Campo BD:** `businessRUC`
   - **Requerido:** No (opcional)

3. **Dirección del negocio**
   - **Label:** "Dirección completa"
   - **Tipo:** Textarea
   - **Placeholder:** "Av. Principal 123, Lima, Perú"
   - **Descripción:** "Dirección completa que aparecerá en las boletas"
   - **Campo BD:** `businessAddress`
   - **Requerido:** No (opcional)

4. **Prefijo de boletas**
   - **Label:** "Prefijo de número de boleta"
   - **Tipo:** Input (texto)
   - **Placeholder:** "B001-"
   - **Descripción:** "Prefijo que aparecerá antes del número de boleta (ej: B001-000001)"
   - **Campo BD:** `invoicePrefix`
   - **Requerido:** No (opcional)
   - **Valor por defecto:** "B001-"

5. **Último número de boleta**
   - **Label:** "Último número de boleta usado"
   - **Tipo:** Input (número, readonly)
   - **Descripción:** "Último número de boleta generado (solo lectura, se actualiza automáticamente)"
   - **Campo BD:** `lastInvoiceNumber`
   - **Requerido:** No (solo lectura)
   - **Valor por defecto:** 0

---

## 📝 RESUMEN DE CAMPOS NUEVOS

### Total: 9 campos nuevos

1. ✅ `reviewerDestination` - Número de WhatsApp del especialista (ya existe en BD, verificar si está en frontend)
2. ⚠️ `paymentEmail` - Correo de verificación de pagos
3. ⚠️ `paymentEmailPassword` - Contraseña del correo
4. ⚠️ `paymentEmailProvider` - Proveedor (Gmail/Outlook/Otro)
5. ⚠️ `businessLogoFileId` - Logo del negocio (ID de archivo)
6. ⚠️ `businessRUC` - RUC del negocio
7. ⚠️ `businessAddress` - Dirección del negocio
8. ⚠️ `invoicePrefix` - Prefijo de boletas
9. ⚠️ `lastInvoiceNumber` - Último número de boleta (solo lectura)

---

## 🎨 DISEÑO SUGERIDO

### Estructura de Cards:

```
┌─────────────────────────────────────────┐
│ 🏥 Evidencias Médicas                   │
│ ─────────────────────────────────────── │
│ Número de WhatsApp del especialista    │
│ [+51987654321]                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 💳 Verificación de Pagos                │
│ ─────────────────────────────────────── │
│ Correo de pagos: [pagos@...]           │
│ Contraseña: [••••••••]                  │
│ Proveedor: [Gmail ▼]                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🧾 Configuración de Boletas             │
│ ─────────────────────────────────────── │
│ Logo: [Subir archivo]                   │
│ RUC: [20123456789]                      │
│ Dirección: [Av. Principal...]           │
│ Prefijo: [B001-]                        │
│ Último número: [0] (solo lectura)      │
└─────────────────────────────────────────┘
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Seguridad:** Los campos de contraseña deben ser tipo `password` y no mostrarse en texto plano
2. **Validación:** 
   - Email debe ser válido
   - Teléfono debe tener formato correcto
   - RUC debe ser numérico (opcional validación de formato)
3. **Upload de logo:** Debe usar el mismo sistema de upload de archivos que ya existe en el frontend
4. **Solo lectura:** `lastInvoiceNumber` debe ser readonly, solo para visualización
5. **Ayuda contextual:** Agregar tooltips o textos de ayuda que expliquen para qué sirve cada campo

---

## 🔗 INTEGRACIÓN CON BACKEND

Todos estos campos ya están en el schema de Prisma (`BotConfig`), solo falta:
1. Agregarlos al `initialConfig` en el frontend
2. Agregarlos a los campos del formulario
3. Asegurar que se guarden al hacer `handleSave`










